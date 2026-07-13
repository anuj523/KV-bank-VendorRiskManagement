const express = require('express');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

async function callClaude(prompt, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt || 'You are a TPRM (Third-Party Risk Management) expert assistant for ABC Bank. Be concise, precise, and actionable.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

// Generate risk summary for a vendor
router.post('/risk-summary/:vendorId', auth, async (req, res) => {
  if (req.user.type === 'vendor') return res.status(403).json({ error: 'Not authorized' });
  try {
    const [vendor, scores, findings, docs] = await Promise.all([
      query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]),
      query('SELECT * FROM risk_scores WHERE vendor_id = $1 ORDER BY scored_at DESC LIMIT 1', [req.params.vendorId]),
      query(`SELECT severity, COUNT(*) as count FROM findings WHERE vendor_id = $1 AND status != 'closed' GROUP BY severity`, [req.params.vendorId]),
      query(`SELECT document_type, status, valid_until FROM documents WHERE vendor_id = $1`, [req.params.vendorId])
    ]);

    const v = vendor.rows[0];
    const s = scores.rows[0];

    const prompt = `Generate a concise executive risk summary for this vendor:
Vendor: ${v.name} | Category: ${v.category} | Criticality: ${v.criticality}
Risk Scores: Cybersecurity ${s?.cybersecurity_score}%, Operational ${s?.operational_score}%, Compliance ${s?.compliance_score}%, Financial ${s?.financial_score}%, Reputational ${s?.reputational_score}%
Overall Score: ${s?.overall_score}% (${s?.risk_rating} risk)
Open Findings: ${JSON.stringify(findings.rows)}
Documents: ${docs.rows.length} on file

Write 3-4 sentences covering: overall risk posture, key strengths, critical gaps, recommended priority action. End with: "Overall posture: [Low/Medium/High] Risk"`;

    const aiText = await callClaude(prompt);
    
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output)
       VALUES ($1, 'risk_summary', $2, $3) RETURNING *`,
      [req.params.vendorId, `Score: ${s?.overall_score}%`, aiText]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Document analysis / summary
router.post('/document-summary/:documentId', auth, async (req, res) => {
  const { document_text } = req.body; // Text extracted from document
  try {
    const doc = await query('SELECT d.*, v.name as vendor_name FROM documents d JOIN vendors v ON d.vendor_id = v.id WHERE d.id = $1', [req.params.documentId]);
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });

    const d = doc.rows[0];
    const prompt = `You are reviewing a ${d.document_type} document submitted by vendor "${d.vendor_name}" to ABC Bank.

Document content (excerpt):
${document_text ? document_text.substring(0, 3000) : '[Document text not provided]'}

Provide a 1-page summary with:
1. KEY FINDINGS (3-5 bullet points of what's confirmed/covered)
2. AREAS OF CONCERN (any gaps, exceptions, or outdated items)
3. COMPLIANCE STATUS (does it meet typical RBI/banking standards for this document type?)
4. RECOMMENDATION (Accept / Accept with conditions / Request updated version)

Be specific and actionable.`;

    const aiText = await callClaude(prompt);
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output, document_id)
       VALUES ($1, 'document_summary', $2, $3, $4) RETURNING *`,
      [d.vendor_id, d.document_type, aiText, req.params.documentId]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Gap identification - compare questionnaire vs documents
router.post('/gap-analysis/:vendorId', auth, async (req, res) => {
  try {
    const [vendor, responses, docs] = await Promise.all([
      query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]),
      query(`SELECT question_key, question_text, answer, domain FROM questionnaire_responses WHERE vendor_id = $1 AND answer IN ('compliant','partially_compliant')`, [req.params.vendorId]),
      query(`SELECT document_type, status, valid_until FROM documents WHERE vendor_id = $1 AND status = 'approved'`, [req.params.vendorId])
    ]);

    const v = vendor.rows[0];
    const prompt = `Analyze potential contradictions and gaps for vendor "${v.name}" (${v.category}):

Vendor claims (from questionnaire):
${responses.rows.map(r => `- ${r.question_text}: ${r.answer}`).join('\n')}

Available approved documents:
${docs.rows.map(d => `- ${d.document_type} (valid until: ${d.valid_until || 'N/A'})`).join('\n')}

Identify:
1. CONTRADICTIONS: Where vendor claims don't align with available documentation
2. MISSING EVIDENCE: Claims that cannot be verified from submitted documents
3. DOCUMENT GAPS: Required documents that appear missing for this vendor category
4. PRIORITY FLAGS: Top 3 items requiring immediate assessor attention

Format each finding as: [TYPE] Item — Explanation`;

    const aiText = await callClaude(prompt);
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output)
       VALUES ($1, 'gap_identification', 'questionnaire_vs_documents', $2) RETURNING *`,
      [req.params.vendorId, aiText]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Mitigation recommendations for open findings
router.post('/mitigation/:vendorId', auth, async (req, res) => {
  try {
    const findings = await query(
      `SELECT * FROM findings WHERE vendor_id = $1 AND status NOT IN ('closed','verified') ORDER BY severity`,
      [req.params.vendorId]
    );
    const vendor = await query('SELECT name, category, criticality FROM vendors WHERE id = $1', [req.params.vendorId]);

    const prompt = `For vendor "${vendor.rows[0].name}" (${vendor.rows[0].category}, ${vendor.rows[0].criticality} criticality), provide specific mitigation actions for these open findings:

${findings.rows.map(f => `[${f.severity.toUpperCase()}] ${f.title}\n  Domain: ${f.domain}\n  ${f.description}`).join('\n\n')}

For each finding, provide:
- IMMEDIATE ACTION (what vendor must do within 30 days)
- CONTRACT CLAUSE (what to add/enforce in the vendor contract)
- VERIFICATION (how ABC Bank should verify the fix)

Be specific — name the exact control, standard, or clause.`;

    const aiText = await callClaude(prompt);
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output)
       VALUES ($1, 'mitigation_recommendation', $2, $3) RETURNING *`,
      [req.params.vendorId, `${findings.rows.length} open findings`, aiText]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Audit frequency recommendation
router.post('/audit-frequency/:vendorId', auth, async (req, res) => {
  try {
    const [vendor, scores, findings] = await Promise.all([
      query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]),
      query('SELECT * FROM risk_scores WHERE vendor_id = $1 ORDER BY scored_at DESC LIMIT 3', [req.params.vendorId]),
      query(`SELECT COUNT(*) as open FROM findings WHERE vendor_id = $1 AND status NOT IN ('closed','verified')`, [req.params.vendorId])
    ]);

    const v = vendor.rows[0];
    const latestScore = scores.rows[0];
    const trend = scores.rows.length > 1 ? scores.rows[0].overall_score - scores.rows[scores.rows.length - 1].overall_score : 0;

    const prompt = `Recommend audit/review frequency for this vendor:
Name: ${v.name} | Criticality: ${v.criticality} | Category: ${v.category}
Current Risk Score: ${latestScore?.overall_score}% (${latestScore?.risk_rating})
Score Trend: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}% (${trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable'})
Open Findings: ${findings.rows[0].open}
Health Status: ${v.health_status}

Recommend ONE of: Quarterly / Semi-Annual / Annual
Provide recommendation in this format:
RECOMMENDATION: [Quarterly/Semi-Annual/Annual]
REASON: [One sentence justification]
NEXT REVIEW DATE: [Approximate timeframe]
ESCALATION TRIGGER: [What would change this recommendation]`;

    const aiText = await callClaude(prompt);
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output)
       VALUES ($1, 'audit_frequency', $2, $3) RETURNING *`,
      [req.params.vendorId, `Score: ${latestScore?.overall_score}%, Trend: ${trend}`, aiText]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Portfolio concentration alert
router.post('/concentration-alert', auth, async (req, res) => {
  try {
    const [vendors, subcontractors] = await Promise.all([
      query(`SELECT name, category, criticality FROM vendors WHERE status = 'active' AND criticality = 'high'`),
      query(`SELECT s.*, v.name as vendor_name, v.criticality FROM subcontractors s JOIN vendors v ON s.vendor_id = v.id`)
    ]);

    const prompt = `Analyze concentration risk in ABC Bank's vendor portfolio:

High Criticality Active Vendors (${vendors.rows.length}):
${vendors.rows.map(v => `- ${v.name} (${v.category})`).join('\n')}

Sub-contractor Dependencies:
${subcontractors.rows.map(s => `- ${s.vendor_name} → ${s.name} (${s.service_provided}, ${s.geography})`).join('\n')}

Identify:
1. CLOUD/INFRASTRUCTURE CONCENTRATION: Multiple vendors on same platform
2. GEOGRAPHIC CONCENTRATION: Multiple vendors in same region/country
3. SINGLE POINTS OF FAILURE: Critical sub-contractors shared by multiple vendors
4. RECOMMENDED ACTIONS: Specific steps to reduce concentration risk

Provide 3-5 specific, actionable alerts.`;

    const aiText = await callClaude(prompt);
    const result = await query(
      `INSERT INTO ai_analyses (vendor_id, analysis_type, input_context, ai_output)
       VALUES (NULL, 'concentration_alert', $1, $2) RETURNING *`,
      [`${vendors.rows.length} high-criticality vendors`, aiText]
    );

    res.json({ analysis: result.rows[0], text: aiText });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// Accept/reject AI analysis
router.patch('/analyses/:id/review', auth, async (req, res) => {
  const { status } = req.body; // accepted, edited, rejected
  try {
    const result = await query(
      'UPDATE ai_analyses SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 RETURNING *',
      [status, req.user.id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Get AI analyses for a vendor
router.get('/analyses/:vendorId', auth, async (req, res) => {
  if (req.user.type === 'vendor') return res.status(403).json({ error: 'Not authorized' });
  try {
    const result = await query(
      'SELECT * FROM ai_analyses WHERE vendor_id = $1 OR vendor_id IS NULL ORDER BY created_at DESC LIMIT 20',
      [req.params.vendorId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
