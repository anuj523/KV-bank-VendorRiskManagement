import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LogOut, Building2, ChevronRight, CheckCircle, Clock,
  AlertTriangle, Archive, Search, X, ArrowRight, FileText
} from 'lucide-react';
import api from '../utils/api';

// ── Stage definitions — mirrors backend getNextStage offboarding flow ────────
const STAGES = [
  { key: 'offboarding_notified', label: 'Vendor Notified',  desc: 'Vendor informed of offboarding decision, portal access revoked' },
  { key: 'data_return',          label: 'Data Return',      desc: 'Vendor returns all ABC Bank data assets and confirms deletion' },
  { key: 'access_revoked',       label: 'Access Revoked',   desc: 'All system credentials, API keys, and portal access permanently disabled' },
  { key: 'it_signoff',           label: 'IT Sign-off',      desc: 'IT / InfoSec confirms complete access revocation and credential invalidation' },
  { key: 'legal_signoff',        label: 'Legal Sign-off',   desc: 'Legal confirms NDA obligations met, DPDPA data return, exit clause compliance' },
  { key: 'archived',             label: 'Archived',         desc: 'Vendor fully offboarded and archived. Immutable audit record retained.' },
];

const OFFBOARD_REASONS = [
  'Contract Expired',
  'Risk Threshold Breached',
  'Business Decision / Strategic',
  'Regulatory / Compliance Requirement',
  'Vendor Performance Issues',
  'Consolidation / Replacement',
  'Mutual Agreement',
];

const stageIndex = (key) => STAGES.findIndex(s => s.key === key);

function StageBadge({ stage }) {
  const idx = stageIndex(stage);
  const s = STAGES[idx] || STAGES[0];
  const pct = Math.round(((idx + 1) / STAGES.length) * 100);
  const color = pct === 100 ? '#4ade80' : pct >= 60 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: '600', color }}>{s.label}</span>
    </div>
  );
}

// ── Initiate Offboarding Modal ────────────────────────────────────────────────
function InitiateModal({ vendors, onClose, onDone }) {
  const [vendorId, setVendorId] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only show vendors that can be offboarded (active, suspended, renewal_pending)
  const eligible = vendors.filter(v =>
    ['active', 'suspended', 'renewal_pending', 'under_review'].includes(v.status)
  );

  const handleSubmit = async () => {
    if (!vendorId || !reason) return alert('Please select a vendor and reason');
    setSubmitting(true);
    try {
      await api.post(`/workflows/offboarding/${vendorId}`, {
        reason: reason === 'Other' ? customReason : reason
      });
      onDone();
      onClose();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px'
    }}>
      <div style={{
        background: 'rgba(15,28,53,0.98)', border: '1px solid rgba(248,113,113,0.3)',
        borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px',
        backdropFilter: 'blur(24px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={16} style={{ color: '#f87171' }} />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>Initiate Offboarding</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Vendor portal access revoked immediately</div>
            </div>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        {/* Warning */}
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
          <div style={{ color: '#f87171', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>⚠ This action is irreversible</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Vendor portal access will be revoked immediately. VMO, IT, and Legal sign-off notifications will be sent. The 5-stage offboarding workflow will begin.
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Select Vendor *</label>
            <select className="glass-input" value={vendorId} onChange={e => setVendorId(e.target.value)}>
              <option value="">— Choose vendor —</option>
              {eligible.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.status?.replace(/_/g, ' ')})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Reason for Offboarding *</label>
            <select className="glass-input" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="">— Select reason —</option>
              {OFFBOARD_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          {reason === 'Other' && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Specify reason</label>
              <textarea className="glass-input h-16 resize-none text-sm" placeholder="Enter reason..."
                value={customReason} onChange={e => setCustomReason(e.target.value)} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} className="btn-glass flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '14px',
            background: submitting ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.15)',
            color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', cursor: submitting ? 'not-allowed' : 'pointer'
          }}>
            {submitting ? 'Initiating…' : 'Initiate Offboarding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stage Detail Panel ────────────────────────────────────────────────────────
function StagePanel({ workflow, onClose, onAdvance }) {
  const [notes, setNotes] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const currentIdx = stageIndex(workflow.current_stage);
  const isComplete = workflow.status === 'completed' || workflow.current_stage === 'archived';

  const handleAdvance = async () => {
    if (!notes.trim()) return alert('Please add sign-off notes before advancing');
    setAdvancing(true);
    try {
      await api.patch(`/workflows/${workflow.id}/advance`, { notes });
      onAdvance();
      setNotes('');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally { setAdvancing(false); }
  };

  return (
    <div className="glass-card-flat p-5 space-y-5">
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>{workflow.vendor_name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
            Started: {new Date(workflow.created_at).toLocaleDateString('en-IN')}
          </div>
        </div>
        <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
      </div>

      {/* Reason */}
      {workflow.notes && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>REASON</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{workflow.notes}</div>
        </div>
      )}

      {/* Stage checklist */}
      <div className="space-y-1">
        {STAGES.map((s, i) => {
          const done = i < currentIdx || isComplete;
          const current = i === currentIdx && !isComplete;
          const pending = i > currentIdx && !isComplete;
          return (
            <div key={s.key} style={{
              display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '8px',
              background: current ? 'rgba(248,113,113,0.06)' : 'transparent',
              border: current ? '1px solid rgba(248,113,113,0.15)' : '1px solid transparent',
            }}>
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {done ? (
                  <CheckCircle size={16} style={{ color: '#4ade80' }} />
                ) : current ? (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171' }} />
                  </div>
                ) : (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px', fontWeight: current ? '600' : '400',
                  color: done ? '#4ade80' : current ? 'white' : 'var(--text-muted)'
                }}>{s.label}</div>
                {(done || current) && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
                )}
              </div>
              {done && <CheckCircle size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
              {current && <ArrowRight size={13} style={{ color: '#f87171', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* Sign-off action */}
      {!isComplete && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div style={{ fontSize: '13px', color: 'white', fontWeight: '600' }}>
            Complete: {STAGES[currentIdx]?.label}
          </div>
          <textarea
            className="glass-input text-sm h-20 resize-none"
            placeholder={`Add sign-off notes for "${STAGES[currentIdx]?.label}"...`}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button onClick={handleAdvance} disabled={advancing} style={{
            width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '13px',
            background: 'rgba(248,113,113,0.12)', color: '#f87171',
            border: '1px solid rgba(248,113,113,0.3)', cursor: advancing ? 'not-allowed' : 'pointer'
          }}>
            {advancing ? 'Saving…' : `✓ Sign off & advance to ${STAGES[currentIdx + 1]?.label || 'Archive'}`}
          </button>
        </div>
      )}

      {isComplete && (
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(74,222,128,0.06)', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.15)' }}>
          <CheckCircle size={20} style={{ color: '#4ade80', margin: '0 auto 6px' }} />
          <div style={{ color: '#4ade80', fontWeight: '600', fontSize: '14px' }}>Offboarding Complete</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Vendor archived. Audit trail retained.</div>
        </div>
      )}

      {/* Link to vendor detail */}
      <Link to={`/vendors/${workflow.vendor_id}`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '8px', borderRadius: '8px', fontSize: '12px', color: '#38bdf8',
        background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)',
        textDecoration: 'none'
      }}>
        <FileText size={12} /> View Full Vendor Profile
      </Link>
    </div>
  );
}

// ── Main Offboarding Page ─────────────────────────────────────────────────────
export default function Offboarding() {
  const [vendors, setVendors] = useState([]);
  const [activeWorkflows, setActiveWorkflows] = useState([]);
  const [archivedVendors, setArchivedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitiate, setShowInitiate] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [search, setSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorRes, workflowRes, archivedRes] = await Promise.all([
        api.get('/vendors?limit=100'),
        api.get('/workflows?workflow_type=offboarding&status=in_progress'),
        api.get('/vendors?status=offboarded&limit=100'),
      ]);
      setVendors(vendorRes.vendors || []);
      setActiveWorkflows(workflowRes || []);
      setArchivedVendors(archivedRes.vendors || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // If selected workflow is refreshed, update it
  const handleAdvance = () => {
    loadData();
    setSelectedWorkflow(null);
  };

  const filteredActive = activeWorkflows.filter(w =>
    !search || w.vendor_name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredArchived = archivedVendors.filter(v =>
    !archiveSearch || v.name?.toLowerCase().includes(archiveSearch.toLowerCase())
  );

  // Stats
  const totalActive = activeWorkflows.length;
  const nearingCompletion = activeWorkflows.filter(w => stageIndex(w.current_stage) >= 3).length;
  const completedThisMonth = archivedVendors.filter(v => {
    const d = new Date(v.updated_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const pendingSignoffs = activeWorkflows.reduce((sum, w) => {
    return sum + (STAGES.length - 1 - stageIndex(w.current_stage));
  }, 0);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Offboarding</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage vendor exit — 5-stage sign-off chain with audit trail
          </p>
        </div>
        <button
          onClick={() => setShowInitiate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '14px',
            background: 'rgba(248,113,113,0.12)', color: '#f87171',
            border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer'
          }}
        >
          <LogOut size={15} /> Initiate Offboarding
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Offboardings', value: totalActive, color: '#f87171', icon: LogOut },
          { label: 'Pending Sign-offs', value: pendingSignoffs, color: '#fbbf24', icon: Clock },
          { label: 'Nearing Completion', value: nearingCompletion, color: '#a78bfa', icon: ChevronRight },
          { label: 'Archived This Month', value: completedThisMonth, color: '#4ade80', icon: Archive },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass-card-flat p-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Icon size={15} style={{ color }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color, fontFamily: 'var(--font-display)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Offboarding pipeline explanation */}
      <div className="glass-card-flat p-4">
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          5-Stage Sign-off Pipeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto' }}>
          {STAGES.map((s, i) => (
            <React.Fragment key={s.key}>
              <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 4px',
                  background: i === 5 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${i === 5 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700', color: i === 5 ? '#4ade80' : '#f87171'
                }}>{i + 1}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ flex: '1 0 20px', height: '1px', background: 'rgba(255,255,255,0.1)', minWidth: '16px' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Active Offboardings ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 className="font-display font-semibold text-white">Active Offboardings</h2>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="glass-input text-sm pl-8" style={{ width: '200px' }} placeholder="Search vendor..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Table */}
            <div className={`${selectedWorkflow ? 'lg:col-span-2' : 'lg:col-span-3'} glass-card-flat overflow-hidden`}>
              {filteredActive.length === 0 ? (
                <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
                  <LogOut size={36} className="mx-auto mb-2 opacity-30" />
                  {activeWorkflows.length === 0 ? 'No active offboardings' : 'No results for search'}
                </div>
              ) : (
                <table className="glass-table">
                  <thead>
                    <tr><th>Vendor</th><th>Reason</th><th>Current Stage</th><th>Due</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {filteredActive.map(w => {
                      const isSelected = selectedWorkflow?.id === w.id;
                      const overdue = w.due_date && new Date(w.due_date) < new Date();
                      return (
                        <tr key={w.id} style={{ background: isSelected ? 'rgba(248,113,113,0.05)' : '' }}>
                          <td>
                            <div style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>{w.vendor_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Started {new Date(w.created_at).toLocaleDateString('en-IN')}
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '160px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {w.notes || '—'}
                            </div>
                          </td>
                          <td><StageBadge stage={w.current_stage} /></td>
                          <td style={{ fontSize: '12px', color: overdue ? '#f87171' : 'var(--text-muted)', fontWeight: overdue ? '600' : '400' }}>
                            {w.due_date ? new Date(w.due_date).toLocaleDateString('en-IN') : '—'}
                            {overdue && <div style={{ fontSize: '10px', color: '#f87171' }}>OVERDUE</div>}
                          </td>
                          <td>
                            <button
                              onClick={() => setSelectedWorkflow(isSelected ? null : w)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
                                background: isSelected ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
                                color: isSelected ? '#f87171' : 'var(--text-secondary)',
                                border: `1px solid ${isSelected ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                cursor: 'pointer'
                              }}
                            >
                              {isSelected ? 'Close' : 'Sign-offs'} <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Stage panel */}
            {selectedWorkflow && (
              <StagePanel
                workflow={selectedWorkflow}
                onClose={() => setSelectedWorkflow(null)}
                onAdvance={handleAdvance}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Archived Vendors ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 className="font-display font-semibold text-white">Archived Vendors</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Fully offboarded — audit records retained permanently
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="glass-input text-sm pl-8" style={{ width: '200px' }} placeholder="Search archived..."
              value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
          </div>
        </div>

        <div className="glass-card-flat overflow-hidden">
          {filteredArchived.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <Archive size={32} className="mx-auto mb-2 opacity-30" />
              No archived vendors yet
            </div>
          ) : (
            <table className="glass-table">
              <thead>
                <tr><th>Vendor</th><th>Category</th><th>Criticality</th><th>Risk Rating</th><th>Offboarded On</th><th>Profile</th></tr>
              </thead>
              <tbody>
                {filteredArchived.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>{v.name}</div>
                      {v.legal_name && v.legal_name !== v.name && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.legal_name}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {v.category?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td>
                      {v.criticality ? (
                        <span style={{
                          background: v.criticality === 'high' ? 'rgba(248,113,113,0.12)' : v.criticality === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(96,165,250,0.12)',
                          color: v.criticality === 'high' ? '#f87171' : v.criticality === 'medium' ? '#fbbf24' : '#60a5fa',
                          border: `1px solid ${v.criticality === 'high' ? 'rgba(248,113,113,0.3)' : v.criticality === 'medium' ? 'rgba(251,191,36,0.25)' : 'rgba(96,165,250,0.25)'}`,
                          borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize'
                        }}>{v.criticality}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {v.risk_rating ? (
                        <span style={{
                          background: v.risk_rating === 'high' ? 'rgba(248,113,113,0.12)' : v.risk_rating === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)',
                          color: v.risk_rating === 'high' ? '#f87171' : v.risk_rating === 'medium' ? '#fbbf24' : '#4ade80',
                          borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize'
                        }}>{v.risk_rating} risk</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {v.updated_at ? new Date(v.updated_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <Link to={`/vendors/${v.id}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '12px', color: '#38bdf8',
                        background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
                        borderRadius: '6px', padding: '3px 10px', textDecoration: 'none'
                      }}>
                        <Building2 size={11} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Initiate modal */}
      {showInitiate && (
        <InitiateModal
          vendors={vendors}
          onClose={() => setShowInitiate(false)}
          onDone={loadData}
        />
      )}
    </div>
  );
}
