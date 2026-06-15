import React, { useState, useEffect } from 'react';
import { FileCheck, Clock, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import api from '../utils/api';

export default function Documents() {
  const [expiry, setExpiry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/documents/expiry/summary')
      .then(setExpiry)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Documents</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track document expiry and review status across all vendors</p>
      </div>

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

      {expiry?.expired?.length > 0 && (
        <div className="glass-card-flat overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="font-display font-semibold text-white">Expired Documents</h3>
          </div>
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Document Type</th><th>Expired On</th></tr></thead>
            <tbody>
              {expiry.expired.map(d => (
                <tr key={d.id}>
                  <td className="font-medium text-white">{d.vendor_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.document_type}</td>
                  <td><span className="badge badge-red">{new Date(d.valid_until).toLocaleDateString('en-IN')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expiry?.expiring_soon?.length > 0 && (
        <div className="glass-card-flat overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <h3 className="font-display font-semibold text-white">Expiring Soon</h3>
          </div>
          <table className="glass-table">
            <thead><tr><th>Vendor</th><th>Document Type</th><th>Expires On</th></tr></thead>
            <tbody>
              {expiry.expiring_soon.map(d => {
                const days = Math.ceil((new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={d.id}>
                    <td className="font-medium text-white">{d.vendor_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{d.document_type}</td>
                    <td>
                      <span className={`badge ${days <= 7 ? 'badge-red' : 'badge-amber'}`}>
                        {days} days — {new Date(d.valid_until).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(!expiry?.expired?.length && !expiry?.expiring_soon?.length) && (
        <div className="glass-card-flat p-16 text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-400 opacity-60" />
          <div className="font-display font-semibold text-white mb-2">All documents are current</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents expiring in the next 30 days</p>
        </div>
      )}
    </div>
  );
}
