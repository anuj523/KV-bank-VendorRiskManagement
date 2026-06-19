import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Shield, AlertTriangle, FileCheck,
  TrendingUp, Clock, Bot, Activity, CheckCircle,
  Loader, Upload, X, Eye, Sparkles, Trash2
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_TRANSITIONS = {
  intake_received: ['under_classification'],
  under_classification: ['under_due_diligence'],
  under_due_diligence: ['under_assessment'],
  under_assessment: ['pending_approval'],
  pending_approval: ['active', 'rejected'],
  active: ['under_review', 'renewal_pending', 'suspended', 'offboarding_initiated'],
  under_review: ['active', 'pending_reapproval'],
  suspended: ['active', 'offboarding_initiated'],
  renewal_pending: ['active', 'offboarding_initiated'],
};

const STATUS_LABELS = {
  under_classification: 'Move to Classification', under_due_diligence: 'Start Due Diligence',
  under_assessment: 'Start Assessment', pending_approval: 'Submit for Approval',
  active: 'Activate', rejected: 'Reject', under_review: 'Send for Review',
  renewal_pending: 'Flag for Renewal', suspended: 'Suspend',
  offboarding_initiated: 'Initiate Offboarding', pending_reapproval: 'Request Re-approval'
};

const DOCUMENT_TYPES = [
  'SOC 2 Type II Report', 'ISO 27001 Certificate', 'Penetration Test Report',
  'Business Continuity Plan', 'Disaster Recovery Plan', 'Insurance Certificate',
  'NDA / Confidentiality Agreement', 'Data Processing Agreement',
  'VAPT Report', 'Financial Statements', 'Company Registration',
  'RBI Compliance Certificate', 'PCI DSS Certificate', 'Other'
];

function ScoreBar({ label, value }) {
  const color = value >= 80 ? '#4ade80' : value >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color }}>{value != null ? `${value}%` : '—'}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value || 0}%`, background: color }} />
      </div>
    </div>
  );
}

function DocumentsTab({ vendor, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ document_type: '', valid_from: '', valid_until: '', is_mandatory: false });
  const [file, setFile] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(null);
  const fileRef = useRef();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.document_type) return alert('Please select a file and document type');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('vendor_id', vendor.id);
      fd.append('document_type', form.document_type);
      fd.append('valid_from', form.valid_from);
      fd.append('valid_until', form.valid_until);
      fd.append('is_mandatory', form.is_mandatory);
      await api.upload('/documents/upload', fd);
      setShowForm(false);
      setFile(null);
      setForm({ document_type: '', valid_from: '', valid_until: '', is_mandatory: false });
      onRefresh();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReview = async (docId, status, reason) => {
    setReviewing(docId);
    try {
      await api.patch(`/documents/${docId}/review`, { status, rejection_reason: reason });
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setReviewing(null);
    }
  };

  const runDocumentAI = async (doc) => {
    setAiLoading(doc.id);
    setAiSummary(null);
    try {
      // Pass document metadata as context (actual text extraction would need pdf-parse)
      const data = await api.post(`/ai/document-summary/${doc.id}`, {
        document_text: `Document Type: ${doc.document_type}\nFile: ${doc.file_name}\nValid From: ${doc.valid_from || 'N/A'}\nValid Until: ${doc.valid_until || 'N/A'}\nUploaded: ${new Date(doc.created_at).toLocaleDateString('en-IN')}\nStatus: ${doc.status}`
      });
      setAiSummary({ docName: doc.document_type, text: data.text });
    } catch (err) {
      setAiSummary({ docName: doc.document_type, text: 'AI analysis failed: ' + err.message, error: true });
    } finally {
      setAiLoading(null);
    }
  };

  const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const viewFile = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BASE_URL}${doc.file_path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('File not accessible');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert('Could not open file: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-semibold text-white">Documents ({vendor.documents?.length || 0})</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Upload size={15} /> Upload Document
        </button>
      </div>

      {/* Document flow explanation */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
        {[
          { label: 'Upload', color: '#60a5fa' },
          { label: '→', color: 'var(--text-muted)' },
          { label: 'Pending Review', color: '#fbbf24' },
          { label: '→', color: 'var(--text-muted)' },
          { label: 'Approved ✓', color: '#4ade80' },
          { label: '/', color: 'var(--text-muted)' },
          { label: 'Rejected ✗', color: '#f87171' },
          { label: '→', color: 'var(--text-muted)' },
          { label: 'Expiry Tracked', color: '#a78bfa' },
          { label: '→', color: 'var(--text-muted)' },
          { label: 'Risk Score Updated', color: '#0ea5a0' },
        ].map((item, i) => (
          <span key={i} style={{ color: item.color, whiteSpace: 'nowrap' }} className="font-medium">{item.label}</span>
        ))}
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="glass-card-flat p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Upload New Document</h4>
            <button onClick={() => setShowForm(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Document Type *</label>
              <select className="glass-input" value={form.document_type}
                onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} required>
                <option value="">Select type...</option>
                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Valid From</label>
                <input type="date" className="glass-input" value={form.valid_from}
                  onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Valid Until</label>
                <input type="date" className="glass-input" value={form.valid_until}
                  onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>File * (PDF, DOCX, XLSX, PNG, JPG — max 20MB)</label>
              <div className="glass-input flex items-center gap-3 cursor-pointer"
                onClick={() => fileRef.current.click()}
                style={{ borderStyle: 'dashed' }}>
                <Upload size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: file ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {file ? file.name : 'Click to select file...'}
                </span>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files[0])} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mandatory" checked={form.is_mandatory}
                onChange={e => setForm(p => ({ ...p, is_mandatory: e.target.checked }))}
                className="w-4 h-4 rounded accent-sky-500" />
              <label htmlFor="mandatory" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Mark as mandatory document</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
                {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-glass">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* AI Summary result */}
      {aiSummary && (
        <div className="glass-card-flat p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot size={16} className="text-sky-400" />
            <span className="font-medium text-white text-sm">AI Summary — {aiSummary.docName}</span>
            <button onClick={() => setAiSummary(null)} className="ml-auto"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed"
            style={{ color: aiSummary.error ? '#f87171' : 'var(--text-secondary)', fontFamily: 'inherit' }}>
            {aiSummary.text}
          </pre>
        </div>
      )}

      {/* Documents table */}
      <div className="glass-card-flat overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Valid Until</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendor.documents?.length ? vendor.documents.map(d => (
              <tr key={d.id}>
                <td>
                  <div className="font-medium text-white text-sm">{d.document_type}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.file_name}</div>
                  {d.is_mandatory && <span className="badge badge-amber text-xs mt-1">Mandatory</span>}
                </td>
                <td>
                  <span className={`badge ${d.status === 'approved' ? 'badge-green' : d.status === 'rejected' ? 'badge-red' : d.status === 'expired' ? 'badge-red' : 'badge-amber'}`}>
                    {d.status}
                  </span>
                  {d.rejection_reason && (
                    <div className="text-xs mt-1" style={{ color: '#f87171' }}>{d.rejection_reason}</div>
                  )}
                </td>
                <td className="text-sm" style={{ color: d.valid_until && new Date(d.valid_until) < new Date() ? '#f87171' : 'var(--text-muted)' }}>
                  {d.valid_until ? new Date(d.valid_until).toLocaleDateString('en-IN') : '—'}
                  {d.valid_until && new Date(d.valid_until) < new Date() && (
                    <div className="text-xs text-red-400">Expired</div>
                  )}
                </td>
                <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {new Date(d.created_at).toLocaleDateString('en-IN')}
                </td>
                <td>
                  <div className="flex gap-1.5 flex-wrap">
                    {d.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReview(d.id, 'approved')}
                          disabled={reviewing === d.id}
                          className="text-xs py-1 px-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all">
                          Approve
                        </button>
                        <button
                          onClick={() => { const r = prompt('Rejection reason:'); if (r) handleReview(d.id, 'rejected', r); }}
                          disabled={reviewing === d.id}
                          className="text-xs py-1 px-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                          Reject
                        </button>
                      </>
                    )}
                    {/* AI Analyse button for all documents */}
                    <button
                      onClick={() => runDocumentAI(d)}
                      disabled={aiLoading === d.id}
                      title="AI Document Summary"
                      className="text-xs py-1 px-2 rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-all flex items-center gap-1">
                      {aiLoading === d.id
                        ? <Loader size={11} className="animate-spin" />
                        : <Sparkles size={11} />}
                      AI
                    </button>
                    <button
                      onClick={() => viewFile(d)}
                      className="text-xs py-1 px-2 rounded-lg border border-white/15 text-white/60 hover:text-white transition-all flex items-center gap-1">
                      <Eye size={11} /> View
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <Upload size={36} className="mx-auto mb-3 opacity-30" />
                  No documents uploaded yet. Click "Upload Document" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flow explanation note */}
      <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <strong className="text-white/50">How documents flow:</strong> Uploaded → Pending Review → Approve/Reject by KVB officer → 
        Approved docs tracked on Documents dashboard for expiry → Uploading key docs (SOC 2, BCP, VAPT) automatically updates questionnaire compliance → 
        Affects risk score on next questionnaire save → Vendor health indicator updates on dashboard.
      </div>
    </div>
  );
}

// VendorEditForm — uses refs instead of controlled state to completely eliminate cursor jumping
function VendorEditForm({ vendor, onSave, onCancel, saving }) {
  const refs = {
    contact_person: React.useRef(),
    email: React.useRef(),
    contact_phone: React.useRef(),
    incorporation_country: React.useRef(),
    employee_count: React.useRef(),
    years_in_operation: React.useRef(),
    annual_revenue: React.useRef(),
    service_description: React.useRef(),
    category: React.useRef(),
    criticality: React.useRef(),
    health_status: React.useRef(),
    contract_start_date: React.useRef(),
    contract_end_date: React.useRef(),
    contract_value: React.useRef(),
    auto_renewal: React.useRef(),
  };

  const handleSubmit = () => {
    const data = {};
    Object.keys(refs).forEach(k => {
      if (!refs[k].current) return;
      if (k === 'auto_renewal') data[k] = refs[k].current.checked;
      else data[k] = refs[k].current.value;
    });
    onSave(data);
  };

  const inp = "glass-input text-sm py-1 px-2 flex-1";
  const row = (label, children) => (
    <div className="flex items-start justify-between py-2.5 border-b border-white/5 gap-4">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 150 }}>{label}</span>
      {children}
    </div>
  );

  return (
    <div className="space-y-0">
      {row("Contact Person", <input ref={refs.contact_person} className={inp} defaultValue={vendor.contact_person || ''} placeholder="Enter name" />)}
      {row("Email", <input ref={refs.email} className={inp} type="email" defaultValue={vendor.email || ''} placeholder="Enter email" />)}
      {row("Phone", <input ref={refs.contact_phone} className={inp} defaultValue={vendor.contact_phone || ''} placeholder="Enter phone" />)}
      {row("Country", <input ref={refs.incorporation_country} className={inp} defaultValue={vendor.incorporation_country || ''} placeholder="Enter country" />)}
      {row("Employees", <input ref={refs.employee_count} className={inp} type="number" defaultValue={vendor.employee_count || ''} placeholder="Number of employees" />)}
      {row("Years Operating", <input ref={refs.years_in_operation} className={inp} type="number" defaultValue={vendor.years_in_operation || ''} placeholder="Years in business" />)}
      {row("Annual Revenue (₹)", <input ref={refs.annual_revenue} className={inp} type="number" defaultValue={vendor.annual_revenue || ''} placeholder="Revenue in ₹" />)}
      {row("Category",
        <select ref={refs.category} className={inp} defaultValue={vendor.category || ''}>
          <option value="">— select —</option>
          <option value="technology_cloud">Technology & Cloud</option>
          <option value="it_products_software">IT Products & Software</option>
          <option value="financial_fintech">Financial & Fintech</option>
          <option value="outsourcing_data">Outsourcing & Data</option>
          <option value="professional_services">Professional Services</option>
          <option value="facilities_operations">Facilities & Operations</option>
        </select>
      )}
      {row("Criticality",
        <select ref={refs.criticality} className={inp} defaultValue={vendor.criticality || ''}>
          <option value="">— select —</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      )}
      {row("Health Status",
        <select ref={refs.health_status} className={inp} defaultValue={vendor.health_status || 'green'}>
          <option value="green">Green ✅</option>
          <option value="amber">Amber ⚠️</option>
          <option value="red">Red 🔴</option>
        </select>
      )}
      <div className="py-2.5 border-b border-white/5">
        <div className="text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Service Description</div>
        <textarea ref={refs.service_description} className="glass-input resize-none h-20 text-sm w-full"
          defaultValue={vendor.service_description || ''} placeholder="Describe services provided to KVB..." />
      </div>
      <div className="pt-3 border-b border-white/5 pb-3">
        <div className="text-sm mb-2 font-medium text-white">Contract Details</div>
        {row("Contract Start", <input ref={refs.contract_start_date} className={inp} type="date" defaultValue={vendor.contract_start_date ? vendor.contract_start_date.split('T')[0] : ''} />)}
        {row("Contract End", <input ref={refs.contract_end_date} className={inp} type="date" defaultValue={vendor.contract_end_date ? vendor.contract_end_date.split('T')[0] : ''} />)}
        {row("Contract Value (₹)", <input ref={refs.contract_value} className={inp} type="number" defaultValue={vendor.contract_value || ''} placeholder="Enter value" />)}
        {row("Auto Renewal", <input ref={refs.auto_renewal} type="checkbox" defaultChecked={vendor.auto_renewal || false} className="w-4 h-4 accent-sky-500 mt-1" />)}
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✓'}
          Save Changes
        </button>
        <button onClick={onCancel} className="btn-glass text-sm">Cancel</button>
      </div>
    </div>
  );
}

function OverviewTab({ vendor, score, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fmt = (val, field) => {
    if (!val) return '—';
    if (field === 'auto_renewal') return val ? 'Yes' : 'No';
    if (field === 'contract_value') return `₹${Number(val).toLocaleString('en-IN')}`;
    if (field === 'contract_start_date' || field === 'contract_end_date') return new Date(val).toLocaleDateString('en-IN');
    if (field === 'category') return val.replace(/_/g, ' ');
    return val;
  };

  const Row = ({ label, field }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-white/5 gap-4">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 150 }}>{label}</span>
      <span className="text-sm text-white font-medium text-right">{fmt(vendor[field], field) || '—'}</span>
    </div>
  );

  const handleSave = async (data) => {
    setSaving(true);
    try {
      await api.put(`/vendors/${vendor.id}`, data);
      setEditing(false);
      onRefresh();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Vendor Details Card */}
      <div className="glass-card-flat p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-white">Vendor Details</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-glass text-xs py-1.5 px-3">✏️ Edit</button>
          )}
        </div>

        {editing ? (
          <VendorEditForm
            vendor={vendor}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            saving={saving}
          />
        ) : (
          <div>
            <Row label="Contact Person" field="contact_person" />
            <Row label="Email" field="email" />
            <Row label="Phone" field="contact_phone" />
            <Row label="Country" field="incorporation_country" />
            <Row label="Employees" field="employee_count" />
            <Row label="Years Operating" field="years_in_operation" />
            <Row label="Annual Revenue (₹)" field="annual_revenue" />
            <Row label="Category" field="category" />
            <Row label="Criticality" field="criticality" />
            <Row label="Health Status" field="health_status" />
            <div className="py-2.5">
              <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Service Description</div>
              <p className="text-sm" style={{ color: vendor.service_description ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {vendor.service_description || '—'}
              </p>
            </div>
          </div>
        )}

        <CreatePortalUser vendorId={vendor.id} vendorName={vendor.name} />
      </div>

      {/* Contract & Risk Card */}
      <div className="glass-card-flat p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-white">Contract & Risk</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-glass text-xs py-1.5 px-3">✏️ Edit</button>
          )}
        </div>

        {score ? (
          <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(74,159,212,0.08)', border: '1px solid rgba(74,159,212,0.15)' }}>
            <div className="text-4xl font-bold font-display" style={{ color: score.overall_score >= 80 ? '#4ade80' : score.overall_score >= 50 ? '#fbbf24' : '#f87171' }}>
              {score.overall_score}%
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Overall risk score · {score.risk_rating} risk</div>
          </div>
        ) : (
          <div className="p-4 rounded-xl mb-4 text-sm" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
            No risk score yet — complete the questionnaire
          </div>
        )}

        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Contract Start</span>
          <span className="text-sm text-white">{vendor.contract_start_date ? new Date(vendor.contract_start_date).toLocaleDateString('en-IN') : '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Contract End</span>
          <span className="text-sm text-white">{vendor.contract_end_date ? new Date(vendor.contract_end_date).toLocaleDateString('en-IN') : '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Contract Value (₹)</span>
          <span className="text-sm text-white">{vendor.contract_value ? `₹${Number(vendor.contract_value).toLocaleString('en-IN')}` : '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Auto Renewal</span>
          <span className="text-sm text-white">{vendor.auto_renewal ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Owner</span>
          <span className="text-sm text-white">{vendor.owner_name || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Status</span>
          <span className="badge badge-blue">{vendor.status?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-white/5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Added On</span>
          <span className="text-sm text-white">{new Date(vendor.created_at).toLocaleDateString('en-IN')}</span>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm" style={{ color: 'var(--text-muted)', minWidth: 150 }}>Last Updated</span>
          <span className="text-sm text-white">{new Date(vendor.updated_at).toLocaleDateString('en-IN')}</span>
        </div>

        {vendor.subcontractors?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>SUB-CONTRACTORS</div>
            {vendor.subcontractors.map(s => (
              <div key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-white">{s.name}</span>
                <div className="flex gap-2">
                  <span className="badge badge-gray">{s.geography}</span>
                  {s.has_kvb_data_access && <span className="badge badge-amber">Data Access</span>}
                  {s.data_outside_india && <span className="badge badge-red">Outside India</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatePortalUser({ vendorId, vendorName }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/auth/vendor-user', { ...form, vendor_id: vendorId });
      setSuccess(`Portal login created! Email: ${form.email} / Password: ${form.password}`);
      setForm({ email: '', full_name: '', password: '' });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="mt-4">
      <button onClick={() => setShow(!show)} className="btn-glass text-sm flex items-center gap-2">
        🔑 {show ? 'Cancel' : 'Create Vendor Portal Login'}
      </button>
      {show && (
        <form onSubmit={handleCreate} className="mt-3 p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create login credentials for {vendorName} to access the Vendor Portal</p>
          <input className="glass-input" placeholder="Vendor contact email" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required type="email" />
          <input className="glass-input" placeholder="Contact person name" value={form.full_name}
            onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          <input className="glass-input" placeholder="Set a password" value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required type="text" />
          {error && <div className="text-xs" style={{ color: '#f87171' }}>{error}</div>}
          {success && <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>{success}</div>}
          <button type="submit" disabled={loading} className="btn-primary text-sm">
            {loading ? 'Creating...' : 'Create Login'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [aiLoading, setAiLoading] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [statusChanging, setStatusChanging] = useState(false);

  const deleteVendor = async () => {
    const deletable = ['intake_received', 'rejected'].includes(vendor?.status);
    if (!deletable) {
      alert(`Cannot delete this vendor.\n\nStatus "${vendor?.status}" is not deletable.\nOnly Intake or Rejected vendors can be deleted.\nFor active vendors, use the Offboarding workflow.`);
      return;
    }
    const confirmed = window.confirm(`⚠️ PERMANENT DELETE\n\nDelete "${vendor?.name}" permanently?\n\nAll records including documents, findings, and questionnaire responses will be removed. This cannot be undone.`);
    if (!confirmed) return;
    try {
      await api.delete(`/vendors/${id}`);
      navigate('/vendors');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const loadVendor = () => {
    setLoading(true);
    api.get(`/vendors/${id}`)
      .then(setVendor)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadVendor(); }, [id]);

  const changeStatus = async (newStatus) => {
    setStatusChanging(true);
    try {
      const updated = await api.patch(`/vendors/${id}/status`, { status: newStatus });
      setVendor(prev => ({ ...prev, ...updated }));
    } catch (err) { alert(err.message); }
    finally { setStatusChanging(false); }
  };

  const runAI = async (type) => {
    setAiLoading(type);
    setAiResult(null);
    try {
      let data;
      if (type === 'risk_summary') data = await api.post(`/ai/risk-summary/${id}`, {});
      else if (type === 'gap_analysis') data = await api.post(`/ai/gap-analysis/${id}`, {});
      else if (type === 'mitigation') data = await api.post(`/ai/mitigation/${id}`, {});
      else if (type === 'audit_frequency') data = await api.post(`/ai/audit-frequency/${id}`, {});
      setAiResult({ type, text: data.text, id: data.analysis?.id });
    } catch (err) {
      setAiResult({ type, text: 'AI analysis failed: ' + err.message, error: true });
    } finally { setAiLoading(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  if (!vendor) return <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Vendor not found</div>;

  const nextStatuses = STATUS_TRANSITIONS[vendor.status] || [];
  const score = vendor.latest_score;
  const healthColor = { green: '#4ade80', amber: '#fbbf24', red: '#f87171' }[vendor.health_status] || '#60a5fa';

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'risk', label: 'Risk Scores', icon: TrendingUp },
    { key: 'findings', label: `Findings (${vendor.findings?.length || 0})`, icon: AlertTriangle },
    { key: 'documents', label: `Documents (${vendor.documents?.length || 0})`, icon: FileCheck },
    { key: 'ai', label: 'AI Insights', icon: Bot },
    { key: 'audit', label: 'Audit Trail', icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/vendors')} className="btn-glass p-2 mt-1"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold text-white">{vendor.name}</h1>
            {vendor.criticality ? (
              <span className={`badge ${vendor.criticality === 'high' ? 'badge-red' : vendor.criticality === 'medium' ? 'badge-amber' : 'badge-green'}`}>
                {vendor.criticality} criticality
              </span>
            ) : (
              <span className="badge badge-gray">criticality not set — edit to add</span>
            )}
            <div className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
              <span className="text-sm" style={{ color: healthColor }}>{vendor.health_status}</span>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.legal_name || ''} · {vendor.category?.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <span className="badge badge-blue">{vendor.status?.replace(/_/g, ' ')}</span>
            {user?.role === 'system_administrator' && ['intake_received','rejected'].includes(vendor.status) && (
              <button onClick={deleteVendor} title="Delete vendor permanently"
                className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
          {nextStatuses.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {nextStatuses.map(s => (
                <button key={s} onClick={() => changeStatus(s)} disabled={statusChanging}
                  className={`text-xs py-1.5 px-3 rounded-lg border transition-all ${
                    ['rejected','suspended','offboarding_initiated'].includes(s)
                      ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                      : s === 'active' ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                      : 'btn-glass'
                  }`}>
                  {STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === key ? 'bg-white/10 text-white border border-white/15' : 'text-white/50 hover:text-white/80'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Workflow action buttons - shown when vendor is active */}
    {vendor.status === 'active' && (
      <div className="flex flex-wrap gap-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-xs self-center mr-1" style={{ color: 'var(--text-muted)' }}>Workflows:</span>
        <button onClick={async () => { if(!window.confirm('Initiate periodic review for this vendor?')) return; try { const r = await api.post(`/workflows/periodic-review/${id}`,{}); alert(r.change_summary); loadVendor(); } catch(e){ alert(e.message); }}}
          className="text-xs py-1.5 px-3 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all">
          🔄 Periodic Review
        </button>
        <button onClick={async () => { if(!window.confirm('Initiate renewal workflow?')) return; try { await api.post(`/workflows/renewal/${id}`,{}); loadVendor(); } catch(e){ alert(e.message); }}}
          className="text-xs py-1.5 px-3 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all">
          📋 Start Renewal
        </button>
      </div>
    )}
    {vendor.status === 'offboarding_initiated' && (
      <div className="flex flex-wrap gap-2 p-4 rounded-xl" style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)' }}>
        <span className="text-xs self-center mr-1 text-orange-400 font-medium">⚠ Offboarding in progress:</span>
        <button onClick={async () => { const r = prompt('IT sign-off notes (confirm access revocation):'); if(!r) return; try { await api.post(`/workflows/offboarding/${id}/complete`,{ notes: r }); loadVendor(); } catch(e){ alert(e.message); }}}
          className="text-xs py-1.5 px-3 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all">
          ✓ Complete Offboarding (All Sign-offs Done)
        </button>
      </div>
    )}

    {activeTab === 'overview' && (
        <OverviewTab vendor={vendor} score={score} onRefresh={loadVendor} />
      )}

      {activeTab === 'risk' && (
        <div className="glass-card-flat p-6">
          <h3 className="font-display font-semibold text-white mb-6">Risk Domain Scores</h3>
          {score ? (
            <div className="space-y-5">
              <ScoreBar label="Cybersecurity" value={score.cybersecurity_score} />
              <ScoreBar label="Operational" value={score.operational_score} />
              <ScoreBar label="Compliance & Legal" value={score.compliance_score} />
              <ScoreBar label="Financial" value={score.financial_score} />
              <ScoreBar label="Reputational" value={score.reputational_score} />
              <div className="pt-6 border-t border-white/10">
                <ScoreBar label="Overall Risk Score" value={score.overall_score} />
              </div>
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No risk scores yet. Complete the questionnaire to generate scores.</div>
          )}
          <div className="mt-6 flex gap-3 flex-wrap">
            <Link to={`/risk/${id}`} className="btn-primary inline-flex items-center gap-2">
              <TrendingUp size={15} /> {score ? 'Redo Questionnaire' : 'Open Questionnaire'}
            </Link>
            {score && user?.role === 'system_administrator' && (
              <button
                onClick={async () => {
                  if (!window.confirm('This will permanently delete all questionnaire answers, risk scores and auto-raised findings for this vendor. Continue?')) return;
                  try {
                    await api.delete(`/risk/${id}/reset`);
                    alert('Reset complete. Please redo the questionnaire.');
                    loadVendor();
                  } catch (err) { alert('Reset failed: ' + err.message); }
                }}
                className="btn-glass text-sm flex items-center gap-2"
                style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
              >
                🔄 Reset & Redo
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="glass-card-flat overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-display font-semibold text-white">Findings</h3>
            <span className="badge badge-red">{vendor.findings?.filter(f=>f.status!=='closed').length||0} open</span>
          </div>
          <table className="glass-table">
            <thead><tr><th>Finding</th><th>Severity</th><th>Domain</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {vendor.findings?.length ? vendor.findings.map(f => (
                <tr key={f.id}>
                  <td><div className="font-medium text-white text-sm">{f.title}</div></td>
                  <td><span className={`badge ${f.severity==='high'?'badge-red':f.severity==='medium'?'badge-amber':'badge-blue'}`}>{f.severity}</span></td>
                  <td style={{ color:'var(--text-muted)' }}>{f.domain?.replace(/_/g,' ')}</td>
                  <td><span className="badge badge-gray">{f.status?.replace(/_/g,' ')}</span></td>
                  <td className="text-sm" style={{ color:'var(--text-muted)' }}>{f.target_date?new Date(f.target_date).toLocaleDateString('en-IN'):'—'}</td>
                </tr>
              )) : <tr><td colSpan={5} className="text-center py-10" style={{ color:'var(--text-muted)' }}>No findings</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && <DocumentsTab vendor={vendor} onRefresh={loadVendor} />}

      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { type:'risk_summary', label:'Risk Summary', desc:'Executive risk overview', icon:Shield },
              { type:'gap_analysis', label:'Gap Analysis', desc:'Questionnaire vs documents', icon:AlertTriangle },
              { type:'mitigation', label:'Mitigations', desc:'Fix recommendations', icon:CheckCircle },
              { type:'audit_frequency', label:'Audit Frequency', desc:'Review schedule recommendation', icon:Clock },
            ].map(({ type, label, desc, icon:Icon }) => (
              <button key={type} onClick={() => runAI(type)} disabled={aiLoading !== null}
                className="glass-card p-4 text-left hover:border-sky-400/30 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  {aiLoading===type ? <Loader size={16} className="text-sky-400 animate-spin" /> : <Icon size={16} className="text-sky-400" />}
                  <span className="font-medium text-white text-sm">{label}</span>
                </div>
                <p className="text-xs" style={{ color:'var(--text-muted)' }}>{desc}</p>
              </button>
            ))}
          </div>
          {aiResult && (
            <div className="glass-card-flat p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bot size={18} className="text-sky-400" />
                <h3 className="font-display font-semibold text-white">AI Analysis</h3>
                {!aiResult.error && aiResult.id && (
                  <div className="ml-auto flex gap-2">
                    <button className="btn-glass text-xs py-1 px-3" style={{ color:'#4ade80' }}
                      onClick={() => api.patch(`/ai/analyses/${aiResult.id}/review`,{status:'accepted'})}>Accept</button>
                    <button className="btn-glass text-xs py-1 px-3" style={{ color:'#f87171' }}
                      onClick={() => { api.patch(`/ai/analyses/${aiResult.id}/review`,{status:'rejected'}); setAiResult(null); }}>Dismiss</button>
                  </div>
                )}
              </div>
              <pre className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color:aiResult.error?'#f87171':'var(--text-secondary)', fontFamily:'inherit' }}>
                {aiResult.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && <AuditTrail vendorId={id} />}
    </div>
  );
}

function AuditTrail({ vendorId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/vendors/${vendorId}/audit`).then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [vendorId]);
  if (loading) return <div className="text-center py-8"><div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto" /></div>;
  return (
    <div className="glass-card-flat overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <h3 className="font-display font-semibold text-white">Audit Trail</h3>
        <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>Immutable — all actions logged</p>
      </div>
      <div className="divide-y divide-white/5">
        {logs.length ? logs.map(log => (
          <div key={log.id} className="p-4 flex items-start gap-4">
            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background:'var(--accent-blue)' }} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{log.action?.replace(/_/g,' ')}</span>
                {log.entity_type && <span className="badge badge-gray text-xs">{log.entity_type}</span>}
              </div>
              <div className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>
                {log.user_name||log.vendor_user_name||'System'} · {new Date(log.created_at).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )) : <div className="text-center py-10" style={{ color:'var(--text-muted)' }}>No audit logs yet</div>}
      </div>
    </div>
  );
}
