import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Shield, Zap, ChevronRight } from 'lucide-react';
import api from '../utils/api';

const LEVEL_CONFIG = {
  1: { label: 'Reminder', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
  2: { label: 'Warning',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' },
  3: { label: 'Escalate', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)' },
  4: { label: 'Enforce',  color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
};

export default function Escalation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('findings');

  const fetchData = () => {
    setLoading(true);
    api.get('/escalation/status')
      .then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const runEngine = async () => {
    setRunning(true);
    try {
      await api.post('/escalation/run', {});
      fetchData();
    } catch (err) { alert(err.message); }
    finally { setRunning(false); }
  };

  const enforce = async (findingId, action) => {
    const notes = prompt(`Notes for enforcement action "${action}":`);
    if (!notes) return;
    try {
      await api.post(`/escalation/enforce/${findingId}`, { action, notes });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Non-Compliance Escalation</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>4-level escalation engine — Reminder → Warning → Risk Team → Enforcement</p>
        </div>
        <button onClick={runEngine} disabled={running} className="btn-primary flex items-center gap-2">
          {running ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={15} />}
          Run Engine
        </button>
      </div>

      {/* Level cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data?.findings_by_level?.map(level => {
          const cfg = LEVEL_CONFIG[level.level];
          return (
            <div key={level.level} className="glass-card-flat p-5" style={{ borderColor: cfg.border, background: cfg.bg }}>
              <div className="text-2xl font-bold font-display mb-1" style={{ color: cfg.color }}>{level.count}</div>
              <div className="text-sm font-medium text-white">Level {level.level} — {level.label}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{level.action}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { key: 'findings', label: `Overdue Findings (${data?.total_overdue || 0})` },
          { key: 'documents', label: `Expiring Documents (${data?.expiring_documents?.length || 0})` },
          { key: 'renewals', label: `Renewal Due (${data?.renewal_due?.length || 0})` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 ${activeTab === t.key ? 'bg-white/10 text-white border border-white/15' : 'text-white/50 hover:text-white/80'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overdue Findings */}
      {activeTab === 'findings' && (
        <div className="glass-card-flat overflow-hidden">
          <table className="glass-table">
            <thead><tr><th>Finding</th><th>Vendor</th><th>Days Overdue</th><th>Level</th><th>Severity</th><th>Actions</th></tr></thead>
            <tbody>
              {data?.overdue_findings?.length ? data.overdue_findings.map(f => {
                const lvl = LEVEL_CONFIG[f.escalation_level] || LEVEL_CONFIG[1];
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="font-medium text-white text-sm">{f.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.finding_ref}</div>
                    </td>
                    <td>
                      <Link to={`/vendors/${f.vendor_id}`} className="text-sm hover:text-sky-400 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                        {f.vendor_name}
                      </Link>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.criticality} criticality</div>
                    </td>
                    <td>
                      <span className="text-sm font-medium" style={{ color: lvl.color }}>
                        {Math.floor(f.days_overdue)} days
                      </span>
                    </td>
                    <td>
                      <span className="badge text-xs" style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                        L{f.escalation_level} — {lvl.label}
                      </span>
                    </td>
                    <td><span className={`badge ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>{f.severity}</span></td>
                    <td>
                      {f.escalation_level >= 4 && (
                        <div className="flex gap-1">
                          <button onClick={() => enforce(f.id, 'suspend_vendor')} className="text-xs py-1 px-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                            Suspend
                          </button>
                          <button onClick={() => enforce(f.id, 'require_remediation')} className="text-xs py-1 px-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                            Force Fix
                          </button>
                        </div>
                      )}
                      {f.escalation_level < 4 && (
                        <Link to={`/findings`} className="btn-glass py-1 px-2 text-xs flex items-center gap-1">
                          View <ChevronRight size={11} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />No overdue findings
              </td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Expiring Documents */}
      {activeTab === 'documents' && (
        <div className="glass-card-flat overflow-hidden">
          <table className="glass-table">
            <thead><tr><th>Document</th><th>Vendor</th><th>Valid Until</th><th>Alert Level</th></tr></thead>
            <tbody>
              {data?.expiring_documents?.length ? data.expiring_documents.map(d => {
                const lvl = LEVEL_CONFIG[d.escalation_level] || LEVEL_CONFIG[1];
                const expired = new Date(d.valid_until) < new Date();
                return (
                  <tr key={d.id}>
                    <td className="font-medium text-white text-sm">{d.document_type}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{d.vendor_name}</td>
                    <td>
                      <span style={{ color: expired ? '#f87171' : lvl.color }} className="text-sm font-medium">
                        {expired ? `Expired ${Math.floor(d.days_expired)} days ago` : new Date(d.valid_until).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span className="badge text-xs" style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                        L{d.escalation_level} — {lvl.label}
                      </span>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={4} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No expiring documents</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Renewal Due */}
      {activeTab === 'renewals' && (
        <div className="glass-card-flat overflow-hidden">
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Criticality</th><th>Contract Ends</th><th>Days Left</th><th>Actions</th></tr></thead>
            <tbody>
              {data?.renewal_due?.length ? data.renewal_due.map(v => (
                <tr key={v.id}>
                  <td className="font-medium text-white">{v.name}</td>
                  <td><span className={`badge ${v.criticality === 'high' ? 'badge-red' : v.criticality === 'medium' ? 'badge-amber' : 'badge-green'}`}>{v.criticality}</span></td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(v.contract_end_date).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`text-sm font-medium ${v.days_left <= 30 ? 'text-red-400' : v.days_left <= 60 ? 'text-amber-400' : 'text-sky-400'}`}>
                      {Math.floor(v.days_left)} days
                    </span>
                  </td>
                  <td>
                    <Link to={`/vendors/${v.id}`} className="btn-glass py-1 px-2 text-xs flex items-center gap-1 w-fit">
                      View <ChevronRight size={11} />
                    </Link>
                  </td>
                </tr>
              )) : <tr><td colSpan={5} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No renewals due in 90 days</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
