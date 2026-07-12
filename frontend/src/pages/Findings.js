import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, ChevronRight, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

export default function Findings() {
  const [findings, setFindings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ severity: '', status: '', domain: '' });
  const [selected, setSelected] = useState(null);
  const [activeVendor, setActiveVendor] = useState(null); // null = show vendor list

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 500, ...filters });
      const [data, s] = await Promise.all([
        api.get(`/findings?${params}`),
        api.get('/findings/stats/summary')
      ]);
      setFindings(data.findings || []);
      setStats(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchFindings(); }, [fetchFindings]);
  useEffect(() => { setSelected(null); }, [activeVendor]);

  const updateFinding = async (id, updates) => {
    try {
      const updated = await api.patch(`/findings/${id}`, updates);
      setFindings(prev => prev.map(f => f.id === id ? updated : f));
      if (selected?.id === id) setSelected(updated);
    } catch (err) { alert(err.message); }
  };

  const SEV_NEXT_STATUS = {
    raised: 'assigned', assigned: 'in_progress', in_progress: 'evidence_submitted',
    evidence_submitted: 'verified', verified: 'closed'
  };

  // Build vendor list
  const vendorMap = {};
  findings.forEach(f => {
    if (!f.vendor_name) return;
    if (!vendorMap[f.vendor_name]) vendorMap[f.vendor_name] = { name: f.vendor_name, total: 0, high: 0, medium: 0, low: 0 };
    vendorMap[f.vendor_name].total++;
    if (f.severity === 'high') vendorMap[f.vendor_name].high++;
    else if (f.severity === 'medium') vendorMap[f.vendor_name].medium++;
    else vendorMap[f.vendor_name].low++;
  });
  const vendors = Object.values(vendorMap);

  const displayedFindings = activeVendor
    ? findings.filter(f => f.vendor_name === activeVendor)
    : [];

  // ── VENDOR LIST VIEW ──
  if (!activeVendor) {
    return (
      <div className="space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Findings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Select a vendor to view its findings</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'High Severity', count: stats.by_severity?.find(s => s.severity === 'high')?.count || 0, color: '#f87171' },
              { label: 'Medium Severity', count: stats.by_severity?.find(s => s.severity === 'medium')?.count || 0, color: '#fbbf24' },
              { label: 'Overdue', count: stats.overdue || 0, color: '#f87171' },
              { label: 'Closed', count: stats.by_status?.find(s => s.status === 'closed')?.count || 0, color: '#4ade80' },
            ].map(({ label, count, color }) => (
              <div key={label} className="glass-card-flat p-4">
                <div className="text-2xl font-bold font-display" style={{ color }}>{count}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Vendor rows */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {vendors.length === 0 ? (
              <div className="glass-card-flat p-12 text-center" style={{ color: 'var(--text-muted)' }}>
                <AlertTriangle size={36} className="mx-auto mb-2 opacity-30" />
                No findings found
              </div>
            ) : vendors.map(v => (
              <button
                key={v.name}
                onClick={() => setActiveVendor(v.name)}
                className="w-full text-left"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '18px 24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(56,189,248,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Building2 size={20} style={{ color: '#38bdf8' }} />
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '15px' }}>{v.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                    {v.total} finding{v.total !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Severity pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {v.high > 0 && (
                    <span style={{
                      background: 'rgba(248,113,113,0.15)', color: '#f87171',
                      border: '1px solid rgba(248,113,113,0.3)',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700'
                    }}>{v.high} HIGH</span>
                  )}
                  {v.medium > 0 && (
                    <span style={{
                      background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.25)',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600'
                    }}>{v.medium} MED</span>
                  )}
                  {v.low > 0 && (
                    <span style={{
                      background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
                      border: '1px solid rgba(96,165,250,0.2)',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600'
                    }}>{v.low} LOW</span>
                  )}
                </div>

                <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FINDINGS DETAIL VIEW (after clicking a vendor) ──
  const vendorInfo = vendorMap[activeVendor];
  return (
    <div className="space-y-6 animate-in">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveVendor(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{activeVendor}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {vendorInfo?.total} finding{vendorInfo?.total !== 1 ? 's' : ''}
            {vendorInfo?.high > 0 && <span style={{ color: '#f87171', marginLeft: '8px' }}>• {vendorInfo.high} High Severity</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card-flat p-4 flex flex-wrap gap-3">
        {[
          { key: 'severity', options: [['high','High'],['medium','Medium'],['low','Low']], placeholder: 'All Severities' },
          { key: 'status', options: [['raised','Raised'],['assigned','Assigned'],['in_progress','In Progress'],['evidence_submitted','Evidence Submitted'],['verified','Verified'],['closed','Closed']], placeholder: 'All Statuses' },
          { key: 'domain', options: [['cybersecurity','Cybersecurity'],['operational','Operational'],['compliance_legal','Compliance'],['financial','Financial'],['reputational','Reputational']], placeholder: 'All Domains' },
        ].map(({ key, options, placeholder }) => (
          <select key={key} className="glass-input w-auto min-w-36"
            value={filters[key]} onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}>
            <option value="">{placeholder}</option>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-3'} glass-card-flat overflow-hidden`}>
          <table className="glass-table">
            <thead><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {displayedFindings.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <AlertTriangle size={36} className="mx-auto mb-2 opacity-30" />No findings
                </td></tr>
              ) : displayedFindings.map(f => (
                <tr key={f.id} onClick={() => setSelected(f)} className="cursor-pointer"
                  style={{ background: selected?.id === f.id ? 'rgba(74,159,212,0.06)' : '' }}>
                  <td>
                    <div className="font-medium text-white text-sm line-clamp-1">{f.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.domain?.replace(/_/g, ' ')}</div>
                  </td>
                  <td><span className={`badge ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>{f.severity}</span></td>
                  <td><span className="badge badge-gray text-xs">{f.status?.replace(/_/g, ' ')}</span></td>
                  <td className="text-xs" style={{ color: new Date(f.target_date) < new Date() && f.status !== 'closed' ? '#f87171' : 'var(--text-muted)' }}>
                    {f.target_date ? new Date(f.target_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="glass-card-flat p-5 space-y-4">
            <div className="flex items-start justify-between">
              <span className={`badge ${selected.severity === 'high' ? 'badge-red' : 'badge-amber'}`}>{selected.severity}</span>
              <button onClick={() => setSelected(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Close ×</button>
            </div>
            <div>
              <div className="font-medium text-white">{selected.title}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{selected.finding_ref}</div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
            {selected.is_regulatory && (
              <div className="badge badge-amber">{selected.regulatory_ref} — Regulatory</div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Status</span><span className="text-white">{selected.status?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Domain</span><span className="text-white">{selected.domain?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Due</span>
                <span style={{ color: new Date(selected.target_date) < new Date() && selected.status !== 'closed' ? '#f87171' : 'white' }}>
                  {selected.target_date ? new Date(selected.target_date).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>
            </div>
            {selected.evidence_notes && (
              <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                <div className="font-medium text-white mb-1">Evidence Notes</div>
                {selected.evidence_notes}
              </div>
            )}
            {selected.status !== 'closed' && SEV_NEXT_STATUS[selected.status] && (
              <div className="space-y-2">
                {selected.status === 'in_progress' && (
                  <textarea className="glass-input text-xs h-16 resize-none" placeholder="Evidence notes..."
                    onChange={e => setSelected(prev => ({ ...prev, _evidence: e.target.value }))} />
                )}
                <button className="btn-primary w-full text-sm"
                  onClick={() => updateFinding(selected.id, { status: SEV_NEXT_STATUS[selected.status], evidence_notes: selected._evidence })}>
                  Move to: {SEV_NEXT_STATUS[selected.status]?.replace(/_/g, ' ')}
                </button>
              </div>
            )}
            {selected.status === 'closed' && (
              <div className="text-center py-2 text-sm" style={{ color: '#4ade80' }}>✓ Closed</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
