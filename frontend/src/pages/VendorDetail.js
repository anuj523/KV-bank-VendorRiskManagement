import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Shield, AlertTriangle, FileCheck,
  TrendingUp, Clock, Bot, Activity, ChevronDown, CheckCircle,
  XCircle, AlertCircle, Loader, Edit3, Save, X
} from 'lucide-react';
import api from '../utils/api';

const STATUS_TRANSITIONS = {
  intake_received: ['under_classification'],
  under_classification: ['under_due_diligence'],
  under_due_diligence: ['under_assessment'],
  under_assessment: ['pending_approval'],
  pending_approval: ['active', 'rejected'],
  active: ['under_review', 'renewal_pending', 'suspended', 'offboarding_initiated'],
  under_review: ['active', 'pending_reapproval'],
  suspended: ['active', 'offboarding_initiated'],
  renewal_pending: ['active', 'offboarding_initiated'],
};

const STATUS_LABELS = {
  under_classification: 'Move to Classification', under_due_diligence: 'Start Due Diligence',
  under_assessment: 'Start Assessment', pending_approval: 'Submit for Approval',
  active: 'Activate', rejected: 'Reject', under_review: 'Send for Review',
  renewal_pending: 'Flag for Renewal', suspended: 'Suspend', offboarding_initiated: 'Initiate Offboarding',
  pending_reapproval: 'Request Re-approval'
};

const DOMAIN_LABELS = {
  cybersecurity: 'Cybersecurity', operational: 'Operational',
  compliance_legal: 'Compliance & Legal', financial: 'Financial', reputational: 'Reputational'
};

function ScoreBar({ label, value }) {
  const color = value >= 80 ? '#4ade80' : value >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color }}>{value != null ? `${value}%` : '—'}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value || 0}%`, background: color }} />
      </div>
    </div>
  );
}

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [aiLoading, setAiLoading] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    api.get(`/vendors/${id}`)
      .then(setVendor)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (newStatus) => {
    setStatusChanging(true);
    try {
      const updated = await api.patch(`/vendors/${id}/status`, { status: newStatus });
      setVendor(prev => ({ ...prev, ...updated }));
    } catch (err) {
      alert(err.message);
    } finally {
      setStatusChanging(false);
    }
  };

  const runAI = async (type) => {
    setAiLoading(type);
    setAiResult(null);
    try {
      let data;
      if (type === 'risk_summary') data = await api.post(`/ai/risk-summary/${id}`, {});
      else if (type === 'gap_analysis') data = await api.post(`/ai/gap-analysis/${id}`, {});
      else if (type === 'mitigation') data = await api.post(`/ai/mitigation/${id}`, {});
      else if (type === 'audit_frequency') data = await api.post(`/ai/audit-frequency/${id}`, {});
      setAiResult({ type, text: data.text });
    } catch (err) {
      setAiResult({ type, text: 'AI analysis failed: ' + err.message, error: true });
    } finally {
      setAiLoading(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  if (!vendor) return <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Vendor not found</div>;

  const nextStatuses = STATUS_TRANSITIONS[vendor.status] || [];
  const score = vendor.latest_score;
  const healthColor = { green: '#4ade80', amber: '#fbbf24', red: '#f87171' }[vendor.health_status] || '#60a5fa';

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'risk', label: 'Risk Scores', icon: TrendingUp },
    { key: 'findings', label: `Findings (${vendor.findings?.length || 0})`, icon: AlertTriangle },
    { key: 'documents', label: `Documents (${vendor.documents?.length || 0})`, icon: FileCheck },
    { key: 'ai', label: 'AI Insights', icon: Bot },
    { key: 'audit', label: 'Audit Trail', icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/vendors')} className="btn-glass p-2 mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold text-white">{vendor.name}</h1>
            <span className={`badge ${vendor.criticality === 'high' ? 'badge-red' : vendor.criticality === 'medium' ? 'badge-amber' : 'badge-green'}`}>
              {vendor.criticality || '—'} criticality
            </span>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
              <span className="text-sm" style={{ color: healthColor }}>{vendor.health_status}</span>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.legal_name || ''} · {vendor.category?.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {/* Status badge */}
          <span className="badge badge-blue">{vendor.status?.replace(/_/g, ' ')}</span>
          {/* Status transitions */}
          {nextStatuses.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {nextStatuses.map(s => (
                <button key={s} onClick={() => changeStatus(s)} disabled={statusChanging}
                  className={`text-xs py-1.5 px-3 rounded-lg border transition-all ${
                    s === 'rejected' || s === 'suspended' || s === 'offboarding_initiated'
                      ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                      : s === 'active'
                      ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                      : 'btn-glass'
                  }`}>
                  {STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === key
                ? 'bg-white/10 text-white border border-white/15'
                : 'text-white/50 hover:text-white/80'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card-flat p-6 space-y-4">
            <h3 className="font-display font-semibold text-white">Vendor Details</h3>
            {[
              ['Contact Person', vendor.contact_person],
              ['Email', vendor.email],
              ['Phone', vendor.contact_phone],
              ['Country', vendor.incorporation_country],
              ['Employees', vendor.employee_count],
              ['Years Operating', vendor.years_in_operation],
            ].map(([label, value]) => value ? (
              <div key={label} className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ) : null)}
            {vendor.service_description && (
              <div className="pt-2">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Service Description</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.service_description}</p>
              </div>
            )}
          </div>

          <div className="glass-card-flat p-6 space-y-4">
            <h3 className="font-display font-semibold text-white">Contract & Risk</h3>
            {score && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(74,159,212,0.08)', border: '1px solid rgba(74,159,212,0.15)' }}>
                <div className="text-4xl font-bold font-display mb-1" style={{ color: score.overall_score >= 80 ? '#4ade80' : score.overall_score >= 50 ? '#fbbf24' : '#f87171' }}>
                  {score.overall_score}%
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Overall risk score · {score.risk_rating} risk</div>
              </div>
            )}
            {[
              ['Contract Start', vendor.contract_start_date ? new Date(vendor.contract_start_date).toLocaleDateString('en-IN') : null],
              ['Contract End', vendor.contract_end_date ? new Date(vendor.contract_end_date).toLocaleDateString('en-IN') : null],
              ['Contract Value', vendor.contract_value ? `₹${Number(vendor.contract_value).toLocaleString('en-IN')}` : null],
              ['Auto Renewal', vendor.auto_renewal ? 'Yes' : 'No'],
              ['Owner', vendor.owner_name],
            ].map(([label, value]) => value ? (
              <div key={label} className="flex justify-between py-2 border-b border-white/5">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ) : null)}

            {vendor.subcontractors?.length > 0 && (
              <div className="mt-4">
                <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>SUB-CONTRACTORS ({vendor.subcontractors.length})</div>
                {vendor.subcontractors.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-white">{s.name}</span>
                    <div className="flex gap-2">
                      <span className="badge badge-gray">{s.geography}</span>
                      {s.has_kvb_data_access && <span className="badge badge-amber">Data Access</span>}
                      {s.data_outside_india && <span className="badge badge-red">Outside India</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="glass-card-flat p-6">
          <h3 className="font-display font-semibold text-white mb-6">Risk Domain Scores</h3>
          {score ? (
            <div className="space-y-5">
              {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                <ScoreBar key={key} label={label} value={score[`${key}_score`] ?? score[`${key.replace('_legal', '')}_score`]} />
              ))}
              <div className="mt-6 pt-6 border-t border-white/10">
                <ScoreBar label="Overall Risk Score" value={score.overall_score} />
              </div>
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              No risk scores yet. Complete the questionnaire to generate scores.
            </div>
          )}
          <div className="mt-6">
            <Link to={`/risk/${id}`} className="btn-primary inline-flex items-center gap-2">
              <TrendingUp size={15} />
              Open Questionnaire
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="glass-card-flat overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-display font-semibold text-white">Findings</h3>
            <span className="badge badge-red">{vendor.findings?.filter(f => f.status !== 'closed').length || 0} open</span>
          </div>
          <table className="glass-table">
            <thead><tr><th>Finding</th><th>Severity</th><th>Domain</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {vendor.findings?.length ? vendor.findings.map(f => (
                <tr key={f.id}>
                  <td><div className="font-medium text-white text-sm">{f.title}</div></td>
                  <td><span className={`badge ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>{f.severity}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{f.domain?.replace(/_/g, ' ')}</td>
                  <td><span className="badge badge-gray">{f.status?.replace(/_/g, ' ')}</span></td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{f.target_date ? new Date(f.target_date).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No findings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="glass-card-flat overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h3 className="font-display font-semibold text-white">Documents</h3>
          </div>
          <table className="glass-table">
            <thead><tr><th>Document</th><th>Status</th><th>Valid Until</th><th>Uploaded</th></tr></thead>
            <tbody>
              {vendor.documents?.length ? vendor.documents.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium text-white text-sm">{d.document_type}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.file_name}</div>
                  </td>
                  <td>
                    <span className={`badge ${d.status === 'approved' ? 'badge-green' : d.status === 'rejected' ? 'badge-red' : d.status === 'expired' ? 'badge-red' : 'badge-amber'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {d.valid_until ? new Date(d.valid_until).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No documents uploaded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { type: 'risk_summary', label: 'Risk Summary', desc: 'Executive risk overview', icon: Shield },
              { type: 'gap_analysis', label: 'Gap Analysis', desc: 'Questionnaire vs documents', icon: AlertTriangle },
              { type: 'mitigation', label: 'Mitigations', desc: 'Fix recommendations', icon: CheckCircle },
              { type: 'audit_frequency', label: 'Audit Frequency', desc: 'Review schedule recommendation', icon: Clock },
            ].map(({ type, label, desc, icon: Icon }) => (
              <button
                key={type}
                onClick={() => runAI(type)}
                disabled={aiLoading !== null}
                className="glass-card p-4 text-left group hover:border-sky-400/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  {aiLoading === type ? (
                    <Loader size={16} className="text-sky-400 animate-spin" />
                  ) : (
                    <Icon size={16} className="text-sky-400" />
                  )}
                  <span className="font-medium text-white text-sm">{label}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </button>
            ))}
          </div>

          {aiResult && (
            <div className="glass-card-flat p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bot size={18} className="text-sky-400" />
                <h3 className="font-display font-semibold text-white">AI Analysis</h3>
                {!aiResult.error && (
                  <div className="ml-auto flex gap-2">
                    <button className="btn-glass text-xs py-1 px-3" style={{ color: '#4ade80' }}
                      onClick={() => api.patch(`/ai/analyses/${aiResult.id}/review`, { status: 'accepted' })}>
                      Accept
                    </button>
                    <button className="btn-glass text-xs py-1 px-3" style={{ color: '#f87171' }}
                      onClick={() => api.patch(`/ai/analyses/${aiResult.id}/review`, { status: 'rejected' }).then(() => setAiResult(null))}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
              <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: aiResult.error ? '#f87171' : 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {aiResult.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <AuditTrail vendorId={id} />
      )}
    </div>
  );
}

function AuditTrail({ vendorId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/vendors/${vendorId}/audit`)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vendorId]);

  if (loading) return <div className="text-center py-8"><div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="glass-card-flat overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <h3 className="font-display font-semibold text-white">Audit Trail</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Immutable — all actions logged</p>
      </div>
      <div className="divide-y divide-white/5">
        {logs.length ? logs.map(log => (
          <div key={log.id} className="p-4 flex items-start gap-4">
            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--accent-blue)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{log.action?.replace(/_/g, ' ')}</span>
                {log.entity_type && <span className="badge badge-gray text-xs">{log.entity_type}</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {log.user_name || log.vendor_user_name || 'System'} · {new Date(log.created_at).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No audit logs yet</div>
        )}
      </div>
    </div>
  );
}
