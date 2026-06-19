import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Play, ChevronRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
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
  classification: 'Classification', due_diligence_issued: 'DD Issued',
  documents_collected: 'Docs Collected', risk_scoring: 'Risk Scoring',
  approved_active: 'Approved ✓', rejected: 'Rejected ✗',
  reassessment_issued: 'Re-assessment Issued', vendor_updating: 'Vendor Updating',
  rescoring: 'Re-scoring', pending_reapproval: 'Pending Re-approval',
  renewal_alert_sent: 'Alert Sent', renewal_assessment: 'Assessment',
  compliance_check: 'Compliance Check', renewed_active: 'Renewed ✓', renewal_hold: 'On Hold',
  offboarding_notified: 'Notified', data_return: 'Data Return',
  access_revoked: 'Access Revoked', it_signoff: 'IT Sign-off',
  legal_signoff: 'Legal Sign-off', archived: 'Archived ✓',
  reminder_sent: 'Reminder Sent', assigned: 'Assigned',
  completed: 'Completed', in_progress: 'In Progress'
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/workflows' + (filter ? `?workflow_type=${filter}` : '')),
      api.get('/workflows/stats/overview')
    ]).then(([wf, s]) => {
      setWorkflows(wf);
      setStats(s);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const advance = async (wfId, decision) => {
    const notes = prompt('Notes for this stage advancement (optional):');
    try {
      await api.patch(`/workflows/${wfId}/advance`, { decision, notes });
      api.get('/workflows' + (filter ? `?workflow_type=${filter}` : '')).then(setWorkflows);
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Workflows</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>All 6 workflow types — track every vendor through their lifecycle</p>
      </div>

      {/* Active workflow stats */}
      {stats && (
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
      <div className="glass-card-flat p-4">
        <select className="glass-input w-auto min-w-52" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Workflow Types</option>
          {Object.entries(WF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Workflow list */}
      <div className="glass-card-flat overflow-hidden">
        <table className="glass-table">
          <thead><tr><th>Vendor</th><th>Workflow Type</th><th>Current Stage</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10">
                <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : workflows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <GitBranch size={36} className="mx-auto mb-2 opacity-30" />No workflows found
              </td></tr>
            ) : workflows.map(w => (
              <tr key={w.id}>
                <td>
                  <Link to={`/vendors/${w.vendor_id}`} className="font-medium text-white hover:text-sky-400 transition-colors">
                    {w.vendor_name}
                  </Link>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{w.criticality} criticality</div>
                </td>
                <td>
                  <span className="badge badge-gray" style={{ color: WF_COLORS[w.workflow_type] }}>
                    {WF_LABELS[w.workflow_type]}
                  </span>
                </td>
                <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {STAGE_LABELS[w.current_stage] || w.current_stage?.replace(/_/g, ' ')}
                </td>
                <td>
                  <span className={`badge ${w.status === 'completed' ? 'badge-green' : w.status === 'rejected' ? 'badge-red' : w.status === 'on_hold' ? 'badge-amber' : 'badge-blue'}`}>
                    {w.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-sm" style={{ color: w.due_date && new Date(w.due_date) < new Date() ? '#f87171' : 'var(--text-muted)' }}>
                  {w.due_date ? new Date(w.due_date).toLocaleDateString('en-IN') : '—'}
                </td>
                <td>
                  {w.status === 'in_progress' && (
                    <div className="flex gap-1">
                      <button onClick={() => advance(w.id, 'approved')}
                        className="text-xs py-1 px-2 rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 flex items-center gap-1">
                        <Play size={10} /> Advance
                      </button>
                      {(w.workflow_type === 'periodic_review' || w.workflow_type === 'renewal') && (
                        <button onClick={() => advance(w.id, 'material_change')}
                          className="text-xs py-1 px-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                          Flag Change
                        </button>
                      )}
                    </div>
                  )}
                  {w.status === 'pending_approval' && (
                    <div className="flex gap-1">
                      <button onClick={() => advance(w.id, 'approved')}
                        className="text-xs py-1 px-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10">
                        Approve
                      </button>
                      <button onClick={() => advance(w.id, 'rejected')}
                        className="text-xs py-1 px-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
