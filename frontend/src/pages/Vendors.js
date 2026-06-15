import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ChevronRight, Building2 } from 'lucide-react';
import api from '../utils/api';

const CATEGORY_LABELS = {
  technology_cloud: 'Tech & Cloud',
  it_products_software: 'IT Products',
  financial_fintech: 'Financial & Fintech',
  outsourcing_data: 'Outsourcing & Data',
  professional_services: 'Professional Services',
  facilities_operations: 'Facilities & Ops'
};

const STATUS_LABELS = {
  intake_received: 'Intake',
  under_classification: 'Classification',
  under_due_diligence: 'Due Diligence',
  under_assessment: 'Assessment',
  pending_approval: 'Pending Approval',
  active: 'Active',
  under_review: 'Under Review',
  renewal_pending: 'Renewal Pending',
  suspended: 'Suspended',
  offboarding_initiated: 'Offboarding',
  offboarded: 'Offboarded',
  rejected: 'Rejected'
};

const STATUS_BADGE = {
  active: 'badge-green', pending_approval: 'badge-amber', suspended: 'badge-red',
  offboarding_initiated: 'badge-red', under_due_diligence: 'badge-purple',
  under_assessment: 'badge-blue', intake_received: 'badge-gray',
  renewal_pending: 'badge-amber', rejected: 'badge-red', under_review: 'badge-blue'
};

const HEALTH_DOT = { green: 'dot-green', amber: 'dot-amber', red: 'dot-red' };
const CRIT_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-green' };

export default function Vendors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    category: '',
    criticality: '',
    health_status: ''
  });
  const [page, setPage] = useState(1);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15, ...filters });
      if (search) params.set('search', search);
      const data = await api.get(`/vendors?${params}`);
      setVendors(data.vendors);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const setFilter = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Vendors</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{total} vendors in registry</p>
        </div>
        <Link to="/vendors/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add Vendor
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card-flat p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="glass-input pl-9"
            placeholder="Search vendors..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {[
          { key: 'status', options: Object.entries(STATUS_LABELS), placeholder: 'All Statuses' },
          { key: 'category', options: Object.entries(CATEGORY_LABELS), placeholder: 'All Categories' },
          { key: 'criticality', options: [['high','High'],['medium','Medium'],['low','Low']], placeholder: 'All Criticality' },
          { key: 'health_status', options: [['green','Green'],['amber','Amber'],['red','Red']], placeholder: 'All Health' },
        ].map(({ key, options, placeholder }) => (
          <select
            key={key}
            className="glass-input w-auto min-w-36"
            value={filters[key]}
            onChange={e => setFilter(key, e.target.value)}
          >
            <option value="">{placeholder}</option>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {Object.values(filters).some(Boolean) && (
          <button className="btn-glass text-sm" onClick={() => { setFilters({ status: '', category: '', criticality: '', health_status: '' }); setPage(1); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Criticality</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Health</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                  No vendors found
                </td></tr>
              ) : vendors.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium text-white">{v.name}</div>
                    {v.legal_name && v.legal_name !== v.name && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{v.legal_name}</div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-gray">{CATEGORY_LABELS[v.category] || '—'}</span>
                  </td>
                  <td>
                    {v.criticality ? <span className={`badge ${CRIT_BADGE[v.criticality]}`}>{v.criticality}</span> : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[v.status] || 'badge-gray'}`}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                  </td>
                  <td>
                    {v.overall_risk_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${v.overall_risk_score}%`,
                            background: v.overall_risk_score >= 80 ? '#4ade80' : v.overall_risk_score >= 50 ? '#fbbf24' : '#f87171'
                          }} />
                        </div>
                        <span className="text-sm">{v.overall_risk_score}%</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <div className={HEALTH_DOT[v.health_status] || 'dot-green'} />
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{v.owner_name || '—'}</td>
                  <td>
                    <Link to={`/vendors/${v.id}`} className="btn-glass py-1.5 px-3 flex items-center gap-1 text-xs">
                      View <ChevronRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button className="btn-glass py-1.5 px-3 text-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-glass py-1.5 px-3 text-sm" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
