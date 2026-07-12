import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
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
      const params = new URLSearchParams({ limit: 200, ...filters });
      const [data, s] = await Promise.all([
        api.get(`/findings?${params}`),
        api.get('/findings/stats/summary')
      ]);
      setFindings(data.findings);
      setStats(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchFindings(); }, [fetchFindings]);

  // Reset selected finding when vendor tab changes
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

  // Build vendor list preserving insertion order
  const vendorMap = {};
  findings.forEach(f => {
    if (f.vendor_name && !vendorMap[f.vendor_name]) {
      vendorMap[f.vendor_name] = { name: f.vendor_name, count: 0, high: 0 };
    }
    if (f.vendor_name) {
      vendorMap[f.vendor_name].count++;
      if (f.severity === 'high') vendorMap[f.vendor_name].high++;
    }
  });
  const vendors = Object.values(vendorMap);

  const displayedFindings = activeVendor === '__all__'
    ? findings
    : findings.filter(f => f.vendor_name === activeVendor);

  const tabs = [
    { key: '__all__', label: 'All Vendors', count: findings.length, high: findings.filter(f => f.severity === 'high').length },
    ...vendors.map(v => ({ key: v.name, label: v.name, count: v.count, high: v.high }))
  ];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Findings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track and remediate compliance gaps</p>
      </div>

      {/* Stats row */}
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

      {/* Vendor Tabs */}
      {!loading && vendors.length > 0 && (
        <div className="glass-card-flat p-1 flex flex-wrap gap-1">
          {tabs.map(tab => {
            const isActive = activeVendor === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveVendor(tab.key)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(74,159,212,0.18)' : 'transparent',
                  color: isActive ? '#7dd3fc' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(74,159,212,0.35)' : '1px solid transparent',
                }}
              >
                {tab.key !== '__all__' && <Building2 size={13} style={{ opacity: 0.7 }} />}
                <span>{tab.label}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: tab.high > 0 ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.07)',
                    color: tab.high > 0 ? '#f87171' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
                {tab.high > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(248,113,113,0.18)', color: '#f87171' }}>
                    {tab.high} HIGH
                  </span>
                )}
              </button>
            );
          })}
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
        {activeVendor !== '__all__' && (
          <div className="flex items-center gap-2 ml-auto text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Building2 size={14} />
            <span>Showing: <strong style={{ color: '#7dd3fc' }}>{activeVendor}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>— {displayedFindings.length} finding{displayedFindings.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* List */}
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
