import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../utils/api';

export default function Renewals() {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renewModal, setRenewModal] = useState(null);
  const [renewForm, setRenewForm] = useState({ new_end_date: '', new_value: '', notes: '' });

  useEffect(() => {
    api.get('/renewals/alerts').then(setAlerts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleRenew = async () => {
    try {
      await api.post(`/renewals/renew/${renewModal.id}`, renewForm);
      setRenewModal(null);
      api.get('/renewals/alerts').then(setAlerts);
    } catch (err) { alert(err.message); }
  };

  const handleHold = async (vendorId) => {
    const reason = prompt('Reason for renewal hold:');
    if (!reason) return;
    try {
      await api.post(`/renewals/hold/${vendorId}`, { reason });
      api.get('/renewals/alerts').then(setAlerts);
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  const buckets = [
    { key: 'overdue', label: 'Overdue', data: alerts?.overdue || [], color: '#f87171', icon: AlertTriangle },
    { key: 'due_30_days', label: 'Due in 30 Days', data: alerts?.due_30_days || [], color: '#fb923c', icon: Clock },
    { key: 'due_60_days', label: 'Due in 60 Days', data: alerts?.due_60_days || [], color: '#fbbf24', icon: Clock },
    { key: 'due_90_days', label: 'Due in 90 Days', data: alerts?.due_90_days || [], color: '#60a5fa', icon: RefreshCw },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Renewal Management</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>90/60/30-day contract renewal tracking</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {buckets.map(({ key, label, data, color, icon: Icon }) => (
          <div key={key} className="glass-card-flat p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} style={{ color }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </div>
            <div className="text-3xl font-bold font-display" style={{ color }}>{data.length}</div>
          </div>
        ))}
      </div>

      {/* Renewal tables by bucket */}
      {buckets.map(({ key, label, data, color }) => data.length > 0 && (
        <div key={key} className="glass-card-flat overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <h3 className="font-display font-semibold text-white">{label}</h3>
            <span className="badge badge-gray ml-auto">{data.length}</span>
          </div>
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Criticality</th><th>Contract End</th><th>Days Left</th><th>Value</th><th>Actions</th></tr></thead>
            <tbody>
              {data.map(v => (
                <tr key={v.id}>
                  <td>
                    <Link to={`/vendors/${v.id}`} className="font-medium text-white hover:text-sky-400 transition-colors">{v.name}</Link>
                  </td>
                  <td><span className={`badge ${v.criticality === 'high' ? 'badge-red' : v.criticality === 'medium' ? 'badge-amber' : 'badge-green'}`}>{v.criticality || '—'}</span></td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(v.contract_end_date).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className="text-sm font-medium" style={{ color }}>
                      {v.days_left != null ? `${Math.floor(v.days_left)} days` : v.days_overdue != null ? `${Math.floor(v.days_overdue)} days ago` : '—'}
                    </span>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {v.contract_value ? `₹${Number(v.contract_value).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setRenewModal(v); setRenewForm({ new_end_date: '', new_value: v.contract_value || '', notes: '' }); }}
                        className="text-xs py-1 px-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 flex items-center gap-1">
                        <CheckCircle size={11} /> Renew
                      </button>
                      <button onClick={() => handleHold(v.id)}
                        className="text-xs py-1 px-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                        Hold
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {alerts?.summary?.total_alerts === 0 && (
        <div className="glass-card-flat p-16 text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-400 opacity-60" />
          <div className="font-display font-semibold text-white mb-2">All contracts are current</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No renewals due in the next 90 days</p>
        </div>
      )}

      {/* Renew modal */}
      {renewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="font-display font-semibold text-white mb-4">Renew Contract — {renewModal.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>New Contract End Date *</label>
                <input type="date" className="glass-input" value={renewForm.new_end_date}
                  onChange={e => setRenewForm(p => ({ ...p, new_end_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>New Contract Value (₹)</label>
                <input type="number" className="glass-input" value={renewForm.new_value}
                  onChange={e => setRenewForm(p => ({ ...p, new_value: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea className="glass-input resize-none h-16 text-sm" value={renewForm.notes}
                  onChange={e => setRenewForm(p => ({ ...p, notes: e.target.value }))} placeholder="Renewal notes..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleRenew} className="btn-primary flex-1">Confirm Renewal</button>
              <button onClick={() => setRenewModal(null)} className="btn-glass">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
