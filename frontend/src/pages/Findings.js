import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, ChevronRight } from 'lucide-react';
import api from '../utils/api';

export default function Findings() {
  const [findings, setFindings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ severity: '', status: '', domain: '' });
  const [selected, setSelected] = useState(null);
  const [activeVendor, setActiveVendor] = useState('__all__');

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

  // Build unique vendor list from findings
  const vendorMap = {};
  findings.forEach(f => {
    if (!f.vendor_name) return;
    if (!vendorMap[f.vendor_name]) vendorMap[f.vendor_name] = { name: f.vendor_name, total: 0, high: 0, medium: 0 };
    vendorMap[f.vendor_name].total++;
    if (f.severity === 'high') vendorMap[f.vendor_name].high++;
    if (f.severity === 'medium') vendorMap[f.vendor_name].medium++;
  });
  const vendors = Object.values(vendorMap);

  const displayedFindings = activeVendor === '__all__'
    ? findings
    : findings.filter(f => f.vendor_name === activeVendor);

  const allHigh = findings.filter(f => f.severity === 'high').length;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Findings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track and remediate compliance gaps</p>
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

      {/* ── Vendor Tabs ── */}
      {!loading && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Filter by Vendor
          </div>
          <div className="flex flex-wrap gap-2">
            {/* All Vendors button */}
            <button
              onClick={() => setActiveVendor('__all__')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: activeVendor === '__all__' ? '1.5px solid #38bdf8' : '1.5px solid rgba(255,255,255,0.1)',
                background: activeVendor === '__all__' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                color: activeVendor === '__all__' ? '#7dd3fc' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: activeVendor === '__all__' ? '600' : '400',
              }}
            >
              <span>All Vendors</span>
              <span style={{
                background: allHigh > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.1)',
                color: allHigh > 0 ? '#f87171' : 'var(--text-muted)',
                borderRadius: '20px', padding: '1px 8px', fontSize: '12px', fontWeight: '600'
              }}>{findings.length}</span>
            </button>

            {/* One button per vendor */}
            {vendors.map(v => {
              const isActive = activeVendor === v.name;
              return (
                <button
                  key={v.name}
                  onClick={() => setActiveVendor(v.name)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: isActive ? '1.5px solid #38bdf8' : '1.5px solid rgba(255,255,255,0.1)',
                    background: isActive ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#7dd3fc' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  <Building2 size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <span>{v.name}</span>
                  <span style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-muted)',
                    borderRadius: '20px', padding: '1px 8px', fontSize: '12px', fontWeight: '600'
                  }}>{v.total}</span>
                  {v.high > 0 && (
                    <span style={{
                      background: 'rgba(248,113,113,0.2)', color: '#f87171',
                      borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: '700'
                    }}>{v.high} HIGH</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active vendor label */}
          {activeVendor !== '__all__' && (
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <ChevronRight size={14} />
              <span>Showing findings for <strong style={{ color: '#7dd3fc' }}>{activeVendor}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>({displayedFindings.length} finding{displayedFindings.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
      )}

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
        {/* Findings table */}
        <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-3'} glass-card-flat overflow-hidden`}>
          <table className="glass-table">
            <thead><tr><th>Finding</th><th>Severity</th><th>Vendor</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">
                  <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : displayedFindings.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
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
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.vendor_name}</td>
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
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Vendor</span><span className="text-white">{selected.vendor_name}</span></div>
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
                  <textarea
                    className="glass-input text-xs h-16 resize-none"
                    placeholder="Evidence notes..."
                    onChange={e => setSelected(prev => ({ ...prev, _evidence: e.target.value }))}
                  />
                )}
                <button
                  className="btn-primary w-full text-sm"
                  onClick={() => updateFinding(selected.id, {
                    status: SEV_NEXT_STATUS[selected.status],
                    evidence_notes: selected._evidence
                  })}
                >
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
