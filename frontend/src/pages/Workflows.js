import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Play, ChevronRight, Plus, RefreshCw, X } from 'lucide-react';
import api from '../utils/api';

const WF_LABELS = {
  new_vendor_assessment: 'New Vendor Assessment',
  periodic_review: 'Periodic Review',
  remediation: 'Remediation',
  renewal: 'Renewal',
  non_compliance_escalation: 'Non-Compliance Escalation',
  offboarding: 'Offboarding'
};

const WF_COLORS = {
  new_vendor_assessment: '#60a5fa',
  periodic_review: '#a78bfa',
  remediation: '#fbbf24',
  renewal: '#34d399',
  non_compliance_escalation: '#f87171',
  offboarding: '#fb923c'
};

const STAGE_LABELS = {
  classification: 'Classification',
  due_diligence_issued: 'DD Issued',
  documents_collected: 'Docs Collected',
  risk_scoring: 'Risk Assessment',
  approved_active: 'Approved ✓',
  rejected: 'Rejected ✗',
  reassessment_issued: 'Re-assessment Issued',
  vendor_updating: 'Vendor Updating',
  rescoring: 'Re-scoring',
  pending_reapproval: 'Pending Re-approval',
  renewal_alert_sent: 'Alert Sent',
  renewal_assessment: 'Assessment',
  compliance_check: 'Compliance Check',
  renewed_active: 'Renewed ✓',
  renewal_hold: 'On Hold',
  offboarding_notified: 'Notified',
  data_return: 'Data Return',
  access_revoked: 'Access Revoked',
  it_signoff: 'IT Sign-off',
  legal_signoff: 'Legal Sign-off',
  archived: 'Archived ✓',
  reminder_sent: 'Reminder Sent',
  assigned: 'Assigned',
  completed: 'Completed',
  in_progress: 'In Progress',
  started: 'Started'
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [startForm, setStartForm] = useState({ vendor_id: '', workflow_type: '', notes: '' });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const url = '/workflows' + (filter ? `?workflow_type=${filter}` : '');
      const [wf, s, v] = await Promise.all([
        api.get(url),
        api.get('/workflows/stats/overview'),
        api.get('/vendors?limit=100&status=active')
      ]);
      setWorkflows(Array.isArray(wf) ? wf : []);
      setStats(s);
      setVendors(v.vendors || []);
    } catch (err) {
      console.error(err);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const advance = async (wfId, decision) => {
    const notes = prompt('Notes for this stage (optional):') || '';
    try {
      await api.patch(`/workflows/${wfId}/advance`, { decision, notes });
      fetchAll();
    } catch (err) { alert(err.message); }
  };

  const startWorkflow = async () => {
    if (!startForm.vendor_id || !startForm.workflow_type) {
      setError('Please select a vendor and workflow type');
      return;
    }
    setStarting(true);
    setError('');
    try {
      // Use dedicated endpoints for special workflows
      if (startForm.workflow_type === 'periodic_review') {
        await api.post(`/workflows/periodic-review/${startForm.vendor_id}`, { notes: startForm.notes });
      } else if (startForm.workflow_type === 'renewal') {
        await api.post(`/workflows/renewal/${startForm.vendor_id}`, { notes: startForm.notes });
      } else if (startForm.workflow_type === 'offboarding') {
        await api.post(`/workflows/offboarding/${startForm.vendor_id}`, { reason: startForm.notes });
      } else {
        await api.post('/workflows', {
          vendor_id: startForm.vendor_id,
          workflow_type: startForm.workflow_type,
          notes: startForm.notes
        });
      }
      setShowStart(false);
      setStartForm({ vendor_id: '', workflow_type: '', notes: '' });
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const activeCount = workflows.filter(w => w.status === 'in_progress' || w.status === 'pending_approval').length;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Workflows</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {activeCount} active · All 6 workflow types tracked here
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAll} className="btn-glass flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={async () => {
            try {
              const r = await api.post('/workflows/sync-all', {});
              alert(`Sync complete!\n\nVendors processed: ${r.vendors_processed}\nWorkflows created: ${r.workflows_created}\nWorkflows synced: ${r.workflows_synced}\nRenewal workflows: ${r.renewal_workflows}\nEscalation workflows: ${r.escalation_workflows}`);
              fetchAll();
            } catch (err) { alert(err.message); }
          }} className="btn-glass flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Sync All Vendors
          </button>
          <button onClick={() => setShowStart(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Start Workflow
          </button>
        </div>
      </div>

      {/* Start Workflow Modal */}
      {showStart && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-white">Start New Workflow</h3>
              <button onClick={() => { setShowStart(false); setError(''); }}>
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Select Vendor *</label>
                <select className="glass-input" value={startForm.vendor_id}
                  onChange={e => setStartForm(p => ({ ...p, vendor_id: e.target.value }))}>
                  <option value="">— choose vendor —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.status?.replace(/_/g,' ')})</option>
                  ))}
                </select>
                {vendors.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Only active vendors shown. Add vendors first from the Vendors page.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Workflow Type *</label>
                <select className="glass-input" value={startForm.workflow_type}
                  onChange={e => setStartForm(p => ({ ...p, workflow_type: e.target.value }))}>
                  <option value="">— choose type —</option>
                  {Object.entries(WF_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {startForm.workflow_type && (
                <div className="p-3 rounded-lg text-xs" style={{ background: `${WF_COLORS[startForm.workflow_type]}12`, border: `1px solid ${WF_COLORS[startForm.workflow_type]}25`, color: 'var(--text-secondary)' }}>
                  {startForm.workflow_type === 'periodic_review' && '🔄 Re-assessment will be issued. Vendor portal will be notified to update questionnaire. Score comparison will detect material changes.'}
                  {startForm.workflow_type === 'renewal' && '📋 Renewal alert will be sent. Vendor status will change to Renewal Pending. Compliance check required before renewal.'}
                  {startForm.workflow_type === 'offboarding' && '⚠️ Vendor portal access will be immediately revoked. Sign-off notifications sent to VMO, IT, and Legal teams.'}
                  {startForm.workflow_type === 'remediation' && '🔧 Track remediation of open findings. Assign to owner and track evidence submission.'}
                  {startForm.workflow_type === 'non_compliance_escalation' && '🚨 Escalate non-compliance through 4 levels: Reminder → Warning → Risk Team → Enforcement.'}
                  {startForm.workflow_type === 'new_vendor_assessment' && '🏢 Full onboarding workflow: Classification → DD → Risk Scoring → Approval.'}
                </div>
              )}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes / Reason</label>
                <textarea className="glass-input resize-none h-16 text-sm" value={startForm.notes}
                  onChange={e => setStartForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Why is this workflow being initiated..." />
              </div>
              {error && (
                <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={startWorkflow} disabled={starting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {starting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={14} />}
                  Start Workflow
                </button>
                <button onClick={() => { setShowStart(false); setError(''); }} className="btn-glass">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards - only show if workflows exist */}
      {stats?.active_workflows?.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.active_workflows.map(w => (
            <div key={w.workflow_type} className="glass-card-flat p-4 flex items-center gap-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: WF_COLORS[w.workflow_type] }} />
              <div>
                <div className="text-lg font-bold font-display text-white">{w.count}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{WF_LABELS[w.workflow_type]}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="glass-card-flat p-4 flex items-center gap-3">
        <select className="glass-input w-auto min-w-52" value={filter}
          onChange={e => setFilter(e.target.value)}>
          <option value="">All Workflow Types</option>
          {Object.entries(WF_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {filter && (
          <button onClick={() => setFilter('')} className="btn-glass text-sm flex items-center gap-1">
            <X size={13} /> Clear
          </button>
        )}
        <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>
          {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Workflow table */}
      <div className="glass-card-flat overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Workflow Type</th>
              <th>Current Stage</th>
              <th>Status</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12">
                <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : workflows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
                <div className="font-medium text-white mb-1">No workflows yet</div>
                <p className="text-sm mb-4">Start a workflow from a vendor's Overview tab or click the button above</p>
                <button onClick={() => setShowStart(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
                  <Plus size={14} /> Start First Workflow
                </button>
              </td></tr>
            ) : workflows.map(w => (
              <tr key={w.id}>
                <td>
                  <Link to={`/vendors/${w.vendor_id}`}
                    className="font-medium text-white hover:text-sky-400 transition-colors">
                    {w.vendor_name}
                  </Link>
                  {w.criticality && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{w.criticality} criticality</div>
                  )}
                </td>
                <td>
                  <span className="badge badge-gray text-xs" style={{ color: WF_COLORS[w.workflow_type] }}>
                    {WF_LABELS[w.workflow_type]}
                  </span>
                </td>
                <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {STAGE_LABELS[w.current_stage] || w.current_stage?.replace(/_/g, ' ')}
                </td>
                <td>
                  <span className={`badge ${
                    w.status === 'completed' ? 'badge-green' :
                    w.status === 'rejected' ? 'badge-red' :
                    w.status === 'on_hold' ? 'badge-amber' :
                    w.status === 'pending_approval' ? 'badge-purple' :
                    'badge-blue'
                  }`}>
                    {w.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-sm" style={{
                  color: w.due_date && new Date(w.due_date) < new Date() ? '#f87171' : 'var(--text-muted)'
                }}>
                  {w.due_date ? new Date(w.due_date).toLocaleDateString('en-IN') : '—'}
                </td>
                <td>
                  <div className="flex gap-1.5 flex-wrap">
                    {w.status === 'in_progress' && (
                      <>
                        <button onClick={() => advance(w.id, 'approved')}
                          className="text-xs py-1 px-2 rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 flex items-center gap-1">
                          <Play size={10} /> Advance
                        </button>
                        {(w.workflow_type === 'periodic_review' || w.workflow_type === 'renewal') && (
                          <button onClick={() => advance(w.id, 'material_change')}
                            className="text-xs py-1 px-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                            ⚠ Flag Change
                          </button>
                        )}
                      </>
                    )}
                    {w.status === 'pending_approval' && (
                      <div className="flex gap-1">
                        <button onClick={() => advance(w.id, 'approved')}
                          className="text-xs py-1 px-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10">
                          ✓ Approve
                        </button>
                        <button onClick={() => advance(w.id, 'rejected')}
                          className="text-xs py-1 px-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                          ✗ Reject
                        </button>
                      </div>
                    )}
                    {w.notes && (
                      <span className="text-xs py-1 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                        title={w.notes}>
                        {w.notes.substring(0, 40)}{w.notes.length > 40 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
