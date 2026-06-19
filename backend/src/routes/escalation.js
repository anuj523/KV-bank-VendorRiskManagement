const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// NON-COMPLIANCE ESCALATION ENGINE
// Level 1: Reminder (overdue 1-7 days)
// Level 2: Warning (overdue 8-14 days)  
// Level 3: Escalation to Risk Team (overdue 15-30 days)
// Level 4: Enforcement action (overdue 30+ days)
// ============================================================

const ESCALATION_LEVELS = {
  1: { label: 'Reminder', days_overdue: 1,  color: 'blue',   action: 'Send reminder to vendor' },
  2: { label: 'Warning',  days_overdue: 8,  color: 'amber',  action: 'Issue formal warning' },
  3: { label: 'Escalate', days_overdue: 15, color: 'orange', action: 'Escalate to Risk Team' },
  4: { label: 'Enforce',  days_overdue: 30, color: 'red',    action: 'Recommend enforcement action' },
};

// Run escalation engine — called by cron or manually
router.post('/run', auth, async (req, res) => {
  try {
    const results = await runEscalationEngine();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current escalation status for all vendors
router.get('/status', auth, async (req, res) => {
  try {
    const [overdueFindings, expiringDocs, renewalDue] = await Promise.all([
      // Overdue findings with escalation level
      query(`
        SELECT 
          f.id, f.finding_ref, f.title, f.severity, f.status,
          f.target_date, f.vendor_id,
          v.name as vendor_name, v.criticality,
          EXTRACT(DAY FROM NOW() - f.target_date) as days_overdue,
          CASE 
            WHEN EXTRACT(DAY FROM NOW() - f.target_date) >= 30 THEN 4
            WHEN EXTRACT(DAY FROM NOW() - f.target_date) >= 15 THEN 3
            WHEN EXTRACT(DAY FROM NOW() - f.target_date) >= 8  THEN 2
            WHEN EXTRACT(DAY FROM NOW() - f.target_date) >= 1  THEN 1
            ELSE 0
          END as escalation_level
        FROM findings f
        JOIN vendors v ON f.vendor_id = v.id
        WHERE f.status NOT IN ('closed','verified')
          AND f.target_date < NOW()
        ORDER BY days_overdue DESC, f.severity
      `),
      // Documents expiring/expired
      query(`
        SELECT d.*, v.name as vendor_name, v.criticality,
          EXTRACT(DAY FROM NOW() - d.valid_until) as days_expired,
          CASE
            WHEN d.valid_until < NOW() THEN 4
            WHEN d.valid_until < NOW() + INTERVAL '7 days' THEN 3
            WHEN d.valid_until < NOW() + INTERVAL '14 days' THEN 2
            WHEN d.valid_until < NOW() + INTERVAL '30 days' THEN 1
            ELSE 0
          END as escalation_level
        FROM documents d
        JOIN vendors v ON d.vendor_id = v.id
        WHERE d.status = 'approved' 
          AND d.valid_until < NOW() + INTERVAL '30 days'
        ORDER BY d.valid_until ASC
      `),
      // Contracts due for renewal
      query(`
        SELECT v.*, 
          EXTRACT(DAY FROM v.contract_end_date - NOW()) as days_until_expiry
        FROM vendors v
        WHERE v.status = 'active'
          AND v.contract_end_date IS NOT NULL
          AND v.contract_end_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        ORDER BY v.contract_end_date ASC
      `)
    ]);

    // Summary counts by escalation level
    const findingsByLevel = [1,2,3,4].map(level => ({
      level,
      ...ESCALATION_LEVELS[level],
      count: overdueFindings.rows.filter(f => f.escalation_level === level).length
    }));

    res.json({
      overdue_findings: overdueFindings.rows,
      findings_by_level: findingsByLevel,
      expiring_documents: expiringDocs.rows,
      renewal_due: renewalDue.rows,
      total_overdue: overdueFindings.rows.length,
      total_level3_plus: overdueFindings.rows.filter(f => f.escalation_level >= 3).length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Take enforcement action on a finding
router.post('/enforce/:findingId', auth, async (req, res) => {
  const { action, notes } = req.body; // suspend_vendor | require_remediation | issue_penalty
  try {
    const finding = await query('SELECT * FROM findings WHERE id = $1', [req.params.findingId]);
    if (!finding.rows.length) return res.status(404).json({ error: 'Finding not found' });

    const f = finding.rows[0];
    await query(
      `INSERT INTO audit_trail (vendor_id, user_id, action, entity_type, entity_id, new_value)
       VALUES ($1, $2, $3, 'finding', $4, $5)`,
      [f.vendor_id, req.user.id, `enforcement_${action}`, f.id, JSON.stringify({ action, notes })]
    );

    if (action === 'suspend_vendor') {
      await query(`UPDATE vendors SET status = 'suspended', updated_at = NOW() WHERE id = $1`, [f.vendor_id]);
    }

    await query(
      `INSERT INTO notifications (vendor_id, type, title, message)
       VALUES ($1, 'enforcement', $2, $3)`,
      [f.vendor_id, `Enforcement Action: ${action.replace(/_/g, ' ')}`,
       `Enforcement action taken on finding ${f.finding_ref}: ${notes}`]
    );

    res.json({ success: true, action, vendor_id: f.vendor_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runEscalationEngine() {
  // Auto-create notifications for overdue findings
  const overdue = await query(`
    SELECT f.*, v.name as vendor_name,
      EXTRACT(DAY FROM NOW() - f.target_date) as days_overdue
    FROM findings f JOIN vendors v ON f.vendor_id = v.id
    WHERE f.status NOT IN ('closed','verified') AND f.target_date < NOW()
  `);

  let notified = 0;
  for (const f of overdue.rows) {
    const days = Math.floor(f.days_overdue);
    let level = days >= 30 ? 4 : days >= 15 ? 3 : days >= 8 ? 2 : 1;
    const levelInfo = ESCALATION_LEVELS[level];

    await query(
      `INSERT INTO notifications (vendor_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        f.vendor_id,
        `escalation_level_${level}`,
        `${levelInfo.label}: ${f.finding_ref} overdue by ${days} days`,
        `Finding "${f.title}" for ${f.vendor_name} is ${days} days overdue. Action required: ${levelInfo.action}`
      ]
    ).catch(() => {}); // ignore duplicate errors
    notified++;
  }

  return { escalations_processed: notified, findings_checked: overdue.rows.length };
}

module.exports = router;
module.exports.runEscalationEngine = runEscalationEngine;
