const express = require('express');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// Get questionnaire for a vendor
router.get('/:vendorId/questionnaire', auth, async (req, res) => {
  // Vendor users can only access their own questionnaire
  if (req.user.type === 'vendor' && req.user.vendor_id !== req.params.vendorId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const vendor = await query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Vendor not found' });

    const responses = await query(
      'SELECT * FROM questionnaire_responses WHERE vendor_id = $1 ORDER BY domain, question_key',
      [req.params.vendorId]
    );

    const questions = buildQuestionnaire(vendor.rows[0].category);
    res.json({ questions, responses: responses.rows, vendor: vendor.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit / update questionnaire responses
router.post('/:vendorId/questionnaire', auth, async (req, res) => {
  if (req.user.type === 'vendor' && req.user.vendor_id !== req.params.vendorId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { responses } = req.body;
  const { vendorId } = req.params;

  // Backend validation 1: must have responses
  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({ error: 'No responses provided' });
  }

  // Backend validation 2: every response must have a valid answer
  const validAnswers = ['compliant', 'partially_compliant', 'non_compliant', 'na'];
  const unanswered = responses.filter(r => !r.answer || !validAnswers.includes(r.answer));
  if (unanswered.length > 0) {
    return res.status(400).json({
      error: `All questions must be answered before submitting. ${unanswered.length} question(s) have no valid answer.`,
      unanswered_keys: unanswered.map(r => r.question_key)
    });
  }

  // Backend validation 3: count must match expected questionnaire length for this vendor's category
  try {
    const vendorCheck = await query('SELECT category FROM vendors WHERE id = $1', [vendorId]);
    if (vendorCheck.rows.length && vendorCheck.rows[0].category) {
      const expected = buildQuestionnaire(vendorCheck.rows[0].category);
      if (expected.length > 0 && responses.length < expected.length) {
        return res.status(400).json({
          error: `Incomplete questionnaire. Expected ${expected.length} answers, received ${responses.length}. All questions must be answered.`,
          expected: expected.length,
          received: responses.length
        });
      }
    }
  } catch (checkErr) {
    console.error('Questionnaire completeness check failed (non-blocking):', checkErr.message);
  }

  try {
    for (const r of responses) {
      await query(
        `INSERT INTO questionnaire_responses 
         (vendor_id, domain, question_key, question_text, answer, notes, is_regulatory_tagged, regulatory_ref, answered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT (vendor_id, question_key) 
         DO UPDATE SET answer=$5, notes=$6, answered_at=NOW()`,
        [vendorId, r.domain, r.question_key, r.question_text, r.answer, r.notes, r.is_regulatory_tagged || false, r.regulatory_ref || null]
      );

      // Auto-raise findings for non-compliant / partially compliant
      if (r.answer === 'non_compliant' || r.answer === 'partially_compliant') {
        const severity = r.answer === 'non_compliant' ? 'high' : 'medium';
        const findingRef = `F-${vendorId.substring(0,6).toUpperCase()}-${r.question_key.substring(0,8).toUpperCase()}`;
        await query(
          `INSERT INTO findings (vendor_id, finding_ref, title, description, severity, domain, is_regulatory, regulatory_ref, target_date, linked_question_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() + INTERVAL '30 days', $9)
           ON CONFLICT (finding_ref) DO UPDATE SET 
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             severity = EXCLUDED.severity`,
          [
            vendorId,
            findingRef,
            `${r.answer === 'non_compliant' ? 'Non-Compliance' : 'Partial Compliance'}: ${r.question_text.substring(0, 80)}`,
            `Vendor answered ${r.answer} for: ${r.question_text}`,
            severity, r.domain,
            r.is_regulatory_tagged || false,
            r.regulatory_ref || null,
            r.question_key
          ]
        );
      }
    }

    // Recalculate risk score - use internal user id only (vendors don't have users table entry)
    const scoredById = req.user.type === 'internal' ? req.user.id : null;
    const score = await calculateRiskScore(vendorId, scoredById);
    if (req.user.type === 'internal') {
      await auditLog(req, 'questionnaire_submitted', 'vendor', vendorId, null, { responses_count: responses.length });
    }
    res.json({ score, message: 'Questionnaire saved and scored' });
  } catch (err) {
    console.error('Questionnaire save error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Get risk scores history
router.get('/:vendorId/scores', auth, async (req, res) => {
  if (req.user.type === 'vendor' && req.user.vendor_id !== req.params.vendorId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const result = await query(
      'SELECT * FROM risk_scores WHERE vendor_id = $1 ORDER BY scored_at DESC LIMIT 10',
      [req.params.vendorId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Calculate and store risk score
async function calculateRiskScore(vendorId, userId) {
  const domains = ['cybersecurity', 'operational', 'compliance_legal', 'financial', 'reputational'];
  const domainScores = {};

  for (const domain of domains) {
    const res = await query(
      `SELECT answer FROM questionnaire_responses WHERE vendor_id = $1 AND domain = $2 AND answer IS NOT NULL`,
      [vendorId, domain]
    );
    if (!res.rows.length) { domainScores[domain] = null; continue; }
    const points = res.rows.reduce((sum, r) => {
      if (r.answer === 'compliant') return sum + 1;
      if (r.answer === 'partially_compliant') return sum + 0.5;
      return sum;
    }, 0);
    domainScores[domain] = Math.round((points / res.rows.length) * 100 * 100) / 100;
  }

  const validScores = Object.values(domainScores).filter(s => s !== null);
  const overall = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length * 100) / 100 : null;
  const rating = overall >= 80 ? 'low' : overall >= 50 ? 'medium' : 'high';

  if (overall !== null) {
    await query(
      `INSERT INTO risk_scores (vendor_id, cybersecurity_score, operational_score, compliance_score, financial_score, reputational_score, overall_score, risk_rating, scored_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [vendorId, domainScores.cybersecurity || null, domainScores.operational || null, domainScores.compliance_legal || null, domainScores.financial || null, domainScores.reputational || null, overall, rating, userId || null]
    );
    await query(
      'UPDATE vendors SET overall_risk_score = $1, risk_rating = $2, updated_at = NOW() WHERE id = $3',
      [overall, rating, vendorId]
    );
  }
  return { ...domainScores, overall, rating };
}

// Standard questionnaire builder
function buildQuestionnaire(category) {
  const base = [
    { key: 'company_overview_legal', domain: 'compliance_legal', text: 'Is the vendor legally incorporated and in good standing?', regulatory: false },
    { key: 'bcp_existence', domain: 'operational', text: 'Does the vendor have a documented BCP/DR plan?', regulatory: true, reg_ref: 'RBI/2021-22/117' },
    { key: 'bcp_tested', domain: 'operational', text: 'Has the BCP/DR plan been tested in the last 12 months?', regulatory: false },
    { key: 'data_handling', domain: 'compliance_legal', text: 'Does the vendor document how KVB data is stored, transmitted, and disposed?', regulatory: true, reg_ref: 'DPDPA-2023' },
    { key: 'regulatory_penalties', domain: 'compliance_legal', text: 'Has the vendor been free from regulatory penalties in the last 3 years?', regulatory: false },
    { key: 'insurance_coverage', domain: 'financial', text: 'Does the vendor maintain professional indemnity / cyber liability insurance?', regulatory: false },
    { key: 'subcontracting_disclosed', domain: 'compliance_legal', text: 'Has the vendor disclosed all material sub-contractors?', regulatory: false },
    { key: 'financial_stability', domain: 'financial', text: 'Is the vendor financially stable (positive revenue trend, no major litigation)?', regulatory: false },
  ];

  const categorySpecific = {
    technology_cloud: [
      { key: 'data_residency', domain: 'cybersecurity', text: 'Is all KVB data stored within India?', regulatory: true, reg_ref: 'RBI-DataLoc-2018' },
      { key: 'encryption_at_rest', domain: 'cybersecurity', text: 'Is data encrypted at rest using AES-256 or equivalent?', regulatory: false },
      { key: 'mfa_enforced', domain: 'cybersecurity', text: 'Is MFA enforced for all privileged access?', regulatory: false },
      { key: 'soc2_available', domain: 'cybersecurity', text: 'Is a SOC 2 Type II report available and current (within 12 months)?', regulatory: false },
      { key: 'pentest_annual', domain: 'cybersecurity', text: 'Has a penetration test been conducted in the last 12 months?', regulatory: false },
      { key: 'incident_response_sla', domain: 'operational', text: 'Is there a defined incident response SLA with breach notification within 24 hours?', regulatory: true, reg_ref: 'RBI/2022-23/91' },
      { key: 'dr_rto_rpo', domain: 'operational', text: 'Are RTO/RPO targets defined and tested for KVB-related services?', regulatory: false },
      { key: 'patch_management', domain: 'cybersecurity', text: 'Is there a documented patch management cadence (critical patches within 72 hours)?', regulatory: false },
    ],
    financial_fintech: [
      { key: 'regulatory_licenses', domain: 'compliance_legal', text: 'Does the vendor hold all required RBI/SEBI/IRDAI licenses for the services provided?', regulatory: true, reg_ref: 'RBI-MasterDir-2016' },
      { key: 'pci_dss', domain: 'cybersecurity', text: 'Is the vendor PCI DSS compliant (if handling card transactions)?', regulatory: false },
      { key: 'aml_kyc', domain: 'compliance_legal', text: 'Does the vendor have documented AML/KYC controls in place?', regulatory: true, reg_ref: 'PMLA-2002' },
      { key: 'transaction_security', domain: 'cybersecurity', text: 'Are transaction security controls (tokenisation, encryption) in place?', regulatory: false },
    ],
    outsourcing_data: [
      { key: 'employee_screening', domain: 'compliance_legal', text: 'Does the vendor conduct background verification for all staff with data access?', regulatory: false },
      { key: 'dpdpa_compliance', domain: 'compliance_legal', text: 'Is a DPDPA-compliant Data Processing Agreement in place?', regulatory: true, reg_ref: 'DPDPA-2023' },
      { key: 'access_monitoring', domain: 'cybersecurity', text: 'Is access monitoring and logging in place for all systems with KVB data?', regulatory: false },
      { key: 'site_locations', domain: 'operational', text: 'Have all processing site locations been disclosed and are they within India?', regulatory: false },
    ],
    it_products_software: [
      { key: 'vulnerability_mgmt', domain: 'cybersecurity', text: 'Does the vendor have a documented vulnerability management process?', regulatory: false },
      { key: 'eol_policy', domain: 'operational', text: 'Does the vendor have an end-of-life policy with advance notice?', regulatory: false },
      { key: 'source_code_security', domain: 'cybersecurity', text: 'Are SAST/DAST scans performed on product releases?', regulatory: false },
      { key: 'supply_chain_integrity', domain: 'cybersecurity', text: 'Does the vendor have supply chain security controls (SBOM, third-party audits)?', regulatory: false },
    ],
    professional_services: [
      { key: 'conflict_of_interest', domain: 'reputational', text: 'Has the vendor declared all potential conflicts of interest?', regulatory: false },
      { key: 'confidentiality_controls', domain: 'compliance_legal', text: 'Does the vendor have documented confidentiality handling procedures?', regulatory: false },
      { key: 'staff_qualifications', domain: 'operational', text: 'Are all staff assigned to KVB projects appropriately qualified?', regulatory: false },
    ],
    facilities_operations: [
      { key: 'regulatory_licenses_fac', domain: 'compliance_legal', text: 'Does the vendor hold applicable licenses (FSSAI, PSARA, labour)?', regulatory: false },
      { key: 'physical_access', domain: 'cybersecurity', text: 'Are physical access controls in place for bank premises?', regulatory: false },
      { key: 'police_verification', domain: 'compliance_legal', text: 'Is police verification conducted for all staff with bank access?', regulatory: false },
    ]
  };

  const specific = categorySpecific[category] || [];
  return [...base, ...specific].map(q => ({
    ...q,
    is_regulatory_tagged: q.regulatory || false,
    regulatory_ref: q.reg_ref || null,
  }));
}

module.exports = router;

// Reset questionnaire for a vendor (admin only) — clears all answers and scores
router.delete('/:vendorId/reset', auth, async (req, res) => {
  if (req.user.role !== 'system_administrator') {
    return res.status(403).json({ error: 'Admin only' });
  }
  try {
    await query('DELETE FROM questionnaire_responses WHERE vendor_id = $1', [req.params.vendorId]);
    await query('DELETE FROM risk_scores WHERE vendor_id = $1', [req.params.vendorId]);
    await query('DELETE FROM findings WHERE vendor_id = $1 AND linked_question_key IS NOT NULL', [req.params.vendorId]);
    await query('UPDATE vendors SET overall_risk_score = NULL, risk_rating = NULL WHERE id = $1', [req.params.vendorId]);
    res.json({ success: true, message: 'Questionnaire, scores and auto-raised findings reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
