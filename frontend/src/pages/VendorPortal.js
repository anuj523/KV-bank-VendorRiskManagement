import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, AlertTriangle, Upload, X, FileCheck, TrendingUp } from 'lucide-react';
import api from '../utils/api';

// ============================================================
// VENDOR PORTAL QUESTIONNAIRE
// ============================================================
const CATEGORIES = [
  { value: 'technology_cloud', label: 'Technology & Cloud Services' },
  { value: 'it_products_software', label: 'IT Products & Software' },
  { value: 'financial_fintech', label: 'Financial & Fintech' },
  { value: 'outsourcing_data', label: 'Outsourcing & Data Processing' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'facilities_operations', label: 'Facilities & Operations' },
];

export function VendorQuestionnaire() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState({});
  const [vendor, setVendor] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [saved, setSaved] = useState(false);
  const [noCategory, setNoCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const loadQuestionnaire = (categoryOverride) => {
    if (!user?.vendor_id) return;
    const url = `/risk/${user.vendor_id}/questionnaire${categoryOverride ? `?category=${categoryOverride}` : ''}`;
    api.get(url)
      .then(data => {
        setVendor(data.vendor);
        setNoCategory(data.no_category);
        setQuestions(data.questions || []);
        const ans = {}, n = {};
        (data.responses || []).forEach(r => {
          ans[r.question_key] = r.answer;
          if (r.notes) n[r.question_key] = r.notes;
        });
        setResponses(ans);
        setNotes(n);
        setActiveGroup(data.questions?.[0]?.domain);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadQuestionnaire(); }, [user]);

  const byDomain = questions.reduce((acc, q) => {
    if (!acc[q.domain]) acc[q.domain] = [];
    acc[q.domain].push(q);
    return acc;
  }, {});

  const DOMAIN_LABELS = {
    cybersecurity: 'Cybersecurity', operational: 'Operational',
    compliance_legal: 'Compliance & Legal', financial: 'Financial', reputational: 'Reputational'
  };

  const ANSWER_OPTIONS = [
    { value: 'compliant', label: 'Compliant', color: '#4ade80' },
    { value: 'partially_compliant', label: 'Partial', color: '#fbbf24' },
    { value: 'non_compliant', label: 'Non-Compliant', color: '#f87171' },
    { value: 'na', label: 'N/A', color: 'var(--text-muted)' },
  ];

  const progress = questions.length ? Math.round((Object.keys(responses).length / questions.length) * 100) : 0;

  const handleSave = async () => {
    // Check all questions are answered
    const unanswered = questions.filter(q => !responses[q.key]);
    if (unanswered.length > 0) {
      // Find which domains have unanswered questions
      const domainsMissing = [...new Set(unanswered.map(q => q.domain))];
      const DOMAIN_LABELS = {
        cybersecurity: 'Cybersecurity', operational: 'Operational',
        compliance_legal: 'Compliance & Legal', financial: 'Financial', reputational: 'Reputational'
      };
      alert(
        `⚠️ All questions must be answered before saving.\n\n` +
        `${unanswered.length} question${unanswered.length > 1 ? 's' : ''} unanswered in:\n` +
        domainsMissing.map(d => `  • ${DOMAIN_LABELS[d] || d}`).join('\n') +
        `\n\nPlease go through each domain tab and answer all questions.`
      );
      // Switch to first domain with unanswered questions
      setActiveGroup(domainsMissing[0]);
      return;
    }

    setSaving(true);
    try {
      const payload = questions.map(q => ({
        question_key: q.key, domain: q.domain, question_text: q.text,
        answer: responses[q.key], notes: notes[q.key] || null,
        is_regulatory_tagged: q.is_regulatory_tagged, regulatory_ref: q.regulatory_ref
      }));
      await api.post(`/risk/${user.vendor_id}/questionnaire`, { responses: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  if (!vendor) return <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
    No vendor associated with this account.
  </div>;

  // Show category picker if no category set
  if (noCategory || !vendor.category) {
    return (
      <div className="space-y-6 animate-in max-w-lg">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Risk Questionnaire</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{vendor.name}</p>
        </div>
        <div className="glass-card-flat p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(74,159,212,0.1)', border: '1px solid rgba(74,159,212,0.2)' }}>
            <span className="text-sky-400 text-lg">ℹ</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Your vendor category hasn't been set yet. Please select the category that best describes your services to ABC — this determines which questions you'll be asked.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Select your vendor category *</label>
            <select className="glass-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="">— Choose category —</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => { if (!selectedCategory) return alert('Please select a category'); setLoading(true); loadQuestionnaire(selectedCategory); }}
            className="btn-primary w-full"
            disabled={!selectedCategory}
          >
            Load My Questionnaire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Risk Questionnaire</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {vendor.name} · {vendor.category?.replace(/_/g, ' ')} · Please answer all questions honestly
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium" style={{ color: progress === 100 ? '#4ade80' : 'white' }}>
            {progress === 100 ? '✓ All answered' : `${Object.keys(responses).length} / ${questions.length} answered`}
          </div>
          <div className="w-32 h-2 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${progress}%`,
              background: progress === 100 ? '#4ade80' : 'linear-gradient(90deg,#4a9fd4,#0ea5a0)'
            }} />
          </div>
          {progress < 100 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {questions.length - Object.keys(responses).length} remaining
            </div>
          )}
        </div>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {Object.keys(byDomain).map(domain => {
          const qs = byDomain[domain];
          const answered = qs.filter(q => responses[q.key]).length;
          return (
            <button key={domain} onClick={() => setActiveGroup(domain)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${activeGroup === domain ? 'bg-white/10 text-white border border-white/15' : 'text-white/50 hover:text-white/80'}`}>
              {DOMAIN_LABELS[domain] || domain}
              <span className={`badge text-xs ${answered === qs.length ? 'badge-green' : answered > 0 ? 'badge-amber' : 'badge-red'}`}>
                {answered === qs.length ? '✓' : `${answered}/${qs.length}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Questions */}
      {activeGroup && byDomain[activeGroup] && (
        <div className="glass-card-flat p-6 space-y-6">
          <h3 className="font-display font-semibold text-white">{DOMAIN_LABELS[activeGroup] || activeGroup}</h3>
          {byDomain[activeGroup].map((q, idx) => (
            <div key={q.key} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-medium mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Q{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm text-white font-medium leading-relaxed">{q.text}</p>
                  {q.is_regulatory_tagged && (
                    <span className="inline-flex items-center gap-1 mt-1 badge badge-amber text-xs">⚠ {q.regulatory_ref}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-6 flex-wrap">
                {ANSWER_OPTIONS.map(({ value, label, color }) => {
                  const selected = responses[q.key] === value;
                  return (
                    <button key={value} onClick={() => setResponses(p => ({ ...p, [q.key]: value }))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all"
                      style={selected ? { background: `${color}18`, border: `1px solid ${color}40`, color } : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {responses[q.key] && responses[q.key] !== 'compliant' && responses[q.key] !== 'na' && (
                <NoteInput questionKey={q.key} value={notes[q.key] || ''}
                  onChange={val => setNotes(p => ({ ...p, [q.key]: val }))} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
          style={progress < 100 ? { opacity: 0.7 } : {}}
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <CheckCircle size={15} />}
          {progress === 100 ? 'Save & Score' : `Save (${questions.length - Object.keys(responses).length} unanswered)`}
        </button>
        {saved && <span className="text-sm" style={{ color: '#4ade80' }}>✓ Saved & scored successfully</span>}
        {progress < 100 && !saving && (
          <span className="text-xs" style={{ color: '#fbbf24' }}>
            ⚠ All {questions.length} questions must be answered
          </span>
        )}
      </div>
    </div>
  );
}

// Note input — outside parent to avoid re-render cursor jumping
function NoteInput({ questionKey, value, onChange }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.value = value; }, []);
  return (
    <textarea ref={ref} className="glass-input text-xs h-14 resize-none mt-3 ml-6 w-full"
      placeholder="Add notes or evidence reference..."
      onBlur={e => onChange(e.target.value)} />
  );
}

// ============================================================
// VENDOR PORTAL DOCUMENTS
// ============================================================
export function VendorDocuments() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ document_type: '', valid_from: '', valid_until: '' });
  const [file, setFile] = useState(null);
  const [aiTip, setAiTip] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const fileRef = useRef();

  const CATEGORY_REQUIRED_DOCS = {
    technology_cloud: [
      { name: 'SOC 2 Type II Report', critical: true, why: 'Required under RBI TPRM guidelines for cloud service providers' },
      { name: 'ISO 27001 Certificate', critical: true, why: 'Mandatory information security certification' },
      { name: 'Penetration Test Report', critical: true, why: 'Required to verify security posture of systems handling bank data' },
      { name: 'Business Continuity Plan', critical: true, why: 'RBI/2021-22/117 mandates BCP documentation' },
      { name: 'Data Processing Agreement', critical: true, why: 'DPDPA-2023 requires formal data processing agreement' },
      { name: 'Insurance Certificate', critical: false, why: 'Cyber liability insurance recommended for cloud vendors' },
      { name: 'NDA / Confidentiality Agreement', critical: false, why: 'Protects confidential bank data and processes' },
      { name: 'VAPT Report', critical: false, why: 'Vulnerability assessment confirms application-level security' },
    ],
    it_products_software: [
      { name: 'SOC 2 Type II Report', critical: true, why: 'Validates security controls for software handling bank data' },
      { name: 'Penetration Test Report', critical: true, why: 'Confirms product-level security before deployment' },
      { name: 'VAPT Report', critical: true, why: 'Required for all software products integrated with bank systems' },
      { name: 'ISO 27001 Certificate', critical: true, why: 'Information security management certification' },
      { name: 'Data Processing Agreement', critical: true, why: 'DPDPA-2023 compliance for data handling' },
      { name: 'Insurance Certificate', critical: false, why: 'Professional indemnity cover for software defects' },
      { name: 'NDA / Confidentiality Agreement', critical: false, why: 'Protects bank IP and data shared during integration' },
    ],
    financial_fintech: [
      { name: 'SOC 2 Report', critical: true, why: 'RBI TPRM mandates SOC 2 for all fintech partners' },
      { name: 'ISO 27001 Certificate', critical: true, why: 'Information security baseline required by RBI' },
      { name: 'Penetration Test Report', critical: true, why: 'Required for any vendor handling financial transactions' },
      { name: 'Audited Financial Statements', critical: true, why: 'Financial stability verification per RBI outsourcing guidelines' },
      { name: 'Insurance Certificate', critical: true, why: 'Cyber liability and professional indemnity mandatory for fintech' },
      { name: 'BCP / DR Plan', critical: true, why: 'Business continuity critical for financial service continuity' },
      { name: 'Data Processing Agreement', critical: true, why: 'DPDPA-2023 and RBI data localisation compliance' },
      { name: 'Regulatory Compliance Certificate', critical: true, why: 'RBI/SEBI/IRDAI licence verification required' },
      { name: 'Sanctions / Adverse Media Screening', critical: true, why: 'PMLA-2002 AML/KYC compliance requirement' },
    ],
    outsourcing_data: [
      { name: 'Data Processing Agreement', critical: true, why: 'DPDPA-2023 mandates formal DPA for all data processors' },
      { name: 'ISO 27001 Certificate', critical: true, why: 'Required for any vendor processing bank customer data' },
      { name: 'SOC 2 Type II Report', critical: true, why: 'Controls assurance for outsourced data processing' },
      { name: 'Business Continuity Plan', critical: true, why: 'Operational resilience for critical outsourced functions' },
      { name: 'Penetration Test Report', critical: true, why: 'Security validation for systems handling outsourced bank data' },
      { name: 'NDA / Confidentiality Agreement', critical: true, why: 'Confidentiality of customer data legally protected' },
      { name: 'Insurance Certificate', critical: false, why: 'Data breach insurance recommended' },
      { name: 'RBI Compliance Certificate', critical: false, why: 'RBI outsourcing framework compliance' },
    ],
    professional_services: [
      { name: 'Insurance Certificate', critical: true, why: 'Professional indemnity insurance required for consultants' },
      { name: 'NDA / Confidentiality Agreement', critical: true, why: 'Access to confidential bank information requires NDA' },
      { name: 'Company Registration', critical: true, why: 'Legal entity verification mandatory' },
      { name: 'Financial Statements', critical: false, why: 'Financial stability check for significant engagements' },
      { name: 'Data Processing Agreement', critical: false, why: 'If consultant handles any personal data' },
      { name: 'ISO 27001 Certificate', critical: false, why: 'Recommended for IT-related professional services' },
    ],
    facilities_operations: [
      { name: 'Insurance Certificate', critical: true, why: 'Liability insurance mandatory for on-premises vendors' },
      { name: 'Company Registration', critical: true, why: 'Legal entity verification required' },
      { name: 'Business Continuity Plan', critical: true, why: 'Continuity of critical facility services' },
      { name: 'Financial Statements', critical: false, why: 'Financial stability for long-term facility contracts' },
      { name: 'NDA / Confidentiality Agreement', critical: false, why: 'Staff with bank premises access require NDA' },
    ],
  };

  const ALL_DOCUMENT_TYPES = [
    'SOC 2 Type II Report', 'SOC 2 Report', 'ISO 27001 Certificate', 'Penetration Test Report',
    'Business Continuity Plan', 'BCP / DR Plan', 'Insurance Certificate',
    'NDA / Confidentiality Agreement', 'Data Processing Agreement', 'VAPT Report',
    'Financial Statements', 'Audited Financial Statements', 'Company Registration',
    'RBI Compliance Certificate', 'Regulatory Compliance Certificate',
    'Sanctions / Adverse Media Screening', 'PCI DSS Certificate', 'Other'
  ];

  const fetchDocs = () => {
    if (!user?.vendor_id) return;
    api.get(`/documents/vendor/${user.vendor_id}`)
      .then(d => setDocs(Array.isArray(d) ? d : d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.vendor_id) return;
    api.get(`/vendors/${user.vendor_id}`).then(setVendor).catch(console.error);
    fetchDocs();
  }, [user]);

  // Load AI tip when vendor category is known
  useEffect(() => {
    if (!vendor?.category || aiTip) return;
    setAiLoading(true);
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a compliance assistant in ABC Bank's vendor portal. The vendor is in the "${vendor.category.replace(/_/g,' ')}" category.

Write a SHORT (3-4 sentences max) helpful message to the vendor explaining:
1. Why their specific document set is required
2. The key regulatory frameworks that apply to them (RBI, DPDPA-2023, PMLA etc.)
3. One practical tip for faster approval

Be warm, direct, and vendor-friendly. No bullet points. No markdown. Plain text only.`
        }]
      })
    })
    .then(r => r.json())
    .then(d => setAiTip(d.content?.[0]?.text || ''))
    .catch(() => setAiTip(''))
    .finally(() => setAiLoading(false));
  }, [vendor?.category]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.document_type) return alert('Please select a file and document type');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('vendor_id', user.vendor_id);
      fd.append('document_type', form.document_type);
      fd.append('valid_from', form.valid_from);
      fd.append('valid_until', form.valid_until);
      await api.upload('/documents/upload', fd);
      setShowUpload(false);
      setFile(null);
      setForm({ document_type: '', valid_from: '', valid_until: '' });
      fetchDocs();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally { setUploading(false); }
  };

  const quickUpload = (docName) => {
    setForm(p => ({ ...p, document_type: docName }));
    setShowUpload(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const matchDoc = (docName) =>
    docs.find(d =>
      d.document_type?.toLowerCase().includes(docName.toLowerCase()) ||
      docName.toLowerCase().includes(d.document_type?.toLowerCase())
    );

  const checklist = vendor?.category ? (CATEGORY_REQUIRED_DOCS[vendor.category] || []) : [];
  const criticalDocs = checklist.filter(d => d.critical);
  const uploaded = checklist.filter(d => matchDoc(d.name));
  const approved = checklist.filter(d => { const m = matchDoc(d.name); return m && m.status === 'approved'; });
  const completionPct = criticalDocs.length > 0
    ? Math.round((approved.filter(d => d.critical).length / criticalDocs.length) * 100)
    : 0;
  const rejectedDocs = docs.filter(d => d.status === 'rejected');

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Documents</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Upload compliance documents for ABC Bank review</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary flex items-center gap-2">
          <Upload size={15} /> Upload Document
        </button>
      </div>

      {/* AI Tip Banner */}
      {(aiLoading || aiTip) && (
        <div style={{
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
          }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#a78bfa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              AI Compliance Guide · {vendor?.category?.replace(/_/g, ' ')}
            </div>
            {aiLoading ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Generating guidance for your category…</span>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{aiTip}</p>
            )}
          </div>
        </div>
      )}

      {/* Completion progress */}
      {checklist.length > 0 && (
        <div className="glass-card-flat p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>
              Document Completion — Critical Requirements
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: completionPct === 100 ? '#4ade80' : completionPct >= 50 ? '#fbbf24' : '#f87171' }}>
              {approved.filter(d => d.critical).length} / {criticalDocs.length} approved
            </div>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${completionPct}%`, height: '100%', borderRadius: '4px',
              background: completionPct === 100 ? '#4ade80' : completionPct >= 50 ? '#fbbf24' : '#f87171',
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {completionPct === 100
              ? '✓ All critical documents approved — your compliance is complete'
              : `${criticalDocs.length - approved.filter(d => d.critical).length} critical document(s) still needed for full compliance`}
          </div>
        </div>
      )}

      {/* Rejection alerts */}
      {rejectedDocs.length > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ color: '#f87171', fontWeight: '600', fontSize: '13px', marginBottom: '8px' }}>
            ⚠ {rejectedDocs.length} document{rejectedDocs.length > 1 ? 's' : ''} rejected — please re-upload
          </div>
          {rejectedDocs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(248,113,113,0.1)' }}>
              <div>
                <div style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>{d.document_type}</div>
                {d.rejection_reason && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '2px' }}>{d.rejection_reason}</div>}
              </div>
              <button onClick={() => quickUpload(d.document_type)} style={{
                padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                background: 'rgba(248,113,113,0.12)', color: '#f87171',
                border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer'
              }}>Re-upload</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <div className="glass-card-flat p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">Upload Document</h4>
            <button onClick={() => setShowUpload(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Document Type *</label>
              <select className="glass-input" value={form.document_type}
                onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} required>
                <option value="">Select type…</option>
                {checklist.length > 0 && (
                  <optgroup label="Required for your category">
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
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>File * (PDF, DOCX, XLSX, PNG — max 20MB)</label>
              <div className="glass-input flex items-center gap-3 cursor-pointer" onClick={() => fileRef.current.click()} style={{ borderStyle: 'dashed' }}>
                <Upload size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: file ? 'white' : 'var(--text-muted)' }}>{file ? file.name : 'Click to select file…'}</span>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files[0])} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
                {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="btn-glass">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Required documents checklist */}
      {checklist.length > 0 && (
        <div className="glass-card-flat overflow-hidden">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={15} style={{ color: '#a78bfa' }} />
            <span style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>Required Documents for Your Category</span>
            <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {checklist.length} documents · {criticalDocs.length} critical
            </span>
          </div>
          <div style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
            {checklist.map((req, i) => {
              const uploaded = matchDoc(req.name);
              const isApproved = uploaded?.status === 'approved';
              const isPending = uploaded && !isApproved && uploaded.status !== 'rejected';
              const isRejected = uploaded?.status === 'rejected';
              const isExpired = uploaded?.valid_until && new Date(uploaded.valid_until) < new Date();

              let statusLabel = 'Missing';
              let statusColor = '#f87171';
              let dotColor = 'rgba(248,113,113,0.4)';
              if (uploaded) {
                if (isRejected) { statusLabel = 'Rejected — re-upload'; statusColor = '#f87171'; dotColor = '#f87171'; }
                else if (isExpired) { statusLabel = 'Expired'; statusColor = '#f87171'; dotColor = '#f87171'; }
                else if (isPending) { statusLabel = 'Pending Review'; statusColor = '#fbbf24'; dotColor = '#fbbf24'; }
                else if (isApproved) { statusLabel = 'Approved ✓'; statusColor = '#4ade80'; dotColor = '#4ade80'; }
              }

              return (
                <div key={req.name} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 18px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: isApproved ? 'rgba(74,222,128,0.02)' : 'transparent'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'white', fontWeight: '500' }}>
                      {req.name}
                      {req.critical && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#a78bfa', fontWeight: '700' }}>CRITICAL</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{req.why}</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: statusColor, flexShrink: 0 }}>{statusLabel}</div>
                  {!isApproved && (
                    <button onClick={() => quickUpload(req.name)} style={{
                      padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                      background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
                      border: '1px solid rgba(56,189,248,0.2)', cursor: 'pointer', flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}>
                      {isRejected || isExpired ? 'Re-upload' : uploaded ? 'Replace' : 'Upload'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploaded documents table */}
      <div className="glass-card-flat overflow-hidden">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={15} style={{ color: '#38bdf8' }} />
          <span style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>Uploaded Documents</span>
          <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>({docs.length})</span>
        </div>
        <table className="glass-table">
          <thead><tr><th>Document</th><th>Status</th><th>Valid Until</th><th>Uploaded</th></tr></thead>
          <tbody>
            {docs.length ? docs.map(d => (
              <tr key={d.id}>
                <td>
                  <div className="font-medium text-white text-sm">{d.document_type}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.file_name}</div>
                </td>
                <td>
                  <span className={`badge ${d.status === 'approved' ? 'badge-green' : d.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                    {d.status || 'pending'}
                  </span>
                  {d.rejection_reason && <div className="text-xs mt-1" style={{ color: '#f87171' }}>{d.rejection_reason}</div>}
                </td>
                <td className="text-sm" style={{ color: d.valid_until && new Date(d.valid_until) < new Date() ? '#f87171' : 'var(--text-muted)' }}>
                  {d.valid_until ? new Date(d.valid_until).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {new Date(d.created_at || d.uploaded_at).toLocaleDateString('en-IN')}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <FileCheck size={36} className="mx-auto mb-3 opacity-30" />
                No documents uploaded yet — use the checklist above to get started
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function VendorFindings() {
  const { user } = useAuth();
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.vendor_id) return;
    api.get(`/findings?vendor_id=${user.vendor_id}&limit=50`)
      .then(data => setFindings(data.findings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const submitEvidence = async (findingId, notes) => {
    try {
      await api.patch(`/findings/${findingId}`, { status: 'evidence_submitted', evidence_notes: notes });
      api.get(`/findings?vendor_id=${user.vendor_id}&limit=50`).then(data => setFindings(data.findings || []));
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">My Findings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Compliance gaps identified during assessment — submit evidence to close them
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open', count: findings.filter(f => !['closed','verified'].includes(f.status)).length, color: '#f87171' },
          { label: 'In Progress', count: findings.filter(f => ['assigned','in_progress','evidence_submitted'].includes(f.status)).length, color: '#fbbf24' },
          { label: 'Closed', count: findings.filter(f => ['closed','verified'].includes(f.status)).length, color: '#4ade80' },
        ].map(({ label, count, color }) => (
          <div key={label} className="glass-card-flat p-4">
            <div className="text-2xl font-bold font-display" style={{ color }}>{count}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {findings.length ? findings.map(f => (
          <div key={f.id} className="glass-card-flat p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>{f.severity}</span>
                  <span className="badge badge-gray text-xs">{f.status?.replace(/_/g, ' ')}</span>
                  {f.is_regulatory && <span className="badge badge-amber text-xs">Regulatory</span>}
                </div>
                <div className="font-medium text-white text-sm">{f.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{f.domain?.replace(/_/g,' ')} · Due: {f.target_date ? new Date(f.target_date).toLocaleDateString('en-IN') : '—'}</div>
                {f.description && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>}
                {f.evidence_notes && (
                  <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(74,222,128,0.06)', color: '#4ade80' }}>
                    Evidence submitted: {f.evidence_notes}
                  </div>
                )}
              </div>
            </div>
            {['raised','assigned','in_progress'].includes(f.status) && (
              <div className="mt-3">
                {f.status === 'raised' && (
                  <div className="mb-2 text-xs p-2 rounded-lg" style={{ background: 'rgba(74,159,212,0.08)', color: 'var(--text-secondary)' }}>
                    This finding has been raised. You can submit evidence of remediation below.
                  </div>
                )}
                <EvidenceForm findingId={f.id} onSubmit={submitEvidence} />
              </div>
            )}
          </div>
        )) : (
          <div className="glass-card-flat p-16 text-center">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-400 opacity-60" />
            <div className="font-display font-semibold text-white mb-2">No findings</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Great — no compliance gaps identified yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceForm({ findingId, onSubmit }) {
  const ref = useRef();
  return (
    <div className="mt-3 space-y-2">
      <textarea ref={ref} className="glass-input text-xs h-16 resize-none w-full"
        placeholder="Describe the evidence or corrective action taken..." />
      <button onClick={() => { if (ref.current?.value) onSubmit(findingId, ref.current.value); else alert('Please describe the evidence first'); }}
        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
        <CheckCircle size={12} /> Submit Evidence
      </button>
    </div>
  );
}

// ============================================================
// VENDOR PORTAL RISK SCORES VIEW
// ============================================================
export function VendorRiskScores() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.vendor_id) return;
    api.get(`/risk/${user.vendor_id}/scores`)
      .then(scores => setData(scores))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const ScoreBar = ({ label, value }) => {
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
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  const latest = data?.[0];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">My Risk Score</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your current compliance and risk assessment scores</p>
      </div>

      {latest ? (
        <>
          <div className="glass-card-flat p-6">
            <div className="flex items-center gap-6 mb-6">
              <div>
                <div className="text-5xl font-bold font-display" style={{ color: latest.overall_score >= 80 ? '#4ade80' : latest.overall_score >= 50 ? '#fbbf24' : '#f87171' }}>
                  {latest.overall_score}%
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Overall · <span className="font-medium" style={{ color: latest.risk_rating === 'low' ? '#4ade80' : latest.risk_rating === 'medium' ? '#fbbf24' : '#f87171' }}>
                    {latest.risk_rating} risk
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Last scored: {new Date(latest.scored_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div className="flex-1" />
              <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(74,159,212,0.08)', color: 'var(--text-secondary)', maxWidth: 220 }}>
                <strong className="text-white">How to improve:</strong> Answer more questionnaire items as Compliant and upload supporting documents
              </div>
            </div>
            <div className="space-y-4">
              <ScoreBar label="Cybersecurity" value={latest.cybersecurity_score} />
              <ScoreBar label="Operational" value={latest.operational_score} />
              <ScoreBar label="Compliance & Legal" value={latest.compliance_score} />
              <ScoreBar label="Financial" value={latest.financial_score} />
              <ScoreBar label="Reputational" value={latest.reputational_score} />
            </div>
          </div>

          {data.length > 1 && (
            <div className="glass-card-flat p-5">
              <h3 className="font-display font-semibold text-white mb-4">Score History</h3>
              <div className="space-y-2">
                {data.slice(0, 5).map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{new Date(s.scored_at).toLocaleDateString('en-IN')}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full" style={{ width: `${s.overall_score}%`, background: s.overall_score >= 80 ? '#4ade80' : s.overall_score >= 50 ? '#fbbf24' : '#f87171' }} />
                      </div>
                      <span className="text-sm font-medium text-white">{s.overall_score}%</span>
                      <span className={`badge text-xs ${s.risk_rating === 'low' ? 'badge-green' : s.risk_rating === 'medium' ? 'badge-amber' : 'badge-red'}`}>{s.risk_rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card-flat p-16 text-center">
          <TrendingUp size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <div className="font-display font-semibold text-white mb-2">No score yet</div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Complete the questionnaire to generate your risk score</p>
          <a href="/portal/questionnaire" className="btn-primary inline-flex items-center gap-2 text-sm">
            Go to Questionnaire
          </a>
        </div>
      )}
    </div>
  );
}
