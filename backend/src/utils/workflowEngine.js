const { query } = require('../db');

// ============================================================
// WORKFLOW ENGINE — Auto-creates and updates workflows
// Called after every significant vendor event
// ============================================================

const WORKFLOW_STAGES = {
  new_vendor_assessment: [
    'intake_received',
    'under_classification', 
    'due_diligence_issued',
    'questionnaire_submitted',
    'documents_collected',
    'under_assessment',
    'pending_approval',
    'approved_active'
  ],
  periodic_review: [
    'reassessment_issued',
    'vendor_updating',
    'rescoring',
    'comparison_complete',
    'completed'
  ],
  remediation: [
    'finding_raised',
    'assigned',
    'in_progress',
    'evidence_submitted',
    'verified',
    'closed'
  ],
  renewal: [
    'renewal_alert_90days',
    'renewal_alert_60days',
    'renewal_alert_30days',
    'renewal_assessment',
    'compliance_check',
    'renewed_active'
  ],
  non_compliance_escalation: [
    'level_1_reminder',
    'level_2_warning',
    'level_3_risk_team',
    'level_4_enforcement'
  ],
  offboarding: [
    'offboarding_notified',
    'data_return',
    'access_revoked',
    'it_signoff',
    'legal_signoff',
    'archived'
  ]
};

// Map vendor status to workflow stage
const VENDOR_STATUS_TO_STAGE = {
  'intake_received': 'intake_received',
  'under_classification': 'under_classification',
  'under_due_diligence': 'due_diligence_issued',
  'under_assessment': 'under_assessment',
  'pending_approval': 'pending_approval',
  'active': 'approved_active',
  'under_review': 'reassessment_issued',
  'renewal_pending': 'renewal_alert_30days',
  'suspended': 'level_3_risk_team',
  'offboarding_initiated': 'offboarding_notified',
  'offboarded': 'archived',
  'rejected': 'pending_approval'
};

// ============================================================
// CORE: Get or create the active workflow for a vendor
// ============================================================
async function ensureVendorWorkflow(vendorId, workflowType) {
  // Check if active workflow exists
  const existing = await query(
    `SELECT * FROM workflows 
     WHERE vendor_id = $1 AND workflow_type = $2 
     AND status NOT IN ('completed','rejected')
     ORDER BY created_at DESC LIMIT 1`,
    [vendorId, workflowType]
  );
  
  if (existing.rows.length) return existing.rows[0];

  // Create new workflow
  const vendor = await query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
  if (!vendor.rows.length) return null;
  const v = vendor.rows[0];

  const initialStage = WORKFLOW_STAGES[workflowType]?.[0] || 'started';
  const dueDate = getDefaultDueDate(workflowType, v);

  const result = await query(
    `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, due_date, notes)
     VALUES ($1, $2, 'in_progress', $3, $4, $5) RETURNING *`,
    [vendorId, workflowType, initialStage, dueDate,
     `Auto-created for ${v.name} on ${new Date().toLocaleDateString('en-IN')}`]
  );
  return result.rows[0];
}

// ============================================================
// AUTO-SYNC: Update workflow stage when vendor status changes
// ============================================================
async function syncWorkflowToVendorStatus(vendorId, newStatus) {
  try {
    const stage = VENDOR_STATUS_TO_STAGE[newStatus];
    if (!stage) return;

    // Determine which workflow type this status belongs to
    let workflowType = 'new_vendor_assessment';
    if (['under_review', 'pending_reapproval'].includes(newStatus)) workflowType = 'periodic_review';
    if (['renewal_pending'].includes(newStatus)) workflowType = 'renewal';
    if (['offboarding_initiated', 'offboarded'].includes(newStatus)) workflowType = 'offboarding';
    if (['suspended'].includes(newStatus)) workflowType = 'non_compliance_escalation';

    // Get or create the workflow
    const wf = await ensureVendorWorkflow(vendorId, workflowType);
    if (!wf) return;

    // Determine new workflow status
    let wfStatus = 'in_progress';
    if (newStatus === 'active') wfStatus = 'completed';
    if (newStatus === 'offboarded') wfStatus = 'completed';
    if (newStatus === 'rejected') wfStatus = 'rejected';

    await query(
      `UPDATE workflows SET 
        current_stage = $1, 
        status = $2,
        completed_at = CASE WHEN $2 IN ('completed','rejected') THEN NOW() ELSE NULL END,
        updated_at = NOW()
       WHERE id = $3`,
      [stage, wfStatus, wf.id]
    );

    // If completed, mark the assessment workflow done
    if (newStatus === 'active' && workflowType === 'new_vendor_assessment') {
      await query(
        `UPDATE workflows SET status = 'completed', current_stage = 'approved_active', 
         completed_at = NOW() WHERE vendor_id = $1 AND workflow_type = 'new_vendor_assessment'
         AND status = 'in_progress'`,
        [vendorId]
      );
    }
  } catch (err) {
    console.error('Workflow sync error:', err.message);
  }
}

// ============================================================
// AUTO-CREATE: New vendor assessment workflow on vendor creation
// ============================================================
async function onVendorCreated(vendorId) {
  try {
    await ensureVendorWorkflow(vendorId, 'new_vendor_assessment');
  } catch (err) {
    console.error('onVendorCreated workflow error:', err.message);
  }
}

// ============================================================
// AUTO-CREATE: Remediation workflow when finding is raised
// ============================================================
async function onFindingRaised(vendorId, findingId, severity) {
  try {
    const vendor = await query('SELECT name FROM vendors WHERE id = $1', [vendorId]);
    if (!vendor.rows.length) return;

    const result = await query(
      `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, due_date, notes)
       VALUES ($1, 'remediation', 'in_progress', 'finding_raised', NOW() + INTERVAL '30 days', $2)
       RETURNING *`,
      [vendorId, `${severity.toUpperCase()} finding raised — remediation required`]
    );
    return result.rows[0];
  } catch (err) {
    console.error('onFindingRaised workflow error:', err.message);
  }
}

// ============================================================
// AUTO-CREATE: Renewal workflow based on contract expiry
// ============================================================
async function checkAndCreateRenewalWorkflows() {
  try {
    // Find vendors with contracts expiring in 90 days with no active renewal workflow
    const vendors = await query(`
      SELECT v.* FROM vendors v
      WHERE v.status = 'active'
        AND v.contract_end_date IS NOT NULL
        AND v.contract_end_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND NOT EXISTS (
          SELECT 1 FROM workflows w 
          WHERE w.vendor_id = v.id 
            AND w.workflow_type = 'renewal'
            AND w.status NOT IN ('completed','rejected')
        )
    `);

    for (const vendor of vendors.rows) {
      const daysLeft = Math.ceil((new Date(vendor.contract_end_date) - new Date()) / (1000*60*60*24));
      const stage = daysLeft <= 30 ? 'renewal_alert_30days' : daysLeft <= 60 ? 'renewal_alert_60days' : 'renewal_alert_90days';
      
      await query(
        `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, due_date, notes)
         VALUES ($1, 'renewal', 'in_progress', $2, $3, $4)`,
        [vendor.id, stage, vendor.contract_end_date,
         `Auto-created: Contract expires in ${daysLeft} days (${new Date(vendor.contract_end_date).toLocaleDateString('en-IN')})`]
      );

      await query(
        `INSERT INTO notifications (vendor_id, type, title, message)
         VALUES ($1, 'renewal_due', $2, $3)`,
        [vendor.id,
         `Renewal Required: ${vendor.name}`,
         `Contract expires in ${daysLeft} days. Renewal workflow has been initiated automatically.`]
      );
    }
    return vendors.rows.length;
  } catch (err) {
    console.error('Renewal workflow check error:', err.message);
    return 0;
  }
}

// ============================================================
// AUTO-CREATE: Non-compliance escalation workflow on overdue findings
// ============================================================
async function checkAndCreateEscalationWorkflows() {
  try {
    const overdue = await query(`
      SELECT f.vendor_id, COUNT(*) as count,
        MAX(EXTRACT(DAY FROM NOW() - f.target_date)) as max_days_overdue
      FROM findings f
      WHERE f.status NOT IN ('closed','verified')
        AND f.target_date < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM workflows w
          WHERE w.vendor_id = f.vendor_id
            AND w.workflow_type = 'non_compliance_escalation'
            AND w.status NOT IN ('completed','rejected')
        )
      GROUP BY f.vendor_id
    `);

    for (const row of overdue.rows) {
      const days = Math.floor(row.max_days_overdue);
      const stage = days >= 30 ? 'level_4_enforcement' : days >= 15 ? 'level_3_risk_team' : days >= 8 ? 'level_2_warning' : 'level_1_reminder';

      await query(
        `INSERT INTO workflows (vendor_id, workflow_type, status, current_stage, due_date, notes)
         VALUES ($1, 'non_compliance_escalation', 'in_progress', $2, NOW() + INTERVAL '7 days', $3)`,
        [row.vendor_id, stage,
         `Auto-created: ${row.count} overdue finding(s), max ${days} days overdue`]
      );
    }
    return overdue.rows.length;
  } catch (err) {
    console.error('Escalation workflow check error:', err.message);
    return 0;
  }
}

// ============================================================
// GET LIVE WORKFLOW STATUS for a vendor (all active workflows)
// ============================================================
async function getVendorWorkflowStatus(vendorId) {
  try {
    const workflows = await query(
      `SELECT w.*, 
        EXTRACT(DAY FROM NOW() - w.created_at) as age_days,
        EXTRACT(DAY FROM w.due_date - NOW()) as days_until_due
       FROM workflows w
       WHERE w.vendor_id = $1
       ORDER BY 
         CASE w.status WHEN 'in_progress' THEN 1 WHEN 'pending_approval' THEN 2 ELSE 3 END,
         w.created_at DESC`,
      [vendorId]
    );
    return workflows.rows;
  } catch (err) {
    console.error('getVendorWorkflowStatus error:', err.message);
    return [];
  }
}

function getDefaultDueDate(workflowType, vendor) {
  const days = {
    new_vendor_assessment: 30,
    periodic_review: 30,
    remediation: 14,
    renewal: vendor?.contract_end_date ? null : 90,
    non_compliance_escalation: 7,
    offboarding: 14
  };
  if (workflowType === 'renewal' && vendor?.contract_end_date) {
    return new Date(vendor.contract_end_date);
  }
  const d = new Date();
  d.setDate(d.getDate() + (days[workflowType] || 14));
  return d;
}

module.exports = {
  ensureVendorWorkflow,
  syncWorkflowToVendorStatus,
  onVendorCreated,
  onFindingRaised,
  checkAndCreateRenewalWorkflows,
  checkAndCreateEscalationWorkflows,
  getVendorWorkflowStatus,
  WORKFLOW_STAGES
};
