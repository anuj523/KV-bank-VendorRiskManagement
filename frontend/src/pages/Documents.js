import React, { useState, useEffect } from 'react';
import { FileCheck, Clock, AlertTriangle, CheckCircle, Building2, ChevronRight, ArrowLeft, FileText, Upload, X } from 'lucide-react';
import api from '../utils/api';

// Required documents per vendor category — mirrors backend docToQuestion mapping
const CATEGORY_REQUIRED_DOCS = {
  technology_cloud: [
    { name: 'SOC 2 Type II Report', critical: true },
    { name: 'ISO 27001 Certificate', critical: true },
    { name: 'Penetration Test Report', critical: true },
    { name: 'Business Continuity Plan', critical: true },
    { name: 'Data Processing Agreement', critical: true },
    { name: 'Insurance Certificate', critical: false },
    { name: 'NDA / Confidentiality Agreement', critical: false },
    { name: 'VAPT Report', critical: false },
  ],
  it_products_software: [
    { name: 'SOC 2 Type II Report', critical: true },
    { name: 'Penetration Test Report', critical: true },
    { name: 'VAPT Report', critical: true },
    { name: 'ISO 27001 Certificate', critical: true },
    { name: 'Data Processing Agreement', critical: true },
    { name: 'Insurance Certificate', critical: false },
    { name: 'NDA / Confidentiality Agreement', critical: false },
  ],
  financial_fintech: [
    { name: 'SOC 2 Report', critical: true },
    { name: 'ISO 27001 Certificate', critical: true },
    { name: 'Penetration Test Report', critical: true },
    { name: 'Audited Financial Statements', critical: true },
    { name: 'Insurance Certificate', critical: true },
    { name: 'BCP / DR Plan', critical: true },
    { name: 'Data Processing Agreement', critical: true },
    { name: 'Regulatory Compliance Certificate', critical: true },
    { name: 'Sanctions / Adverse Media Screening', critical: true },
  ],
  outsourcing_data: [
    { name: 'Data Processing Agreement', critical: true },
    { name: 'ISO 27001 Certificate', critical: true },
    { name: 'SOC 2 Type II Report', critical: true },
    { name: 'Business Continuity Plan', critical: true },
    { name: 'Penetration Test Report', critical: true },
    { name: 'NDA / Confidentiality Agreement', critical: true },
    { name: 'Insurance Certificate', critical: false },
    { name: 'RBI Compliance Certificate', critical: false },
  ],
  professional_services: [
    { name: 'Insurance Certificate', critical: true },
    { name: 'NDA / Confidentiality Agreement', critical: true },
    { name: 'Company Registration', critical: true },
    { name: 'Financial Statements', critical: false },
    { name: 'Data Processing Agreement', critical: false },
    { name: 'ISO 27001 Certificate', critical: false },
  ],
  facilities_operations: [
    { name: 'Insurance Certificate', critical: true },
    { name: 'Company Registration', critical: true },
    { name: 'Business Continuity Plan', critical: true },
    { name: 'Financial Statements', critical: false },
    { name: 'NDA / Confidentiality Agreement', critical: false },
  ],
};

const CATEGORY_LABELS = {
  technology_cloud: 'Technology & Cloud Services',
  it_products_software: 'IT Products & Software',
  financial_fintech: 'Financial & Fintech Partners',
  outsourcing_data: 'Outsourcing & Data Processing',
  professional_services: 'Professional Services',
  facilities_operations: 'Facilities & Operations',
};

const ALL_DOCUMENT_TYPES = [
  'SOC 2 Type II Report', 'SOC 2 Report', 'ISO 27001 Certificate', 'Penetration Test Report',
  'Business Continuity Plan', 'BCP / DR Plan', 'Disaster Recovery Plan', 'Insurance Certificate',
  'NDA / Confidentiality Agreement', 'Data Processing Agreement', 'VAPT Report',
  'Financial Statements', 'Audited Financial Statements', 'Company Registration',
  'RBI Compliance Certificate', 'Regulatory Compliance Certificate', 'PCI DSS Certificate',
  'Sanctions / Adverse Media Screening', 'Other'
];

export default function Documents() {
  const [expiry, setExpiry] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVendor, setActiveVendor] = useState(null);
  const [vendorDocs, setVendorDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_type: '', valid_from: '', valid_until: '' });
  const [uploadFile, setUploadFile] = useState(null);

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
    setShowUpload(false);
    try {
      const data = await api.get(`/documents/vendor/${vendor.id}`);
      setVendorDocs(Array.isArray(data) ? data : data.documents || []);
    } catch (err) { console.error(err); setVendorDocs([]); }
    finally { setDocsLoading(false); }
  };

  const reviewDoc = async (docId, status) => {
    try {
      await api.patch(`/documents/${docId}/review`, { status });
      setVendorDocs(prev => prev.map(d => d.id === docId ? { ...d, status, review_status: status } : d));
    } catch (err) { alert(err.message); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadForm.document_type) return alert('Please select a file and document type');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('vendor_id', activeVendor.id);
      fd.append('document_type', uploadForm.document_type);
      fd.append('valid_from', uploadForm.valid_from);
      fd.append('valid_until', uploadForm.valid_until);
      await api.upload('/documents/upload', fd);
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ document_type: '', valid_from: '', valid_until: '' });
      // Refresh docs
      const data = await api.get(`/documents/vendor/${activeVendor.id}`);
      setVendorDocs(Array.isArray(data) ? data : data.documents || []);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally { setUploading(false); }
  };

  // Build required doc checklist for a vendor
  const getChecklist = (vendor) => {
    const category = vendor.category || vendor.vendor_category;
    return CATEGORY_REQUIRED_DOCS[category] || [];
  };

  const matchDoc = (docName, uploadedDocs) => {
    // Find an uploaded doc that matches this required doc name (fuzzy: includes check)
    return uploadedDocs.find(d =>
      d.document_type?.toLowerCase().includes(docName.toLowerCase()) ||
      docName.toLowerCase().includes(d.document_type?.toLowerCase())
    );
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Select a vendor to view and manage their documents</p>
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
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Vendors</div>
          <div className="space-y-2">
            {vendors.length === 0 ? (
              <div className="glass-card-flat p-12 text-center" style={{ color: 'var(--text-muted)' }}>
                <Building2 size={36} className="mx-auto mb-2 opacity-30" />No vendors found
              </div>
            ) : vendors.map(v => {
              const hasExpired = expiry?.expired?.some(d => d.vendor_name === v.name);
              const hasExpiring = expiry?.expiring_soon?.some(d => d.vendor_name === v.name);
              const cat = v.category || v.vendor_category;
              return (
                <button key={v.id} onClick={() => openVendor(v)} className="w-full text-left"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '18px 24px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.08)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Building2 size={20} style={{ color: '#38bdf8' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontWeight: '600', fontSize: '15px' }}>{v.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                      {CATEGORY_LABELS[cat] || cat?.replace(/_/g, ' ') || 'Uncategorized'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {hasExpired && (
                      <span style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>EXPIRED</span>
                    )}
                    {hasExpiring && (
                      <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }}>EXPIRING SOON</span>
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
  const checklist = getChecklist(activeVendor);
  const criticalDocs = checklist.filter(d => d.critical);
  const validUploaded = vendorDocs.filter(d => d.status === 'approved');
  const validCount = criticalDocs.filter(d => matchDoc(d.name, validUploaded)).length;
  const expiringCount = vendorDocs.filter(d => {
    if (!d.valid_until) return false;
    const days = Math.ceil((new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }).length;
  const expiredCount = vendorDocs.filter(d => d.valid_until && new Date(d.valid_until) < new Date()).length;
  const cat = activeVendor.category || activeVendor.vendor_category;

  return (
    <div className="space-y-6 animate-in">
      {/* Back + header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setActiveVendor(null); setVendorDocs([]); setShowUpload(false); }}
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
              {CATEGORY_LABELS[cat] || cat?.replace(/_/g, ' ') || 'Uncategorized'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary flex items-center gap-2">
          <Upload size={15} /> Upload Document
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="glass-card-flat p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Upload New Document</h4>
            <button onClick={() => setShowUpload(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Document Type *</label>
              <select className="glass-input" value={uploadForm.document_type}
                onChange={e => setUploadForm(p => ({ ...p, document_type: e.target.value }))}>
                <option value="">— Select type —</option>
                {/* Show required docs for this category first */}
                {checklist.length > 0 && (
                  <optgroup label="Required for this vendor">
                    {checklist.map(d => <option key={d.name} value={d.name}>{d.name}{d.critical ? ' ★' : ''}</option>)}
                  </optgroup>
                )}
                <optgroup label="Other documents">
                  {ALL_DOCUMENT_TYPES.filter(t => !checklist.find(d => d.name === t)).map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Valid From</label>
                <input type="date" className="glass-input" value={uploadForm.valid_from}
                  onChange={e => setUploadForm(p => ({ ...p, valid_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Valid Until</label>
                <input type="date" className="glass-input" value={uploadForm.valid_until}
                  onChange={e => setUploadForm(p => ({ ...p, valid_until: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>File *</label>
              <input type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" className="glass-input text-sm"
                onChange={e => setUploadFile(e.target.files[0])} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </div>
      )}

      {docsLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Due-Diligence Checklist ── */}
          {checklist.length > 0 && (
            <div className="glass-card-flat overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} style={{ color: '#a78bfa' }} />
                  <h3 className="font-display font-semibold text-white">Due-Diligence Documents</h3>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Required (Critical): <strong style={{ color: 'white' }}>{criticalDocs.length}</strong></span>
                  <span>Valid: <strong style={{ color: '#4ade80' }}>{validCount}</strong></span>
                  <span>Expiring: <strong style={{ color: '#fbbf24' }}>{expiringCount}</strong></span>
                  <span>Expired: <strong style={{ color: '#f87171' }}>{expiredCount}</strong></span>
                  <span>Missing: <strong style={{ color: '#f87171' }}>{criticalDocs.length - validCount}</strong></span>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {checklist.map(req => {
                  const uploaded = matchDoc(req.name, vendorDocs);
                  const isValid = uploaded && uploaded.status === 'approved';
                  const isPending = uploaded && (!uploaded.status || uploaded.status === 'pending');
                  const isExpired = uploaded?.valid_until && new Date(uploaded.valid_until) < new Date();
                  const daysLeft = uploaded?.valid_until
                    ? Math.ceil((new Date(uploaded.valid_until) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;

                  let statusLabel = 'Missing';
                  let statusStyle = { color: '#f87171' };
                  if (uploaded) {
                    if (isExpired) { statusLabel = 'Expired'; statusStyle = { color: '#f87171' }; }
                    else if (isPending) { statusLabel = 'Pending Review'; statusStyle = { color: '#fbbf24' }; }
                    else if (isValid && daysLeft !== null && daysLeft <= 30) { statusLabel = `Expiring in ${daysLeft}d`; statusStyle = { color: '#fbbf24' }; }
                    else if (isValid) { statusLabel = 'Valid'; statusStyle = { color: '#4ade80' }; }
                    else { statusLabel = uploaded.status || 'Uploaded'; statusStyle = { color: 'var(--text-secondary)' }; }
                  }

                  return (
                    <div key={req.name} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', gap: '12px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: isValid && !isExpired ? '#4ade80' : uploaded ? '#fbbf24' : 'rgba(248,113,113,0.5)'
                      }} />
                      <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {req.name}
                        {req.critical && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#a78bfa', fontWeight: '700' }}>CRITICAL</span>}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', ...statusStyle }}>{statusLabel}</div>
                      {uploaded && !isValid && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => reviewDoc(uploaded.id, 'approved')} style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                            border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer'
                          }}>Approve</button>
                          <button onClick={() => reviewDoc(uploaded.id, 'rejected')} style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            background: 'rgba(248,113,113,0.12)', color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer'
                          }}>Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── All Uploaded Documents ── */}
          <div className="glass-card-flat overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center gap-2">
              <FileText size={16} style={{ color: '#38bdf8' }} />
              <h3 className="font-display font-semibold text-white">Uploaded Documents</h3>
              <span style={{ marginLeft: '4px', color: 'var(--text-muted)', fontSize: '13px' }}>({vendorDocs.length})</span>
            </div>
            {vendorDocs.length === 0 ? (
              <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                No documents uploaded yet
              </div>
            ) : (
              <table className="glass-table">
                <thead>
                  <tr><th>Document</th><th>Type</th><th>Status</th><th>Valid Until</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {vendorDocs.map(d => {
                    const sc = statusColor(d.status || d.review_status);
                    const isExpired = d.valid_until && new Date(d.valid_until) < new Date();
                    const daysLeft = d.valid_until
                      ? Math.ceil((new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24))
                      : null;
                    const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="font-medium text-white text-sm">{d.file_name || d.document_type}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN') : d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : ''}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{d.document_type}</td>
                        <td>
                          <span style={{
                            background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                            borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize'
                          }}>{d.status || d.review_status || 'pending'}</span>
                        </td>
                        <td>
                          {d.valid_until ? (
                            <span style={{ color: isExpired ? '#f87171' : expiringSoon ? '#fbbf24' : 'var(--text-secondary)', fontSize: '13px' }}>
                              {new Date(d.valid_until).toLocaleDateString('en-IN')}
                              {isExpired && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700' }}>EXPIRED</span>}
                              {expiringSoon && !isExpired && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600' }}>({daysLeft}d)</span>}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          {(d.status !== 'approved' && d.status !== 'rejected') ? (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
