import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import api from '../utils/api';

const CATEGORIES = [
  { value: 'technology_cloud', label: 'Technology & Cloud Services' },
  { value: 'it_products_software', label: 'IT Products & Software' },
  { value: 'financial_fintech', label: 'Financial & Fintech Partners' },
  { value: 'outsourcing_data', label: 'Outsourcing & Data Processing' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'facilities_operations', label: 'Facilities & Operations' },
];

export default function AddVendor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', legal_name: '', email: '', contact_person: '', contact_phone: '',
    category: '', criticality: '', service_description: '', description: '',
    incorporation_country: 'India', contract_start_date: '', contract_end_date: '',
    contract_value: '', auto_renewal: false
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const vendor = await api.post('/vendors', form);
      navigate(`/vendors/${vendor.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/vendors')} className="btn-glass p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Add Vendor</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Create a new vendor record in Risk360</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="glass-card-flat p-6 space-y-4">
          <h3 className="font-display font-semibold text-white mb-2">Basic Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Vendor Name *</label>
              <input className="glass-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Acme Cloud Pvt Ltd" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Legal Entity Name</label>
              <input className="glass-input" value={form.legal_name} onChange={e => set('legal_name', e.target.value)} placeholder="Same as above if identical" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Vendor Email</label>
              <input type="email" className="glass-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@vendor.com" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contact Person</label>
              <input className="glass-input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contact Phone</label>
              <input className="glass-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country of Incorporation</label>
              <input className="glass-input" value={form.incorporation_country} onChange={e => set('incorporation_country', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Description</label>
            <textarea
              className="glass-input resize-none h-20"
              value={form.service_description}
              onChange={e => set('service_description', e.target.value)}
              placeholder="Describe the services this vendor provides to KVB..."
            />
          </div>
        </div>

        <div className="glass-card-flat p-6 space-y-4">
          <h3 className="font-display font-semibold text-white mb-2">Classification</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Vendor Category</label>
              <select className="glass-input" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select category (or auto-classify)</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Criticality Tier</label>
              <select className="glass-input" value={form.criticality} onChange={e => set('criticality', e.target.value)}>
                <option value="">Select criticality</option>
                <option value="high">High — Sensitive data / critical function</option>
                <option value="medium">Medium — Moderate data access</option>
                <option value="low">Low — Minimal data / low dependency</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card-flat p-6 space-y-4">
          <h3 className="font-display font-semibold text-white mb-2">Contract Details</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contract Start Date</label>
              <input type="date" className="glass-input" value={form.contract_start_date} onChange={e => set('contract_start_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contract End Date</label>
              <input type="date" className="glass-input" value={form.contract_end_date} onChange={e => set('contract_end_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Annual Contract Value (₹)</label>
              <input type="number" className="glass-input" value={form.contract_value} onChange={e => set('contract_value', e.target.value)} placeholder="0" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="auto_renewal" checked={form.auto_renewal} onChange={e => set('auto_renewal', e.target.checked)} className="w-4 h-4 rounded accent-sky-500" />
              <label htmlFor="auto_renewal" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Auto-renewal clause</label>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Building2 size={15} />}
            Create Vendor
          </button>
          <button type="button" onClick={() => navigate('/vendors')} className="btn-glass">Cancel</button>
        </div>
      </form>
    </div>
  );
}
