import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ChevronRight, Search } from 'lucide-react';
import api from '../utils/api';

// Criticality score: maps criticality label → numeric inherent score (0–100)
const CRITICALITY_SCORE = { high: 100, medium: 70, low: 40 };

// Residual = overall_risk_score inverted: high compliance = low residual risk
const residualScore = (v) => {
  if (v.overall_risk_score == null) return null;
  // overall_risk_score is compliance % (higher = better), so residual risk = 100 - score
  return Math.round(100 - parseFloat(v.overall_risk_score));
};

const inherentScore = (v) => {
  if (v.criticality) return CRITICALITY_SCORE[v.criticality] ?? null;
  return null;
};

const ratingStyle = (rating) => {
  if (!rating) return { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'rgba(255,255,255,0.1)' };
  if (rating === 'low') return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'rgba(74,222,128,0.25)' };
  if (rating === 'medium') return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' };
  return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.3)' };
};

const criticalityStyle = (c, score) => {
  if (!c) return { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'rgba(255,255,255,0.1)' };
  if (c === 'high') return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.3)' };
  if (c === 'medium') return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' };
  return { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' };
};

export default function RiskOverview() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

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
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, v) => sum + parseFloat(v.overall_risk_score), 0) / scored.length)
    : null;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Risk Assessment</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Inherent and residual risk across all vendors
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Vendors', value: vendors.length, color: '#60a5fa', f: 'all' },
          { label: 'Scored', value: scored.length, color: '#4ade80', f: 'scored' },
          { label: 'Not Yet Scored', value: vendors.length - scored.length, color: '#fbbf24', f: 'unscored' },
          { label: 'High Risk', value: vendors.filter(v => v.risk_rating === 'high').length, color: '#f87171', f: 'high' },
        ].map(({ label, value, color, f }) => (
          <button key={label} onClick={() => setFilter(f)}
            className="glass-card p-5 text-left hover:border-white/20 transition-all">
            <div className="text-2xl font-bold font-display" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Portfolio average */}
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

      {/* Search + filter */}
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

      {/* Vendor table */}
      <div className="glass-card-flat overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Criticality</th>
              <th>Inherent</th>
              <th>Residual</th>
              <th>Rating</th>
              <th>Open Findings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />No vendors found
              </td></tr>
            ) : filtered.map(v => {
              const inherent = inherentScore(v);
              const residual = residualScore(v);
              const rating = v.risk_rating;
              const rs = ratingStyle(rating);
              const cs = criticalityStyle(v.criticality, inherent);
              const openFindings = parseInt(v.open_findings_count) || 0;

              return (
                <tr key={v.id}>
                  {/* Vendor name */}
                  <td>
                    <div className="font-semibold text-white">{v.name}</div>
                    {v.legal_name && v.legal_name !== v.name && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{v.legal_name}</div>
                    )}
                  </td>

                  {/* Criticality */}
                  <td>
                    {v.criticality ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`,
                        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700',
                        textTransform: 'capitalize'
                      }}>
                        {v.criticality} {inherent != null && `(${inherent})`}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  {/* Inherent score */}
                  <td>
                    {inherent != null ? (
                      <span className="font-semibold text-sm" style={{ color: inherent >= 80 ? '#f87171' : inherent >= 60 ? '#fbbf24' : '#4ade80' }}>
                        {inherent}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  {/* Residual score */}
                  <td>
                    {residual != null ? (
                      <span className="font-semibold text-sm" style={{ color: residual >= 50 ? '#f87171' : residual >= 25 ? '#fbbf24' : '#4ade80' }}>
                        {residual}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>⚠ Not scored</span>}
                  </td>

                  {/* Rating */}
                  <td>
                    {rating ? (
                      <span style={{
                        background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`,
                        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {rating}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>

                  {/* Open findings */}
                  <td>
                    <span style={{
                      fontWeight: '700', fontSize: '14px',
                      color: openFindings > 10 ? '#f87171' : openFindings > 0 ? '#fbbf24' : '#4ade80'
                    }}>
                      {openFindings}
                    </span>
                  </td>

                  {/* Action */}
                  <td>
                    <Link to={`/risk/${v.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                        background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
                        border: '1px solid rgba(56,189,248,0.25)',
                        textDecoration: 'none', whiteSpace: 'nowrap'
                      }}>
                      {v.overall_risk_score != null ? 'Re-assess' : 'Assess'}
                      <ChevronRight size={13} />
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
