const express = require('express');
const { query } = require('../db');
const { auth, auditLog } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// WORKFLOW ENGINE — handles all 6 workflow types
// ============================================================

// Get all workflows (optionally filtered)
// Stats MUST come before /:id routes
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const [active, byType, recentCompleted] = await Promise.all([
      query(`SELECT workflow_type, COUNT(*) as count FROM workflows WHERE status = 'in_progress' GROUP BY workflow_type`),
      query(`SELECT workflow_type, status, COUNT(*) as count FROM workflows GROUP BY workflow_type, status`),
      query(`SELECT w.*, v.name as vendor_name FROM workflows w JOIN vendors v ON w.vendor_id = v.id WHERE w.status = 'completed' ORDER BY w.completed_at DESC LIMIT 5`)
    ]);
    res.json({ active_workflows: active.rows, by_type: byType.rows, recent_completed: recentCompleted.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  const { vendor_id, workflow_type, status } = req.query;
  let conditions = [], params = [], pi = 1;
  if (vendor_id) { conditions.push(`w.vendor_id = $${pi++}`); params.push(vendor_id); }
  if (workflow_type) { conditions.push(`w.workflow_type = $${pi++}`); params.push(workflow_type); }
  if (status) { conditions.push(`w.status = $${pi++}`); params.push(status); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const result = await query(
      `SELECT w.*, v.name as vendor_name, v.criticality, u.full_name as assigned_to_name
       FROM workflows w 
       JOIN vendors v ON w.vendor_id = v.id
       LEFT JOIN users u ON w.assigned_to = u.id
       ${where} ORDER BY w.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create workflow
router.post('/', auth, async (req, res) => {
  const { vendor_id, workflow_type, notes, due_date } = req.body;
  try {
    const result = await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, assigned_to, due_date, notes)
       VALUES ($1, $2, 'in_progress', $3, $4, $5, $6) RETURNING *`,
      [vendor_id, workflow_type, getInitialStage(workflow_type), req.user.id,
       due_date || getDefaultDueDate(workflow_type), notes || null]
    );
    await auditLog(req, `workflow_${workflow_type}_started`, 'workflow', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Advance workflow stage
router.patch('/:id/advance', auth, async (req, res) => {
  const { notes, decision } = req.body; // decision: approved | rejected | material_change
  try {
    const wf = await query('SELECT * FROM workflows WHERE id = $1', [req.params.id]);
    if (!wf.rows.length) return res.status(404).json({ error: 'Not found' });
    const w = wf.rows[0];
    const { nextStage, newStatus } = getNextStage(w.workflow_type, w.current_stage, decision);

    const result = await query(
      `UPDATE workflows SET current_stage = $1, status = $2, notes = COALESCE($3, notes),
       completed_at = CASE WHEN $2 IN ('completed','rejected') THEN NOW() ELSE NULL END,
       updated_at = NOW() WHERE id = $4 RETURNING *`,
      [nextStage, newStatus, notes, req.params.id]
    );

    // Handle workflow completion side effects
    await handleWorkflowCompletion(w, nextStage, newStatus, decision, req.user.id);
    await auditLog(req, `workflow_stage_${nextStage}`, 'workflow', req.params.id, { stage: w.current_stage }, { stage: nextStage, decision });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PERIODIC REVIEW — trigger + comparison
// ============================================================
router.post('/periodic-review/:vendorId', auth, async (req, res) => {
  try {
    const vendor = await query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Vendor not found' });

    // Get last 2 scores for comparison
    const scores = await query(
      'SELECT * FROM risk_scores WHERE vendor_id = $1 ORDER BY scored_at DESC LIMIT 2',
      [req.params.vendorId]
    );

    const current = scores.rows[0];
    const previous = scores.rows[1];
    let materialChange = false;
    let changeSummary = 'No previous score to compare.';

    if (current && previous) {
      const diff = Math.abs(current.overall_score - previous.overall_score);
      materialChange = diff >= 10; // 10% change = material
      const direction = current.overall_score > previous.overall_score ? '📈 improved' : '📉 declined';
      changeSummary = `Score ${direction} by ${diff.toFixed(1)}% (${previous.overall_score}% → ${current.overall_score}%). ${materialChange ? '⚠️ MATERIAL CHANGE — re-approval required.' : '✅ Within acceptable range — no re-approval needed.'}`;
    }

    // Create periodic review workflow
    const wf = await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, assigned_to, due_date, notes)
       VALUES ($1, 'periodic_review', 'in_progress', 'reassessment_issued', $2, NOW() + INTERVAL '30 days', $3) RETURNING *`,
      [req.params.vendorId, req.user.id, changeSummary]
    );

    // Update vendor status to under_review
    await query(`UPDATE vendors SET status = 'under_review', updated_at = NOW() WHERE id = $1`, [req.params.vendorId]);

    // Notify vendor portal
    const vendorUser = await query('SELECT id FROM vendor_users WHERE vendor_id = $1 LIMIT 1', [req.params.vendorId]);
    if (vendorUser.rows.length) {
      await query(
        `INSERT INTO notifications (vendor_id, vendor_user_id, type, title, message)
         VALUES ($1, $2, 'periodic_review', 'Periodic Review Initiated', $3)`,
        [req.params.vendorId, vendorUser.rows[0].id,
         `Your periodic review has been initiated. Please update your questionnaire responses and re-upload any expired documents. Due: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-IN')}`]
      );
    }

    res.json({ workflow: wf.rows[0], material_change: materialChange, change_summary: changeSummary, current_score: current, previous_score: previous });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// RENEWAL WORKFLOW
// ============================================================
router.post('/renewal/:vendorId', auth, async (req, res) => {
  try {
    const vendor = await query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]);
    if (!vendor.rows.length) return res.status(404).json({ error: 'Not found' });
    const v = vendor.rows[0];

    const daysUntilExpiry = v.contract_end_date
      ? Math.ceil((new Date(v.contract_end_date) - new Date()) / (1000*60*60*24))
      : null;

    const wf = await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, assigned_to, due_date, notes)
       VALUES ($1, 'renewal', 'in_progress', 'renewal_alert_sent', $2, $3, $4) RETURNING *`,
      [req.params.vendorId, req.user.id, v.contract_end_date,
       `Contract expires ${daysUntilExpiry ? `in ${daysUntilExpiry} days` : 'soon'}. Renewal assessment initiated.`]
    );

    await query(`UPDATE vendors SET status = 'renewal_pending', updated_at = NOW() WHERE id = $1`, [req.params.vendorId]);
    res.json({ workflow: wf.rows[0], days_until_expiry: daysUntilExpiry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// OFFBOARDING WORKFLOW — full sign-off chain
// ============================================================
router.post('/offboarding/:vendorId', auth, async (req, res) => {
  const { reason, initiated_by_role } = req.body;
  try {
    const wf = await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, assigned_to, due_date, notes)
       VALUES ($1, 'offboarding', 'in_progress', 'offboarding_notified', $2, NOW() + INTERVAL '14 days', $3) RETURNING *`,
      [req.params.vendorId, req.user.id, reason || 'Offboarding initiated']
    );

    // Revoke vendor portal access immediately
    await query(`UPDATE vendor_users SET is_active = false WHERE vendor_id = $1`, [req.params.vendorId]);
    await query(`UPDATE vendors SET status = 'offboarding_initiated', updated_at = NOW() WHERE id = $1`, [req.params.vendorId]);

    // Create sign-off checklist items as notifications to relevant roles
    const signoffs = [
      { role: 'vendor_management_officer', title: 'VMO Sign-off Required', msg: 'Confirm vendor data return and transition plan' },
      { role: 'information_security', title: 'IT Sign-off Required', msg: 'Confirm access revocation and credential invalidation' },
      { role: 'compliance_officer', title: 'Legal Sign-off Required', msg: 'Confirm NDA obligations, data return per DPDPA, exit clause compliance' },
    ];

    for (const s of signoffs) {
      const officer = await query('SELECT id FROM users WHERE role = $1 AND is_active = true LIMIT 1', [s.role]);
      await query(
        `INSERT INTO notifications (vendor_id, user_id, type, title, message)
         VALUES ($1, $2, 'offboarding_signoff', $3, $4)`,
        [req.params.vendorId, officer.rows[0]?.id || null, s.title, s.msg]
      );
    }

    await auditLog(req, 'offboarding_initiated', 'vendor', req.params.vendorId, null, { reason, workflow_id: wf.rows[0].id });
    res.json({ workflow: wf.rows[0], portal_access_revoked: true, signoffs_requested: signoffs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete offboarding (all sign-offs done)
router.post('/offboarding/:vendorId/complete', auth, async (req, res) => {
  try {
    await query(`UPDATE vendors SET status = 'offboarded', updated_at = NOW() WHERE id = $1`, [req.params.vendorId]);
    await query(
      `UPDATE workflows SET status = 'completed', current_stage = 'archived', completed_at = NOW() 
       WHERE vendor_id = $1 AND workflow_type = 'offboarding' AND status = 'in_progress'`,
      [req.params.vendorId]
    );
    await auditLog(req, 'vendor_offboarded_archived', 'vendor', req.params.vendorId, null, { completed_by: req.user.id });
    res.json({ success: true, status: 'offboarded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// APPROVAL ROUTING — risk-based
// ============================================================
router.post('/approve/:vendorId', auth, async (req, res) => {
  const { decision, notes } = req.body; // approved | rejected
  try {
    const vendor = await query('SELECT * FROM vendors WHERE id = $1', [req.params.vendorId]);
    const v = vendor.rows[0];

    // Risk-based routing check
    const requiredRole = v.criticality === 'high' ? 'risk_manager' : 'vendor_management_officer';
    if (req.user.role !== requiredRole && req.user.role !== 'system_administrator') {
      return res.status(403).json({
        error: `${v.criticality === 'high' ? 'High criticality vendors require Risk Manager approval' : 'This vendor requires VMO approval'}`,
        required_role: requiredRole
      });
    }

    const newStatus = decision === 'approved' ? 'active' : 'rejected';
    await query(`UPDATE vendors SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, req.params.vendorId]);

    // Create workflow completion record
    await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, assigned_to, notes, completed_at)
       VALUES ($1, 'new_vendor_assessment', 'completed', $2, $3, $4, NOW())`,
      [req.params.vendorId, decision === 'approved' ? 'approved_active' : 'rejected', req.user.id, notes || null]
    );

    await auditLog(req, `vendor_${decision}`, 'vendor', req.params.vendorId, { status: 'pending_approval' }, { status: newStatus, notes, approved_by_role: req.user.role });

    // Notify vendor portal
    if (decision === 'approved') {
      await query(
        `INSERT INTO notifications (vendor_id, type, title, message)
         VALUES ($1, 'vendor_approved', 'Vendor Approved', 'Your vendor profile has been approved. You are now active in the KVB vendor registry.')`,
        [req.params.vendorId]
      );
    }

    res.json({ success: true, status: newStatus, approved_by: req.user.full_name, role: req.user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Helpers
function getInitialStage(type) {
  const stages = {
    new_vendor_assessment: 'classification',
    periodic_review: 'reassessment_issued',
    remediation: 'assigned',
    renewal: 'renewal_alert_sent',
    non_compliance_escalation: 'reminder_sent',
    offboarding: 'offboarding_notified'
  };
  return stages[type] || 'started';
}

function getDefaultDueDate(type) {
  const days = { new_vendor_assessment: 30, periodic_review: 30, remediation: 14, renewal: 90, non_compliance_escalation: 7, offboarding: 14 };
  const d = new Date();
  d.setDate(d.getDate() + (days[type] || 14));
  return d;
}

function getNextStage(type, currentStage, decision) {
  const flows = {
    new_vendor_assessment: {
      classification: { next: 'due_diligence_issued', status: 'in_progress' },
      due_diligence_issued: { next: 'documents_collected', status: 'in_progress' },
      documents_collected: { next: 'risk_scoring', status: 'in_progress' },
      risk_scoring: { next: decision === 'approved' ? 'approved_active' : 'rejected', status: decision === 'approved' ? 'completed' : 'rejected' },
    },
    periodic_review: {
      reassessment_issued: { next: 'vendor_updating', status: 'in_progress' },
      vendor_updating: { next: 'rescoring', status: 'in_progress' },
      rescoring: { next: decision === 'material_change' ? 'pending_reapproval' : 'completed', status: decision === 'material_change' ? 'pending_approval' : 'completed' },
      pending_reapproval: { next: decision === 'approved' ? 'completed' : 'rejected', status: decision === 'approved' ? 'completed' : 'rejected' },
    },
    offboarding: {
      offboarding_notified: { next: 'data_return', status: 'in_progress' },
      data_return: { next: 'access_revoked', status: 'in_progress' },
      access_revoked: { next: 'it_signoff', status: 'in_progress' },
      it_signoff: { next: 'legal_signoff', status: 'in_progress' },
      legal_signoff: { next: 'archived', status: 'completed' },
    },
    renewal: {
      renewal_alert_sent: { next: 'renewal_assessment', status: 'in_progress' },
      renewal_assessment: { next: 'compliance_check', status: 'in_progress' },
      compliance_check: { next: decision === 'approved' ? 'renewed_active' : 'renewal_hold', status: decision === 'approved' ? 'completed' : 'on_hold' },
    }
  };
  const flow = flows[type]?.[currentStage];
  return flow || { next: 'completed', status: 'completed' };
}

async function handleWorkflowCompletion(workflow, nextStage, newStatus, decision, userId) {
  if (nextStage === 'archived') {
    await query(`UPDATE vendors SET status = 'offboarded' WHERE id = $1`, [workflow.vendor_id]);
  }
  if (nextStage === 'renewed_active') {
    await query(`UPDATE vendors SET status = 'active' WHERE id = $1`, [workflow.vendor_id]);
  }
  if (nextStage === 'renewal_hold') {
    await query(`UPDATE vendors SET status = 'suspended' WHERE id = $1`, [workflow.vendor_id]);
  }
}

module.exports = router;
