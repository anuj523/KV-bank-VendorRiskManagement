import React, { useState, useEffect } from 'react';
import { FileCheck, Clock, AlertTriangle, CheckCircle, Building2, ChevronRight, ArrowLeft, FileText, Eye } from 'lucide-react';
import api from '../utils/api';

export default function Documents() {
  const [expiry, setExpiry] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVendor, setActiveVendor] = useState(null); // null = vendor list
  const [vendorDocs, setVendorDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/documents/expiry/summary'),
      api.get('/vendors?limit=100'),
    ])
      .then(([exp, vend]) => {
        setExpiry(exp);
        setVendors(vend.vendors || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openVendor = async (vendor) => {
    setActiveVendor(vendor);
    setDocsLoading(true);
    try {
      const data = await api.get(`/documents/vendor/${vendor.id}`);
      setVendorDocs(data.documents || data || []);
    } catch (err) { console.error(err); setVendorDocs([]); }
    finally { setDocsLoading(false); }
  };

  const reviewDoc = async (docId, status) => {
    try {
      await api.patch(`/documents/${docId}/review`, { status });
      setVendorDocs(prev => prev.map(d => d.id === docId ? { ...d, review_status: status } : d));
    } catch (err) { alert(err.message); }
  };

  const statusColor = (s) => {
    if (s === 'approved') return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'rgba(74,222,128,0.25)' };
    if (s === 'rejected') return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.25)' };
    return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );

  // ── VENDOR LIST VIEW ──
  if (!activeVendor) {
    return (
      <div className="space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Documents</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Select a vendor to view their documents</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Pending Review', count: expiry?.pending_review || 0, color: '#a78bfa', icon: FileCheck },
            { label: 'Expiring in 30 Days', count: expiry?.expiring_soon?.length || 0, color: '#fbbf24', icon: Clock },
            { label: 'Expired', count: expiry?.expired?.length || 0, color: '#f87171', icon: AlertTriangle },
          ].map(({ label, count, color, icon: Icon }) => (
            <div key={label} className="glass-card-flat p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={18} style={{ color }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
              <div className="text-3xl font-bold font-display" style={{ color }}>{count}</div>
            </div>
          ))}
        </div>

        {/* Vendor rows */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Vendors
          </div>
          <div className="space-y-2">
            {vendors.length === 0 ? (
              <div className="glass-card-flat p-12 text-center" style={{ color: 'var(--text-muted)' }}>
                <Building2 size={36} className="mx-auto mb-2 opacity-30" />No vendors found
              </div>
            ) : vendors.map(v => {
              const hasExpired = expiry?.expired?.some(d => d.vendor_name === v.name);
              const hasExpiring = expiry?.expiring_soon?.some(d => d.vendor_name === v.name);
              return (
                <button
                  key={v.id}
                  onClick={() => openVendor(v)}
                  className="w-full text-left"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '18px 24px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'all 0.15s',
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

                  {/* Name + category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontWeight: '600', fontSize: '15px' }}>{v.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                      {v.category || v.vendor_category || 'Vendor'}
                    </div>
                  </div>

                  {/* Alert pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {hasExpired && (
                      <span style={{
                        background: 'rgba(248,113,113,0.15)', color: '#f87171',
                        border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700'
                      }}>EXPIRED</span>
                    )}
                    {hasExpiring && (
                      <span style={{
                        background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.25)',
                        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600'
                      }}>EXPIRING SOON</span>
                    )}
                  </div>

                  <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── VENDOR DOCUMENTS VIEW ──
  return (
    <div className="space-y-6 animate-in">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setActiveVendor(null); setVendorDocs([]); }}
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
          <h1 className="font-display text-2xl font-bold text-white">{activeVendor.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {vendorDocs.length} document{vendorDocs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {docsLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
        </div>
      ) : vendorDocs.length === 0 ? (
        <div className="glass-card-flat p-16 text-center">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <div className="font-display font-semibold text-white mb-2">No documents uploaded</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>This vendor has not uploaded any documents yet.</p>
        </div>
      ) : (
        <div className="glass-card-flat overflow-hidden">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Review Status</th>
                <th>Valid Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorDocs.map(d => {
                const sc = statusColor(d.review_status);
                const isExpired = d.valid_until && new Date(d.valid_until) < new Date();
                const expiringSoon = d.valid_until && !isExpired &&
                  Math.ceil((new Date(d.valid_until) - new Date()) / (1000*60*60*24)) <= 30;
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="font-medium text-white text-sm">{d.file_name || d.document_type}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN') : ''}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{d.document_type}</td>
                    <td>
                      <span style={{
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {d.review_status || 'pending'}
                      </span>
                    </td>
                    <td>
                      {d.valid_until ? (
                        <span style={{
                          color: isExpired ? '#f87171' : expiringSoon ? '#fbbf24' : 'var(--text-secondary)',
                          fontSize: '13px'
                        }}>
                          {new Date(d.valid_until).toLocaleDateString('en-IN')}
                          {isExpired && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '700' }}>EXPIRED</span>}
                          {expiringSoon && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '600' }}>SOON</span>}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {d.review_status !== 'approved' && d.review_status !== 'rejected' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => reviewDoc(d.id, 'approved')} style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                            border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer'
                          }}>Approve</button>
                          <button onClick={() => reviewDoc(d.id, 'rejected')} style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                            background: 'rgba(248,113,113,0.12)', color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer'
                          }}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Reviewed</span>
                      )}
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
