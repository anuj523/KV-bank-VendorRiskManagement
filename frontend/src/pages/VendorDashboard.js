import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, FileCheck, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import api from '../utils/api';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [score, setScore] = useState(null);
  const [findings, setFindings] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.vendor_id) return;
    Promise.all([
      api.get(`/vendors/${user.vendor_id}`),
      api.get(`/risk/${user.vendor_id}/scores`),
      api.get(`/findings?vendor_id=${user.vendor_id}&limit=10`),
      api.get(`/documents/vendor/${user.vendor_id}`)
    ]).then(([v, s, f, d]) => {
      setVendor(v);
      setScore(s?.[0] || null);
      setFindings(f.findings || []);
      setDocs(d || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const openFindings = findings.filter(f => !['closed','verified'].includes(f.status));
  const highFindings = openFindings.filter(f => f.severity === 'high');
  const pendingDocs = docs.filter(d => d.status === 'pending');
  const rejectedDocs = docs.filter(d => d.status === 'rejected');
  const approvedDocs = docs.filter(d => d.status === 'approved');

  const STATUS_COLORS = {
    active: '#4ade80', under_review: '#fbbf24', renewal_pending: '#fb923c',
    suspended: '#f87171', pending_approval: '#a78bfa', under_assessment: '#60a5fa',
    under_due_diligence: '#60a5fa', offboarding_initiated: '#f87171'
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          {greeting}, {user?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Vendor status banner */}
      {vendor && (
        <div className="glass-card-flat p-5 flex items-center gap-5"
          style={{ border: `1px solid ${STATUS_COLORS[vendor.status] || 'rgba(255,255,255,0.1)'}30` }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-lg text-white"
            style={{ background: 'linear-gradient(135deg, #4a9fd4, #0ea5a0)' }}>
            {vendor.name?.[0]}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-white text-lg">{vendor.name}</div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {vendor.category?.replace(/_/g, ' ')} · {vendor.criticality || '—'} criticality
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Vendor Status</div>
            <span className="badge" style={{
              background: `${STATUS_COLORS[vendor.status] || '#60a5fa'}18`,
              color: STATUS_COLORS[vendor.status] || '#60a5fa',
              border: `1px solid ${STATUS_COLORS[vendor.status] || '#60a5fa'}35`
            }}>
              {vendor.status?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Action required alerts */}
      {(highFindings.length > 0 || rejectedDocs.length > 0 || pendingDocs.length > 0) && (
        <div className="space-y-2">
          {highFindings.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              <span className="text-sm text-white"><strong>{highFindings.length} high-severity finding{highFindings.length > 1 ? 's' : ''}</strong> require your attention</span>
              <Link to="/portal/findings" className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                View <ChevronRight size={12} />
              </Link>
            </div>
          )}
          {rejectedDocs.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <span className="text-sm text-white"><strong>{rejectedDocs.length} document{rejectedDocs.length > 1 ? 's' : ''} rejected</strong> — please re-upload</span>
              <Link to="/portal/documents" className="ml-auto text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                View <ChevronRight size={12} />
              </Link>
            </div>
          )}
          {pendingDocs.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <Clock size={16} className="text-sky-400 flex-shrink-0" />
              <span className="text-sm text-white"><strong>{pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} pending review</strong> by ABC</span>
              <Link to="/portal/documents" className="ml-auto text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                View <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Risk Score', value: score ? `${score.overall_score}%` : '—', sub: score ? `${score.risk_rating} risk` : 'Not scored yet', color: score ? (score.overall_score >= 80 ? '#4ade80' : score.overall_score >= 50 ? '#fbbf24' : '#f87171') : '#60a5fa', icon: TrendingUp, to: '/portal/risk-scores' },
          { label: 'Open Findings', value: openFindings.length, sub: `${highFindings.length} high severity`, color: highFindings.length > 0 ? '#f87171' : '#4ade80', icon: AlertTriangle, to: '/portal/findings' },
          { label: 'Documents', value: approvedDocs.length, sub: `${pendingDocs.length} pending · ${rejectedDocs.length} rejected`, color: rejectedDocs.length > 0 ? '#fbbf24' : '#4ade80', icon: FileCheck, to: '/portal/documents' },
          { label: 'Closed Findings', value: findings.filter(f => ['closed','verified'].includes(f.status)).length, sub: 'Resolved issues', color: '#4ade80', icon: CheckCircle, to: '/portal/findings' },
        ].map(({ label, value, sub, color, icon: Icon, to }) => (
          <Link key={label} to={to} className="glass-card p-5 group">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${color}18` }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="text-2xl font-bold font-display" style={{ color }}>{value}</div>
            <div className="text-sm font-medium text-white mt-1">{label}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>
          </Link>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* My open findings */}
        <div className="glass-card-flat p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Open Findings</h3>
            <Link to="/portal/findings" className="text-xs" style={{ color: 'var(--text-muted)' }}>View all</Link>
          </div>
          {openFindings.length ? openFindings.slice(0, 4).map(f => (
            <div key={f.id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
              <span className={`badge mt-0.5 flex-shrink-0 ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>
                {f.severity}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{f.title}</div>
                <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span className="badge badge-gray text-xs">{f.status?.replace(/_/g, ' ')}</span>
                  {f.target_date && <span>Due: {new Date(f.target_date).toLocaleDateString('en-IN')}</span>}
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400 opacity-60" />
              No open findings
            </div>
          )}
        </div>

        {/* My documents status */}
        <div className="glass-card-flat p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Document Status</h3>
            <Link to="/portal/documents" className="text-xs" style={{ color: 'var(--text-muted)' }}>View all</Link>
          </div>
          {docs.length ? docs.slice(0, 5).map(d => (
            <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{d.document_type}</div>
                {d.valid_until && (
                  <div className="text-xs mt-0.5" style={{ color: new Date(d.valid_until) < new Date() ? '#f87171' : 'var(--text-muted)' }}>
                    Valid until: {new Date(d.valid_until).toLocaleDateString('en-IN')}
                    {new Date(d.valid_until) < new Date() && ' — EXPIRED'}
                  </div>
                )}
                {d.status === 'rejected' && d.rejection_reason && (
                  <div className="text-xs mt-0.5" style={{ color: '#f87171' }}>Rejected: {d.rejection_reason}</div>
                )}
              </div>
              <span className={`badge flex-shrink-0 ml-3 ${d.status === 'approved' ? 'badge-green' : d.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                {d.status}
              </span>
            </div>
          )) : (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <FileCheck size={32} className="mx-auto mb-2 opacity-30" />
              No documents uploaded yet
              <div className="mt-2">
                <Link to="/portal/documents" className="text-xs text-sky-400">Upload your first document →</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk score summary */}
      {score && (
        <div className="glass-card-flat p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Risk Score Breakdown</h3>
            <Link to="/portal/risk-scores" className="text-xs" style={{ color: 'var(--text-muted)' }}>Full view</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Cybersecurity', value: score.cybersecurity_score },
              { label: 'Operational', value: score.operational_score },
              { label: 'Compliance', value: score.compliance_score },
              { label: 'Financial', value: score.financial_score },
              { label: 'Reputational', value: score.reputational_score },
            ].map(({ label, value }) => {
              const color = value >= 80 ? '#4ade80' : value >= 50 ? '#fbbf24' : value != null ? '#f87171' : 'var(--text-muted)';
              return (
                <div key={label} className="text-center">
                  <div className="text-xl font-bold font-display" style={{ color }}>{value != null ? `${value}%` : '—'}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full" style={{ width: `${value || 0}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="glass-card-flat p-5">
        <h3 className="font-display font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Fill Questionnaire', desc: 'Update your compliance answers', to: '/portal/questionnaire', color: '#60a5fa' },
            { label: 'Upload Document', desc: 'Submit compliance documents', to: '/portal/documents', color: '#a78bfa' },
            { label: 'View Findings', desc: 'Check and resolve issues', to: '/portal/findings', color: '#fbbf24' },
            { label: 'My Risk Score', desc: 'See your current assessment', to: '/portal/risk-scores', color: '#4ade80' },
          ].map(({ label, desc, to, color }) => (
            <Link key={label} to={to} className="glass-card p-4 hover:border-white/20 transition-all">
              <div className="text-sm font-medium text-white mb-1">{label}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
              <div className="mt-2 text-xs flex items-center gap-1" style={{ color }}>
                Go <ChevronRight size={11} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
