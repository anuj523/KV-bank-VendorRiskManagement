import React, { useState } from 'react';
import { Bot, Zap, AlertTriangle, Shield, Package } from 'lucide-react';
import api from '../utils/api';

export default function AIInsights() {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);

  const runConcentration = async () => {
    setLoading('concentration');
    setResult(null);
    try {
      const data = await api.post('/ai/concentration-alert', {});
      setResult({ type: 'Portfolio Concentration Analysis', text: data.text });
    } catch (err) {
      setResult({ type: 'Error', text: err.message, error: true });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">AI Insights</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>AI-assisted portfolio analysis — all outputs require human review</p>
      </div>

      <div className="glass-card-flat p-5 flex items-center gap-3" style={{ border: '1px solid rgba(74,159,212,0.2)', background: 'rgba(74,159,212,0.05)' }}>
        <Shield size={18} className="text-sky-400 flex-shrink-0" />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong className="text-white">Human-in-the-loop enforced.</strong> All AI outputs are advisory only. No changes are applied until an ABC officer reviews and accepts the analysis.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package size={18} className="text-sky-400" />
            <h3 className="font-display font-semibold text-white">Portfolio Concentration Alert</h3>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Scan all active vendors and sub-contractors to detect shared infrastructure, cloud provider concentrations, and geographic risks across the portfolio.
          </p>
          <button
            onClick={runConcentration}
            disabled={loading !== null}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'concentration' ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : <Zap size={15} />}
            Run Analysis
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <h3 className="font-display font-semibold text-white">Vendor-Level AI Analysis</h3>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Per-vendor AI tools — risk summary, gap identification, mitigation recommendations, and audit frequency recommendations — are available inside each vendor's profile under the AI Insights tab.
          </p>
          <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
            Navigate to Vendors → Select Vendor → AI Insights tab
          </div>
        </div>
      </div>

      {result && (
        <div className="glass-card-flat p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} className="text-sky-400" />
            <h3 className="font-display font-semibold text-white">{result.type}</h3>
          </div>
          <pre className="text-sm whitespace-pre-wrap leading-relaxed"
            style={{ color: result.error ? '#f87171' : 'var(--text-secondary)', fontFamily: 'inherit' }}>
            {result.text}
          </pre>
        </div>
      )}
    </div>
  );
}
