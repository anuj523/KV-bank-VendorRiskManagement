import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Eye, EyeOff, ArrowRight, Building2 } from 'lucide-react';

export default function Login() {
  const [tab, setTab] = useState('internal'); // internal | vendor
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, tab === 'vendor');
      navigate(tab === 'vendor' ? '/portal/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #4a9fd4, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #0ea5a0, transparent)', filter: 'blur(60px)' }} />
      </div>

      <div className="w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #4a9fd4, #0ea5a0)', boxShadow: '0 8px 24px rgba(74,159,212,0.35)' }}>
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">Vendor Risk360</h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">ABC Bank • TPRM Platform</p>
        </div>

        <div className="glass-card p-8">
          {/* Tab selector */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {[
              { key: 'internal', label: 'ABC Staff', icon: Shield },
              { key: 'vendor', label: 'Vendor Portal', icon: Building2 }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? 'bg-white/12 text-white shadow-sm border border-white/15'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input"
                placeholder={tab === 'vendor' ? 'vendor@company.com' : 'you@abcbank.com'}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="glass-input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {tab === 'internal' && (
            <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              Default admin: admin@abcbank.com / Admin@123
            </p>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          All data stored in India • RBI Compliant • Confidential
        </p>
      </div>
    </div>
  );
}
