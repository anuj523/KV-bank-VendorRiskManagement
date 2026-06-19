const express = require('express');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// List vendors with filters
router.get('/', auth, async (req, res) => {
  const { status, category, criticality, health_status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let conditions = [];
  let params = [];
  let pi = 1;

  if (status) { conditions.push(`v.status = $${pi++}`); params.push(status); }
  if (category) { conditions.push(`v.category = $${pi++}`); params.push(category); }
  if (criticality) { conditions.push(`v.criticality = $${pi++}`); params.push(criticality); }
  if (health_status) { conditions.push(`v.health_status = $${pi++}`); params.push(health_status); }
  if (search) { conditions.push(`(v.name ILIKE $${pi} OR v.legal_name ILIKE $${pi})`); params.push(`%${search}%`); pi++; }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const countRes = await query(`SELECT COUNT(*) FROM vendors v ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT v.*, u.full_name as owner_name 
       FROM vendors v LEFT JOIN users u ON v.owner_id = u.id 
       ${where} ORDER BY v.updated_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
      params
    );
    res.json({ vendors: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single vendor with full details
router.get('/:id', auth, async (req, res) => {
  try {
    const [vendor, scores, findings, docs, subcontractors] = await Promise.all([
      query(`SELECT v.*, u.full_name as owner_name FROM vendors v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = $1`, [req.params.id]),
      query('SELECT * FROM risk_scores WHERE vendor_id = $1 ORDER BY scored_at DESC LIMIT 1', [req.params.id]),
      query('SELECT * FROM findings WHERE vendor_id = $1 ORDER BY created_at DESC', [req.params.id]),
      query('SELECT * FROM documents WHERE vendor_id = $1 ORDER BY created_at DESC', [req.params.id]),
      query('SELECT * FROM subcontractors WHERE vendor_id = $1', [req.params.id])
    ]);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json({
      ...vendor.rows[0],
      latest_score: scores.rows[0] || null,
      findings: findings.rows,
      documents: docs.rows,
      subcontractors: subcontractors.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create vendor (intake)
router.post('/', auth, async (req, res) => {
  const { name, legal_name, email, contact_person, contact_phone, description, service_description, owner_id } = req.body;
  try {
    const result = await query(
      `INSERT INTO vendors (name, legal_name, email, contact_person, contact_phone, description, service_description, owner_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'intake_received') RETURNING *`,
      [name, legal_name, email, contact_person, contact_phone, description, service_description, owner_id || req.user.id]
    );
    const vendor = result.rows[0];
    await auditLog(req, 'vendor_created', 'vendor', vendor.id, null, vendor);

    // Auto-classify if service description given
    if (service_description) {
      const category = autoClassify(service_description);
      if (category.confidence >= 80) {
        await query(
          `UPDATE vendors SET category = $1, criticality = $2, status = 'under_classification', classification_confidence = $3 WHERE id = $4`,
          [category.category, category.criticality, category.confidence, vendor.id]
        );
      }
    }
    res.status(201).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vendor
router.put('/:id', auth, async (req, res) => {
  const allowed = ['name','legal_name','email','contact_person','contact_phone','description',
    'service_description','category','criticality','status','health_status',
    'contract_start_date','contract_end_date','contract_value','auto_renewal',
    'owner_id','incorporation_country','years_in_operation','employee_count','annual_revenue'];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  try {
    const old = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });

    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const result = await query(
      `UPDATE vendors SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...Object.values(updates)]
    );
    await auditLog(req, 'vendor_updated', 'vendor', req.params.id, old.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vendor status (lifecycle transitions)
router.patch('/:id/status', auth, async (req, res) => {
  const { status, notes } = req.body;
  const validTransitions = {
    'intake_received': ['under_classification'],
    'under_classification': ['under_due_diligence'],
    'under_due_diligence': ['under_assessment'],
    'under_assessment': ['pending_approval'],
    'pending_approval': ['active', 'rejected'],
    'active': ['under_review', 'renewal_pending', 'suspended', 'offboarding_initiated'],
    'under_review': ['active', 'pending_reapproval'],
    'pending_reapproval': ['active', 'suspended', 'offboarding_initiated'],
    'renewal_pending': ['active', 'offboarding_initiated'],
    'suspended': ['active', 'offboarding_initiated'],
    'offboarding_initiated': ['offboarded'],
    'rejected': ['intake_received']
  };

  try {
    const res2 = await query('SELECT status FROM vendors WHERE id = $1', [req.params.id]);
    if (!res2.rows.length) return res.status(404).json({ error: 'Not found' });
    const current = res2.rows[0].status;
    const allowed = validTransitions[current] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${current} to ${status}` });
    }
    const result = await query(
      'UPDATE vendors SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    await auditLog(req, `status_changed_to_${status}`, 'vendor', req.params.id, { status: current }, { status, notes });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get vendor audit trail
router.get('/:id/audit', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, u.full_name as user_name, u.role as user_role,
              vu.full_name as vendor_user_name
       FROM audit_trail a 
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN vendor_users vu ON a.vendor_user_id = vu.id
       WHERE a.vendor_id = $1 OR a.entity_id = $1::uuid
       ORDER BY a.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const [totals, byStatus, byCriticality, byHealth, byRisk] = await Promise.all([
      query('SELECT COUNT(*) as total FROM vendors WHERE status != $1', ['offboarded']),
      query(`SELECT status, COUNT(*) as count FROM vendors WHERE status != 'offboarded' GROUP BY status`),
      query(`SELECT criticality, COUNT(*) as count FROM vendors WHERE status NOT IN ('offboarded','rejected') GROUP BY criticality`),
      query(`SELECT health_status, COUNT(*) as count FROM vendors WHERE status = 'active' GROUP BY health_status`),
      query(`SELECT risk_rating, COUNT(*) as count FROM vendors WHERE status = 'active' AND risk_rating IS NOT NULL GROUP BY risk_rating`)
    ]);
    res.json({
      total: parseInt(totals.rows[0].total),
      by_status: byStatus.rows,
      by_criticality: byCriticality.rows,
      by_health: byHealth.rows,
      by_risk: byRisk.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple keyword-based auto classification
function autoClassify(description) {
  const desc = description.toLowerCase();
  const categories = {
    technology_cloud: ['cloud','aws','azure','gcp','saas','managed service','data center','hosting','infrastructure','iaas','paas'],
    it_products_software: ['software','hardware','license','atm','peripherals','development tools','erp','crm','database'],
    financial_fintech: ['payment','fintech','lending','correspondent bank','insurance','rating agency','settlement','nbfc'],
    outsourcing_data: ['bpo','kpo','call center','loan processing','analytics','credit bureau','data processing','outsourc'],
    professional_services: ['legal','audit','consultant','recruitment','advisory','tax','accounting'],
    facilities_operations: ['catering','housekeeping','security agency','transport','printing','maintenance','facilities']
  };

  let best = { category: null, confidence: 0 };
  for (const [cat, keywords] of Object.entries(categories)) {
    const hits = keywords.filter(k => desc.includes(k)).length;
    const confidence = Math.min((hits / keywords.length) * 100 * 3, 100);
    if (confidence > best.confidence) best = { category: cat, confidence };
  }

  // Default criticality guess
  const highKeywords = ['cloud','payment','data center','saas','lending','credit'];
  const isHigh = highKeywords.some(k => desc.includes(k));
  best.criticality = isHigh ? 'high' : 'medium';
  return best;
}

// Delete vendor (soft delete — admin only, restricted to intake/rejected status)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'system_administrator') {
    return res.status(403).json({ error: 'Only System Administrators can delete vendors' });
  }
  try {
    const result = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Vendor not found' });
    
    const vendor = result.rows[0];
    const deletableStatuses = ['intake_received', 'rejected'];
    if (!deletableStatuses.includes(vendor.status)) {
      return res.status(400).json({ 
        error: `Cannot delete vendor with status "${vendor.status}". Only vendors in Intake or Rejected status can be deleted. To remove an active vendor, use the Offboarding workflow.`
      });
    }

    // Log before deleting
    await query(
      `INSERT INTO audit_trail (vendor_id, user_id, action, entity_type, entity_id, old_value)
       VALUES ($1, $2, 'vendor_deleted', 'vendor', $1, $3)`,
      [vendor.id, req.user.id, JSON.stringify({ name: vendor.name, status: vendor.status, deleted_by: req.user.email })]
    );

    // Nullify audit_trail references so history is preserved but FK constraint is released
    await query(`UPDATE audit_trail SET vendor_id = NULL WHERE vendor_id = $1`, [vendor.id]);

    // Delete related records in correct FK order
    await query('DELETE FROM ai_analyses WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM risk_scores WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM questionnaire_responses WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM documents WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM findings WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM workflows WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM notifications WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM subcontractors WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM vendor_users WHERE vendor_id = $1', [vendor.id]);
    await query('DELETE FROM vendors WHERE id = $1', [vendor.id]);

    res.json({ success: true, message: `Vendor "${vendor.name}" has been permanently deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
