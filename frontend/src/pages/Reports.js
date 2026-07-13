import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, AlertTriangle, FileCheck, TrendingUp,
  LayoutDashboard, ScrollText, Download, Loader,
  ChevronRight, RefreshCw, LogOut
} from 'lucide-react';
import api from '../utils/api';

// ── Shared helpers ───────────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  technology_cloud: 'Technology & Cloud',
  it_products_software: 'IT Products & Software',
  financial_fintech: 'Financial & Fintech',
  outsourcing_data: 'Outsourcing & Data Processing',
  professional_services: 'Professional Services',
  facilities_operations: 'Facilities & Operations',
};

const CATEGORY_REQUIRED_DOCS = {
  technology_cloud: ['SOC 2 Type II Report','ISO 27001 Certificate','Penetration Test Report','Business Continuity Plan','Data Processing Agreement','Insurance Certificate','NDA / Confidentiality Agreement','VAPT Report'],
  it_products_software: ['SOC 2 Type II Report','Penetration Test Report','VAPT Report','ISO 27001 Certificate','Data Processing Agreement','Insurance Certificate','NDA / Confidentiality Agreement'],
  financial_fintech: ['SOC 2 Report','ISO 27001 Certificate','Penetration Test Report','Audited Financial Statements','Insurance Certificate','BCP / DR Plan','Data Processing Agreement','Regulatory Compliance Certificate','Sanctions / Adverse Media Screening'],
  outsourcing_data: ['Data Processing Agreement','ISO 27001 Certificate','SOC 2 Type II Report','Business Continuity Plan','Penetration Test Report','NDA / Confidentiality Agreement','Insurance Certificate','RBI Compliance Certificate'],
  professional_services: ['Insurance Certificate','NDA / Confidentiality Agreement','Company Registration','Financial Statements','Data Processing Agreement','ISO 27001 Certificate'],
  facilities_operations: ['Insurance Certificate','Company Registration','Business Continuity Plan','Financial Statements','NDA / Confidentiality Agreement'],
};

const scoreColor = (s) => s >= 80 ? '#4ade80' : s >= 50 ? '#fbbf24' : '#f87171';
const ratingBadge = (r) => {
  if (r === 'low') return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'rgba(74,222,128,0.25)' };
  if (r === 'medium') return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' };
  if (r === 'high') return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.3)' };
  return { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'rgba(255,255,255,0.1)' };
};

function Badge({ label, style: s }) {
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '600',
      textTransform: 'capitalize', whiteSpace: 'nowrap'
    }}>{label}</span>
  );
}

function exportCSV(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename;
  a.click();
}

function SectionHeader({ title, subtitle, onExport, loading }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {onExport && (
        <button onClick={onExport} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
          background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
          border: '1px solid rgba(56,189,248,0.25)', cursor: 'pointer'
        }}>
          <Download size={13} /> Export CSV
        </button>
      )}
    </div>
  );
}

// ── 1. Vendor Inventory ──────────────────────────────────────────────────────
function VendorInventory({ vendors }) {
  const doExport = () => exportCSV('vendor_inventory.csv',
    ['Vendor', 'Legal Name', 'Category', 'Criticality', 'Status', 'Contract Start', 'Contract End', 'Contract Value', 'Country'],
    vendors.map(v => [v.name, v.legal_name, CATEGORY_LABELS[v.category] || v.category, v.criticality, v.status,
      v.contract_start_date, v.contract_end_date, v.contract_value, v.incorporation_country])
  );
  return (
    <div>
      <SectionHeader title="Vendor Inventory" subtitle={`${vendors.length} vendors total`} onExport={doExport} />
      <div className="glass-card-flat overflow-x-auto">
        <table className="glass-table">
          <thead><tr><th>Vendor</th><th>Category</th><th>Criticality</th><th>Status</th><th>Contract End</th><th>Country</th></tr></thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id}>
                <td>
                  <div className="font-semibold text-white text-sm">{v.name}</div>
                  {v.legal_name && v.legal_name !== v.name && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.legal_name}</div>}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{CATEGORY_LABELS[v.category] || v.category || '—'}</td>
                <td>{v.criticality ? <Badge label={v.criticality} style={ratingBadge(v.criticality)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td><span className="badge badge-gray text-xs">{v.status?.replace(/_/g, ' ')}</span></td>
                <td style={{ fontSize: '13px', color: v.contract_end_date && new Date(v.contract_end_date) < new Date() ? '#f87171' : 'var(--text-secondary)' }}>
                  {v.contract_end_date ? new Date(v.contract_end_date).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{v.incorporation_country || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 2. Critical Vendor ───────────────────────────────────────────────────────
function CriticalVendor({ vendors }) {
  const critical = vendors.filter(v => v.criticality === 'high' || v.risk_rating === 'high' || parseInt(v.open_findings_count) > 5);
  const doExport = () => exportCSV('critical_vendors.csv',
    ['Vendor', 'Criticality', 'Risk Rating', 'Risk Score', 'Open Findings', 'Status'],
    critical.map(v => [v.name, v.criticality, v.risk_rating, v.overall_risk_score, v.open_findings_count, v.status])
  );
  return (
    <div>
      <SectionHeader title="Critical Vendor Report" subtitle={`${critical.length} vendors requiring attention`} onExport={doExport} />
      {critical.length === 0 ? (
        <div className="glass-card-flat p-12 text-center" style={{ color: 'var(--text-muted)' }}>
          <AlertTriangle size={36} className="mx-auto mb-2 opacity-30" />No critical vendors found
        </div>
      ) : (
        <div className="glass-card-flat overflow-x-auto">
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Criticality</th><th>Risk Rating</th><th>Risk Score</th><th>Open Findings</th><th>Status</th></tr></thead>
            <tbody>
              {critical.map(v => {
                const openF = parseInt(v.open_findings_count) || 0;
                return (
                  <tr key={v.id}>
                    <td className="font-semibold text-white text-sm">{v.name}</td>
                    <td>{v.criticality ? <Badge label={v.criticality} style={ratingBadge(v.criticality)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{v.risk_rating ? <Badge label={`${v.risk_rating} risk`} style={ratingBadge(v.risk_rating)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {v.overall_risk_score != null
                        ? <span style={{ color: scoreColor(v.overall_risk_score), fontWeight: '700' }}>{v.overall_risk_score}%</span>
                        : <span style={{ color: '#fbbf24', fontSize: '12px' }}>Not scored</span>}
                    </td>
                    <td><span style={{ fontWeight: '700', color: openF > 5 ? '#f87171' : openF > 0 ? '#fbbf24' : '#4ade80' }}>{openF}</span></td>
                    <td><span className="badge badge-gray text-xs">{v.status?.replace(/_/g, ' ')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 3. Risk Assessment ───────────────────────────────────────────────────────
function RiskAssessmentReport({ vendors }) {
  const scored = vendors.filter(v => v.overall_risk_score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, v) => s + parseFloat(v.overall_risk_score), 0) / scored.length) : null;
  const doExport = () => exportCSV('risk_assessment.csv',
    ['Vendor', 'Criticality', 'Inherent Score', 'Risk Score (Compliance %)', 'Residual Risk', 'Rating', 'Open Findings'],
    vendors.map(v => {
      const inh = v.criticality === 'high' ? 100 : v.criticality === 'medium' ? 70 : v.criticality === 'low' ? 40 : '';
      const res = v.overall_risk_score != null ? 100 - parseFloat(v.overall_risk_score) : '';
      return [v.name, v.criticality, inh, v.overall_risk_score, res, v.risk_rating, v.open_findings_count];
    })
  );
  return (
    <div className="space-y-4">
      <SectionHeader title="Risk Assessment Report" subtitle="Inherent vs residual risk across all vendors" onExport={doExport} />
      {avg != null && (
        <div className="glass-card-flat p-5 flex items-center gap-6">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Portfolio Average</div>
            <div className="text-3xl font-bold font-display" style={{ color: scoreColor(avg) }}>{avg}%</div>
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${avg}%`, background: scoreColor(avg) }} />
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{scored.length} of {vendors.length} scored</div>
        </div>
      )}
      <div className="glass-card-flat overflow-x-auto">
        <table className="glass-table">
          <thead><tr><th>Vendor</th><th>Criticality</th><th>Inherent</th><th>Residual</th><th>Rating</th><th>Open Findings</th></tr></thead>
          <tbody>
            {vendors.map(v => {
              const inherent = v.criticality === 'high' ? 100 : v.criticality === 'medium' ? 70 : v.criticality === 'low' ? 40 : null;
              const residual = v.overall_risk_score != null ? Math.round(100 - parseFloat(v.overall_risk_score)) : null;
              const openF = parseInt(v.open_findings_count) || 0;
              return (
                <tr key={v.id}>
                  <td className="font-semibold text-white text-sm">{v.name}</td>
                  <td>{v.criticality ? <Badge label={v.criticality} style={ratingBadge(v.criticality)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>{inherent != null ? <span style={{ fontWeight: '700', color: inherent >= 80 ? '#f87171' : inherent >= 60 ? '#fbbf24' : '#4ade80' }}>{inherent}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>{residual != null ? <span style={{ fontWeight: '700', color: residual >= 50 ? '#f87171' : residual >= 25 ? '#fbbf24' : '#4ade80' }}>{residual}</span> : <span style={{ color: '#fbbf24', fontSize: '12px' }}>Not scored</span>}</td>
                  <td>{v.risk_rating ? <Badge label={`${v.risk_rating} risk`} style={ratingBadge(v.risk_rating)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><span style={{ fontWeight: '700', color: openF > 10 ? '#f87171' : openF > 0 ? '#fbbf24' : '#4ade80' }}>{openF}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 4. Due Diligence ─────────────────────────────────────────────────────────
function DueDiligence({ vendors, docsByVendor, docsLoading }) {
  const rows = vendors.map(v => {
    const docs = docsByVendor[v.id] || [];
    const required = CATEGORY_REQUIRED_DOCS[v.category] || [];
    const approved = docs.filter(d => d.status === 'approved');
    const valid = required.filter(name =>
      approved.find(d => d.document_type?.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(d.document_type?.toLowerCase()))
    ).length;
    const expired = docs.filter(d => d.valid_until && new Date(d.valid_until) < new Date()).length;
    const expiring = docs.filter(d => {
      if (!d.valid_until) return false;
      const days = Math.ceil((new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    }).length;
    const missing = Math.max(0, required.length - valid);
    return { vendor: v, required: required.length, valid, missing, expired, expiring };
  });

  const doExport = () => exportCSV('due_diligence.csv',
    ['Vendor', 'Category', 'Required', 'Valid', 'Missing', 'Expired', 'Expiring Soon'],
    rows.map(r => [r.vendor.name, CATEGORY_LABELS[r.vendor.category] || r.vendor.category, r.required, r.valid, r.missing, r.expired, r.expiring])
  );

  return (
    <div>
      <SectionHeader title="Due Diligence Report" subtitle="Document compliance status across all vendors" onExport={doExport} />
      {docsLoading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin" style={{ color: '#38bdf8' }} />
        </div>
      ) : (
        <div className="glass-card-flat overflow-x-auto">
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Category</th><th>Required</th><th>Valid</th><th>Missing</th><th>Expired</th><th>Expiring Soon</th><th>Compliance</th></tr></thead>
            <tbody>
              {rows.map(({ vendor: v, required, valid, missing, expired, expiring }) => {
                const pct = required > 0 ? Math.round((valid / required) * 100) : 0;
                return (
                  <tr key={v.id}>
                    <td className="font-semibold text-white text-sm">{v.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{CATEGORY_LABELS[v.category] || v.category || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{required || '—'}</td>
                    <td><span style={{ color: '#4ade80', fontWeight: '700' }}>{valid}</span></td>
                    <td><span style={{ color: missing > 0 ? '#f87171' : '#4ade80', fontWeight: '700' }}>{missing}</span></td>
                    <td><span style={{ color: expired > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: '700' }}>{expired || '—'}</span></td>
                    <td><span style={{ color: expiring > 0 ? '#fbbf24' : 'var(--text-muted)', fontWeight: '700' }}>{expiring || '—'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(pct), borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: scoreColor(pct) }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 5. Board Summary ─────────────────────────────────────────────────────────
function BoardSummary({ vendors, findingsStats, expiryStats }) {
  const scored = vendors.filter(v => v.overall_risk_score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, v) => s + parseFloat(v.overall_risk_score), 0) / scored.length) : null;
  const highRisk = vendors.filter(v => v.risk_rating === 'high').length;
  const highCrit = vendors.filter(v => v.criticality === 'high').length;
  const active = vendors.filter(v => v.status === 'active').length;

  const kpis = [
    { label: 'Total Vendors', value: vendors.length, color: '#60a5fa' },
    { label: 'Active Vendors', value: active, color: '#4ade80' },
    { label: 'High Criticality', value: highCrit, color: '#f87171' },
    { label: 'High Risk', value: highRisk, color: '#f87171' },
    { label: 'Portfolio Avg Score', value: avg != null ? `${avg}%` : 'N/A', color: avg != null ? scoreColor(avg) : 'var(--text-muted)' },
    { label: 'High Severity Findings', value: findingsStats?.by_severity?.find(s => s.severity === 'high')?.count || 0, color: '#f87171' },
    { label: 'Overdue Findings', value: findingsStats?.overdue || 0, color: '#fbbf24' },
    { label: 'Expired Documents', value: expiryStats?.expired?.length || 0, color: '#f87171' },
    { label: 'Expiring Docs (30d)', value: expiryStats?.expiring_soon?.length || 0, color: '#fbbf24' },
  ];

  const byStatus = {};
  vendors.forEach(v => { byStatus[v.status] = (byStatus[v.status] || 0) + 1; });
  const byRating = {};
  vendors.forEach(v => { if (v.risk_rating) byRating[v.risk_rating] = (byRating[v.risk_rating] || 0) + 1; });

  return (
    <div className="space-y-6">
      <SectionHeader title="Board Summary" subtitle={`Portfolio snapshot — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="glass-card-flat p-4">
            <div className="text-2xl font-bold font-display" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card-flat p-5">
          <div className="font-semibold text-white mb-4 text-sm">Vendor Pipeline</div>
          <div className="space-y-2">
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {status.replace(/_/g, ' ')}
                </div>
                <div style={{ width: `${Math.round((count / vendors.length) * 120)}px`, height: '6px', background: 'rgba(56,189,248,0.3)', borderRadius: '3px', minWidth: '20px' }} />
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'white', minWidth: '24px', textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card-flat p-5">
          <div className="font-semibold text-white mb-4 text-sm">Risk Distribution</div>
          {Object.keys(byRating).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No vendors scored yet</div>
          ) : (
            <div className="space-y-2">
              {['low', 'medium', 'high'].filter(r => byRating[r]).map(r => {
                const rs = ratingBadge(r);
                return (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, fontSize: '13px', color: rs.color, textTransform: 'capitalize', fontWeight: '600' }}>{r} Risk</div>
                    <div style={{ width: `${Math.round(((byRating[r] || 0) / vendors.length) * 120)}px`, height: '6px', background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: '3px', minWidth: '20px' }} />
                    <div style={{ fontSize: '13px', fontWeight: '700', color: rs.color, minWidth: '24px', textAlign: 'right' }}>{byRating[r] || 0}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 6. Audit Trail ───────────────────────────────────────────────────────────
function AuditTrailReport({ auditLogs, auditLoading }) {
  const doExport = () => exportCSV('audit_trail.csv',
    ['Timestamp', 'Action', 'Vendor', 'Entity Type', 'Performed By', 'Role'],
    auditLogs.map(a => [
      new Date(a.created_at).toLocaleString('en-IN'),
      a.action, a.vendor_name, a.entity_type,
      a.user_name || a.vendor_user_name || 'System', a.user_role
    ])
  );

  const actionColor = (action) => {
    if (action?.includes('deleted') || action?.includes('rejected')) return '#f87171';
    if (action?.includes('approved') || action?.includes('completed') || action?.includes('active')) return '#4ade80';
    if (action?.includes('warning') || action?.includes('escalat')) return '#fbbf24';
    return '#60a5fa';
  };

  return (
    <div>
      <SectionHeader title="Audit Trail" subtitle={`${auditLogs.length} recent actions`} onExport={!auditLoading ? doExport : null} />
      {auditLoading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin" style={{ color: '#38bdf8' }} />
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="glass-card-flat p-12 text-center" style={{ color: 'var(--text-muted)' }}>
          <ScrollText size={36} className="mx-auto mb-2 opacity-30" />No audit logs found
        </div>
      ) : (
        <div className="glass-card-flat overflow-x-auto">
          <table className="glass-table">
            <thead><tr><th>Timestamp</th><th>Action</th><th>Vendor</th><th>Entity</th><th>Performed By</th></tr></thead>
            <tbody>
              {auditLogs.map((a, i) => (
                <tr key={a.id || i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span style={{ color: actionColor(a.action), fontWeight: '600', fontSize: '13px' }}>
                      {a.action?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{a.vendor_name || '—'}</td>
                  <td><span className="badge badge-gray text-xs">{a.entity_type}</span></td>
                  <td>
                    <div style={{ fontSize: '13px', color: 'white' }}>{a.user_name || a.vendor_user_name || 'System'}</div>
                    {a.user_role && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.user_role.replace(/_/g, ' ')}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ── 7. Offboarding History ────────────────────────────────────────────────────
function OffboardingHistory({ vendors }) {
  const offboarded = vendors.filter(v => v.status === 'offboarded');
  const active = vendors.filter(v => v.status === 'offboarding_initiated');

  const doExport = () => exportCSV('offboarding_history.csv',
    ['Vendor', 'Category', 'Criticality', 'Last Risk Rating', 'Status', 'Last Updated'],
    [...active, ...offboarded].map(v => [v.name, v.category?.replace(/_/g,' '), v.criticality, v.risk_rating, v.status, v.updated_at])
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Offboarding History" subtitle={`${active.length} in progress · ${offboarded.length} archived`} onExport={doExport} />

      {active.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#f87171' }}>In Progress</div>
          <div className="glass-card-flat overflow-x-auto">
            <table className="glass-table">
              <thead><tr><th>Vendor</th><th>Category</th><th>Criticality</th><th>Last Risk Rating</th><th>Started</th></tr></thead>
              <tbody>
                {active.map(v => (
                  <tr key={v.id}>
                    <td className="font-semibold text-white text-sm">{v.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{v.category?.replace(/_/g,' ') || '—'}</td>
                    <td>{v.criticality ? <Badge label={v.criticality} style={ratingBadge(v.criticality)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{v.risk_rating ? <Badge label={`${v.risk_rating} risk`} style={ratingBadge(v.risk_rating)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{v.updated_at ? new Date(v.updated_at).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4ade80' }}>Archived</div>
        {offboarded.length === 0 ? (
          <div className="glass-card-flat p-10 text-center" style={{ color: 'var(--text-muted)' }}>No archived vendors yet</div>
        ) : (
          <div className="glass-card-flat overflow-x-auto">
            <table className="glass-table">
              <thead><tr><th>Vendor</th><th>Category</th><th>Criticality</th><th>Last Risk Rating</th><th>Offboarded On</th></tr></thead>
              <tbody>
                {offboarded.map(v => (
                  <tr key={v.id}>
                    <td className="font-semibold text-white text-sm">{v.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{v.category?.replace(/_/g,' ') || '—'}</td>
                    <td>{v.criticality ? <Badge label={v.criticality} style={ratingBadge(v.criticality)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{v.risk_rating ? <Badge label={`${v.risk_rating} risk`} style={ratingBadge(v.risk_rating)} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{v.updated_at ? new Date(v.updated_at).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
const REPORTS = [
  { id: 'inventory',     label: 'Vendor Inventory',    subtitle: 'Operational',      icon: Building2 },
  { id: 'critical',      label: 'Critical Vendor',      subtitle: 'Risk / Management', icon: AlertTriangle },
  { id: 'risk',          label: 'Risk Assessment',      subtitle: 'Risk Team',         icon: TrendingUp },
  { id: 'due_diligence', label: 'Due Diligence',        subtitle: 'Risk / Audit',      icon: FileCheck },
  { id: 'board',         label: 'Board Summary',        subtitle: 'Leadership / Board',icon: LayoutDashboard },
  { id: 'audit',         label: 'Audit Trail',          subtitle: 'Audit / Regulator', icon: ScrollText },
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState('inventory');
  const [vendors, setVendors] = useState([]);
  const [findingsStats, setFindingsStats] = useState(null);
  const [expiryStats, setExpiryStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [docsByVendor, setDocsByVendor] = useState({});
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [v, fs, es] = await Promise.all([
        api.get('/vendors?limit=100'),
        api.get('/findings/stats/summary'),
        api.get('/documents/expiry/summary'),
      ]);
      setVendors(v.vendors || []);
      setFindingsStats(fs);
      setExpiryStats(es);
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  // Load audit logs lazily when that tab is selected
  const loadAudit = useCallback(async () => {
    if (auditLogs.length > 0) return;
    setAuditLoading(true);
    try {
      const data = await api.get('/vendors/audit/global?limit=200');
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); setAuditLogs([]); }
    finally { setAuditLoading(false); }
  }, [auditLogs.length]);

  // Load docs per vendor lazily when Due Diligence tab is selected
  const loadDocs = useCallback(async (vendorList) => {
    if (Object.keys(docsByVendor).length > 0) return;
    setDocsLoading(true);
    try {
      const results = await Promise.all(vendorList.map(v =>
        api.get(`/documents/vendor/${v.id}`).then(d => ({ id: v.id, docs: Array.isArray(d) ? d : d.documents || [] })).catch(() => ({ id: v.id, docs: [] }))
      ));
      const map = {};
      results.forEach(({ id, docs }) => { map[id] = docs; });
      setDocsByVendor(map);
    } catch (err) { console.error(err); }
    finally { setDocsLoading(false); }
  }, [docsByVendor]);

  useEffect(() => { loadBase(); }, [loadBase]);

  useEffect(() => {
    if (activeReport === 'audit') loadAudit();
    if (activeReport === 'due_diligence' && vendors.length > 0) loadDocs(vendors);
  }, [activeReport, vendors, loadAudit, loadDocs]);

  return (
    <div className="flex gap-0 animate-in" style={{ minHeight: '100%' }}>
      {/* Left panel */}
      <div style={{
        width: '220px', flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 12px',
      }}>
        <div className="mb-4 px-2">
          <h1 className="font-display text-lg font-bold text-white">Reports</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Portfolio intelligence</p>
        </div>
        <div className="space-y-1">
          {REPORTS.map(({ id, label, subtitle, icon: Icon }) => {
            const isActive = activeReport === id;
            return (
              <button key={id} onClick={() => setActiveReport(id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'rgba(56,189,248,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(56,189,248,0.25)' : '1px solid transparent',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={15} style={{ color: isActive ? '#38bdf8' : 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: isActive ? '600' : '400', color: isActive ? '#7dd3fc' : 'var(--text-secondary)', lineHeight: 1.3 }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{subtitle}</div>
                </div>
                {isActive && <ChevronRight size={12} style={{ color: '#38bdf8', marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
        {lastRefresh && (
          <div className="mt-6 px-2">
            <button onClick={() => { loadBase(); setDocsByVendor({}); setAuditLogs([]); }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none' }}>
              <RefreshCw size={11} /> Refresh data
            </button>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {lastRefresh.toLocaleTimeString('en-IN')}
            </div>
          </div>
        )}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeReport === 'inventory'     && <VendorInventory vendors={vendors} />}
            {activeReport === 'critical'      && <CriticalVendor vendors={vendors} />}
            {activeReport === 'risk'          && <RiskAssessmentReport vendors={vendors} />}
            {activeReport === 'due_diligence' && <DueDiligence vendors={vendors} docsByVendor={docsByVendor} docsLoading={docsLoading} />}
            {activeReport === 'board'         && <BoardSummary vendors={vendors} findingsStats={findingsStats} expiryStats={expiryStats} />}
            {activeReport === 'audit'         && <AuditTrailReport auditLogs={auditLogs} auditLoading={auditLoading} />}
            {activeReport === 'offboarding'    && <OffboardingHistory vendors={vendors} />}
          </>
        )}
      </div>
    </div>
  );
}
