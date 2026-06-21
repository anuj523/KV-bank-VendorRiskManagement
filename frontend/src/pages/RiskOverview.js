import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ChevronRight, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../utils/api';

export default function RiskOverview() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | scored | unscored | high | medium | low

  useEffect(() => {
    api.get('/vendors?limit=100')
      .then(data => setVendors(data.vendors || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = vendors.filter(v => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'scored' ? v.overall_risk_score != null :
      filter === 'unscored' ? v.overall_risk_score == null :
      filter === v.risk_rating;
    return matchSearch && matchFilter;
  });

  const scored = vendors.filter(v => v.overall_risk_score != null);
  const unscored = vendors.filter(v => v.overall_risk_score == null);
  const highRisk = vendors.filter(v => v.risk_rating === 'high');
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, v) => sum + parseFloat(v.overall_risk_score), 0) / scored.length)
    : null;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Risk Scoring</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Select a vendor to view or fill their risk questionnaire
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Vendors', value: vendors.length, color: '#60a5fa', onClick: () => setFilter('all') },
          { label: 'Scored', value: scored.length, color: '#4ade80', onClick: () => setFilter('scored') },
          { label: 'Not Yet Scored', value: unscored.length, color: '#fbbf24', onClick: () => setFilter('unscored') },
          { label: 'High Risk', value: highRisk.length, color: '#f87171', onClick: () => setFilter('high') },
        ].map(({ label, value, color, onClick }) => (
          <button key={label} onClick={onClick}
            className="glass-card p-5 text-left hover:border-white/20 transition-all">
            <div className="text-2xl font-bold font-display" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </button>
        ))}
      </div>

      {avgScore != null && (
        <div className="glass-card-flat p-5 flex items-center gap-6">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Portfolio Average Score</div>
            <div className="text-4xl font-bold font-display" style={{ color: avgScore >= 80 ? '#4ade80' : avgScore >= 50 ? '#fbbf24' : '#f87171' }}>
              {avgScore}%
            </div>
          </div>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${avgScore}%`,
              background: avgScore >= 80 ? '#4ade80' : avgScore >= 50 ? '#fbbf24' : '#f87171'
            }} />
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {scored.length} of {vendors.length} vendors scored
          </div>
        </div>
      )}

      {/* Search and filter */}
      <div className="glass-card-flat p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="glass-input pl-9" placeholder="Search vendors..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="glass-input w-auto min-w-40" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Vendors</option>
          <option value="scored">Scored</option>
          <option value="unscored">Not Yet Scored</option>
          <option value="high">High Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="low">Low Risk</option>
        </select>
      </div>

      {/* Vendor list */}
      <div className="glass-card-flat overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Category</th>
              <th>Criticality</th>
              <th>Risk Score</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />
                No vendors found
              </td></tr>
            ) : filtered.map(v => {
              const hasScore = v.overall_risk_score != null;
              const scoreColor = !hasScore ? 'var(--text-muted)' :
                v.overall_risk_score >= 80 ? '#4ade80' :
                v.overall_risk_score >= 50 ? '#fbbf24' : '#f87171';

              return (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium text-white">{v.name}</div>
                    {v.legal_name && v.legal_name !== v.name && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{v.legal_name}</div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-gray text-xs">
                      {v.category?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td>
                    {v.criticality
                      ? <span className={`badge ${v.criticality === 'high' ? 'badge-red' : v.criticality === 'medium' ? 'badge-amber' : 'badge-green'}`}>{v.criticality}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {hasScore ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${v.overall_risk_score}%`, background: scoreColor }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: scoreColor }}>{v.overall_risk_score}%</span>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: '#fbbf24' }}>⚠ Not scored</span>
                    )}
                  </td>
                  <td>
                    {v.risk_rating ? (
                      <span className={`badge ${v.risk_rating === 'low' ? 'badge-green' : v.risk_rating === 'medium' ? 'badge-amber' : 'badge-red'}`}>
                        {v.risk_rating} risk
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className="badge badge-gray text-xs">{v.status?.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <Link to={`/risk/${v.id}`}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 w-fit">
                      {hasScore ? (
                        <><TrendingUp size={12} /> Re-score</>
                      ) : (
                        <><CheckCircle size={12} /> Score Now</>
                      )}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
