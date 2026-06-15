import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import api from '../utils/api';

const ANSWER_OPTIONS = [
  { value: 'compliant', label: 'Compliant', icon: CheckCircle, color: '#4ade80', points: 1 },
  { value: 'partially_compliant', label: 'Partial', icon: AlertTriangle, color: '#fbbf24', points: 0.5 },
  { value: 'non_compliant', label: 'Non-Compliant', icon: MinusCircle, color: '#f87171', points: 0 },
  { value: 'na', label: 'N/A', icon: null, color: 'var(--text-muted)', points: null },
];

const DOMAIN_LABELS = {
  cybersecurity: 'Cybersecurity', operational: 'Operational',
  compliance_legal: 'Compliance & Legal', financial: 'Financial', reputational: 'Reputational'
};

export default function RiskQuestionnaire() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState({});
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    if (!vendorId) return;
    api.get(`/risk/${vendorId}/questionnaire`)
      .then(data => {
        setVendor(data.vendor);
        setQuestions(data.questions);
        const ans = {};
        const n = {};
        data.responses.forEach(r => {
          ans[r.question_key] = r.answer;
          if (r.notes) n[r.question_key] = r.notes;
        });
        setAnswers(ans);
        setNotes(n);
        setActiveGroup(data.questions[0]?.domain);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vendorId]);

  const setAnswer = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));
  const setNote = (key, val) => setNotes(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const responses = questions.map(q => ({
        question_key: q.key,
        domain: q.domain,
        question_text: q.text,
        answer: answers[q.key] || null,
        notes: notes[q.key] || null,
        is_regulatory_tagged: q.is_regulatory_tagged,
        regulatory_ref: q.regulatory_ref
      })).filter(r => r.answer);

      const result = await api.post(`/risk/${vendorId}/questionnaire`, { responses });
      alert(`Saved! Overall score: ${result.score?.overall?.toFixed(1)}%`);
      navigate(`/vendors/${vendorId}`);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const byDomain = questions.reduce((acc, q) => {
    if (!acc[q.domain]) acc[q.domain] = [];
    acc[q.domain].push(q);
    return acc;
  }, {});

  const progress = questions.length ? Math.round((Object.keys(answers).length / questions.length) * 100) : 0;

  if (loading) return <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
  </div>;

  return (
    <div className="max-w-4xl space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/vendors/${vendorId}`)} className="btn-glass p-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-white">Risk Questionnaire</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {vendor?.name} · {vendor?.category?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{progress}% complete</div>
          <div className="w-32 h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #4a9fd4, #0ea5a0)' }} />
          </div>
        </div>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {Object.keys(byDomain).map(domain => {
          const qs = byDomain[domain];
          const answered = qs.filter(q => answers[q.key]).length;
          return (
            <button key={domain}
              onClick={() => setActiveGroup(domain)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeGroup === domain ? 'bg-white/10 text-white border border-white/15' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {DOMAIN_LABELS[domain] || domain}
              <span className={`badge text-xs ${answered === qs.length ? 'badge-green' : answered > 0 ? 'badge-amber' : 'badge-gray'}`}>
                {answered}/{qs.length}
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
                    <span className="inline-flex items-center gap-1 mt-1 badge badge-amber text-xs">
                      ⚠ {q.regulatory_ref}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-6 flex-wrap">
                {ANSWER_OPTIONS.map(({ value, label, icon: Icon, color, points }) => {
                  const selected = answers[q.key] === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setAnswer(q.key, value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? `border-opacity-100`
                          : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                      }`}
                      style={selected ? {
                        background: `${color}18`,
                        border: `1px solid ${color}40`,
                        color
                      } : {}}
                    >
                      {Icon && <Icon size={12} />}
                      {label}
                      {points !== null && <span className="opacity-60">({points})</span>}
                    </button>
                  );
                })}
              </div>
              {answers[q.key] && answers[q.key] !== 'compliant' && answers[q.key] !== 'na' && (
                <textarea
                  className="glass-input text-xs h-14 resize-none mt-3 ml-6"
                  placeholder="Add notes or evidence reference..."
                  value={notes[q.key] || ''}
                  onChange={e => setNote(q.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 sticky bottom-6">
        <button onClick={handleSave} disabled={saving || progress === 0} className="btn-primary flex items-center gap-2">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
          Save & Score
        </button>
        <button onClick={() => navigate(`/vendors/${vendorId}`)} className="btn-glass">Cancel</button>
      </div>
    </div>
  );
}
