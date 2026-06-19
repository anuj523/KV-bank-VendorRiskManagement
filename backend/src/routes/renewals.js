const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all renewal alerts (30/60/90 day buckets)
router.get('/alerts', auth, async (req, res) => {
  try {
    const [due90, due60, due30, overdue] = await Promise.all([
      query(`SELECT v.*, EXTRACT(DAY FROM v.contract_end_date - NOW()) as days_left
             FROM vendors v WHERE v.status = 'active' AND v.contract_end_date BETWEEN NOW() + INTERVAL '61 days' AND NOW() + INTERVAL '90 days' ORDER BY v.contract_end_date`),
      query(`SELECT v.*, EXTRACT(DAY FROM v.contract_end_date - NOW()) as days_left
             FROM vendors v WHERE v.status = 'active' AND v.contract_end_date BETWEEN NOW() + INTERVAL '31 days' AND NOW() + INTERVAL '60 days' ORDER BY v.contract_end_date`),
      query(`SELECT v.*, EXTRACT(DAY FROM v.contract_end_date - NOW()) as days_left
             FROM vendors v WHERE v.status = 'active' AND v.contract_end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' ORDER BY v.contract_end_date`),
      query(`SELECT v.*, EXTRACT(DAY FROM NOW() - v.contract_end_date) as days_overdue
             FROM vendors v WHERE v.status IN ('active','renewal_pending') AND v.contract_end_date < NOW() ORDER BY v.contract_end_date`),
    ]);

    res.json({
      due_90_days: due90.rows,
      due_60_days: due60.rows,
      due_30_days: due30.rows,
      overdue: overdue.rows,
      summary: {
        total_alerts: due90.rows.length + due60.rows.length + due30.rows.length + overdue.rows.length,
        critical: due30.rows.length + overdue.rows.length,
        overdue_count: overdue.rows.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Renew a vendor contract
router.post('/renew/:vendorId', auth, async (req, res) => {
  const { new_end_date, new_value, notes } = req.body;
  try {
    const old = await query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]);
    await query(
      `UPDATE vendors SET contract_end_date = $1, contract_value = COALESCE($2, contract_value),
       status = 'active', updated_at = NOW() WHERE id = $3`,
      [new_end_date, new_value, req.params.vendorId]
    );
    await query(
      `INSERT INTO audit_trail (vendor_id, user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, 'contract_renewed', 'vendor', $1, $3, $4)`,
      [req.params.vendorId, req.user.id,
       JSON.stringify({ contract_end_date: old.rows[0].contract_end_date }),
       JSON.stringify({ contract_end_date: new_end_date, contract_value: new_value, notes })]
    );
    await query(
      `UPDATE workflows SET status = 'completed', current_stage = 'renewed_active', completed_at = NOW()
       WHERE vendor_id = $1 AND workflow_type = 'renewal' AND status IN ('in_progress','on_hold')`,
      [req.params.vendorId]
    );
    res.json({ success: true, new_end_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Put vendor on renewal hold
router.post('/hold/:vendorId', auth, async (req, res) => {
  const { reason } = req.body;
  try {
    await query(`UPDATE vendors SET status = 'renewal_pending', updated_at = NOW() WHERE id = $1`, [req.params.vendorId]);
    await query(
      `INSERT INTO notifications (vendor_id, type, title, message) VALUES ($1, 'renewal_hold', 'Renewal Hold', $2)`,
      [req.params.vendorId, reason || 'Vendor placed on renewal hold pending compliance resolution']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
