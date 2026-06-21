const express = require('express');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// Get all findings (optionally filtered)
router.get('/', auth, async (req, res) => {
  // Vendor portal users can only see their own findings
  if (req.user.type === 'vendor') {
    req.query.vendor_id = req.user.vendor_id;
  }
  const { vendor_id, status, severity, domain, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let conditions = [];
  let params = [];
  let pi = 1;

  if (vendor_id) { conditions.push(`f.vendor_id = $${pi++}`); params.push(vendor_id); }
  if (status) { conditions.push(`f.status = $${pi++}`); params.push(status); }
  if (severity) { conditions.push(`f.severity = $${pi++}`); params.push(severity); }
  if (domain) { conditions.push(`f.domain = $${pi++}`); params.push(domain); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const countRes = await query(`SELECT COUNT(*) FROM findings f ${where}`, params);
    params.push(limit, offset);
    const result = await query(
      `SELECT f.*, v.name as vendor_name, u.full_name as assigned_to_name
       FROM findings f 
       LEFT JOIN vendors v ON f.vendor_id = v.id
       LEFT JOIN users u ON f.assigned_to = u.id
       ${where} ORDER BY 
         CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         f.created_at DESC
       LIMIT $${pi} OFFSET $${pi+1}`,
      params
    );
    res.json({ findings: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Get finding by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT f.*, v.name as vendor_name, u.full_name as assigned_to_name
       FROM findings f LEFT JOIN vendors v ON f.vendor_id = v.id LEFT JOIN users u ON f.assigned_to = u.id
       WHERE f.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Update finding status / assign
router.patch('/:id', auth, async (req, res) => {
  const { status, assigned_to, evidence_notes, notes } = req.body;
  const validTransitions = {
    'raised': ['assigned','in_progress','evidence_submitted'], // vendor can submit evidence directly
    'assigned': ['in_progress','evidence_submitted'],
    'in_progress': ['evidence_submitted'],
    'evidence_submitted': ['verified','in_progress'],
    'verified': ['closed']
  };

  try {
    const old = await query('SELECT * FROM findings WHERE id = $1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });

    const current = old.rows[0].status;
    if (status && !validTransitions[current]?.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${current} to ${status}` });
    }

    const updates = [];
    const params = [];
    let pi = 1;

    if (status) { updates.push(`status = $${pi++}`); params.push(status); }
    if (assigned_to) { updates.push(`assigned_to = $${pi++}`); params.push(assigned_to); }
    if (evidence_notes) { updates.push(`evidence_notes = $${pi++}`); params.push(evidence_notes); }
    if (status === 'closed') { updates.push(`closed_at = NOW()`); }
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
      `UPDATE findings SET ${updates.join(', ')} WHERE id = $${pi} RETURNING *`,
      params
    );
    await auditLog(req, `finding_${status || 'updated'}`, 'finding', req.params.id, old.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Stats for dashboard
router.get('/stats/summary', auth, async (req, res) => {
  if (req.user.type === 'vendor') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  try {
    const [bySeverity, byStatus, overdue, recent] = await Promise.all([
      query(`SELECT severity, COUNT(*) as count FROM findings WHERE status != 'closed' GROUP BY severity`),
      query(`SELECT status, COUNT(*) as count FROM findings GROUP BY status`),
      query(`SELECT COUNT(*) as count FROM findings WHERE status NOT IN ('closed','verified') AND target_date < NOW()`),
      query(`SELECT f.*, v.name as vendor_name FROM findings f JOIN vendors v ON f.vendor_id = v.id ORDER BY f.created_at DESC LIMIT 5`)
    ]);
    res.json({
      by_severity: bySeverity.rows,
      by_status: byStatus.rows,
      overdue: parseInt(overdue.rows[0].count),
      recent: recent.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
