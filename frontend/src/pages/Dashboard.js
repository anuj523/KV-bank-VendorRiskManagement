import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, AlertTriangle, FileCheck, TrendingUp,
  ArrowUpRight, Clock, CheckCircle, XCircle, Shield
} from 'lucide-react';
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const HEALTH_COLORS = { green: '#4ade80', amber: '#fbbf24', red: '#f87171' };
const RISK_COLORS = { low: '#4ade80', medium: '#fbbf24', high: '#f87171' };

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const card = (
    <div className="glass-card p-6 cursor-pointer group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="stat-number" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-white mt-1">{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

export default function Dashboard() {
  const { user, isVendor } = useAuth();
  const [stats, setStats] = useState(null);
  const [findingStats, setFindingStats] = useState(null);
  const [docStats, setDocStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/vendors/stats/overview'),
      api.get('/findings/stats/summary'),
      api.get('/documents/expiry/summary')
    ]).then(([v, f, d]) => {
      setStats(v);
      setFindingStats(f);
      setDocStats(d);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalVendors = stats?.total || 0;
  const activeVendors = stats?.by_status?.find(s => s.status === 'active')?.count || 0;
  const openFindings = findingStats?.by_severity?.reduce((s, r) => s + parseInt(r.count), 0) || 0;
  const highFindings = findingStats?.by_severity?.find(r => r.severity === 'high')?.count || 0;
  const expiringDocs = docStats?.expiring_soon?.length || 0;
  const expiredDocs = docStats?.expired?.length || 0;

  const healthData = [
    { name: 'Healthy', value: parseInt(stats?.by_health?.find(h => h.health_status === 'green')?.count || 0), color: '#4ade80' },
    { name: 'Attention', value: parseInt(stats?.by_health?.find(h => h.health_status === 'amber')?.count || 0), color: '#fbbf24' },
    { name: 'Critical', value: parseInt(stats?.by_health?.find(h => h.health_status === 'red')?.count || 0), color: '#f87171' },
  ].filter(d => d.value > 0);

  const criticality = [
    { name: 'High', value: parseInt(stats?.by_criticality?.find(c => c.criticality === 'high')?.count || 0), color: '#f87171' },
    { name: 'Medium', value: parseInt(stats?.by_criticality?.find(c => c.criticality === 'medium')?.count || 0), color: '#fbbf24' },
    { name: 'Low', value: parseInt(stats?.by_criticality?.find(c => c.criticality === 'low')?.count || 0), color: '#4ade80' },
  ].filter(d => d.value > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!isVendor && (
          <div className="flex gap-3">
            <Link to="/vendors/new" className="btn-primary flex items-center gap-2">
              <Building2 size={15} />
              Add Vendor
            </Link>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Vendors" value={totalVendors} sub={`${activeVendors} active`} color="#4a9fd4" to="/vendors" />
        <StatCard icon={AlertTriangle} label="Open Findings" value={openFindings} sub={`${highFindings} high severity`} color={highFindings > 0 ? '#f87171' : '#4ade80'} to="/findings" />
        <StatCard icon={FileCheck} label="Expiring Docs" value={expiringDocs} sub={`${expiredDocs} already expired`} color={expiringDocs > 0 ? '#fbbf24' : '#4ade80'} to="/documents" />
        <StatCard icon={Shield} label="Pending Review" value={docStats?.pending_review || 0} sub="Documents awaiting approval" color="#a78bfa" to="/documents" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vendor Health */}
        <div className="glass-card-flat p-6">
          <h3 className="font-display font-semibold text-white mb-4">Vendor Health</h3>
          {healthData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'rgba(15,28,53,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {healthData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No active vendors yet</div>
          )}
        </div>

        {/* Criticality breakdown */}
        <div className="glass-card-flat p-6">
          <h3 className="font-display font-semibold text-white mb-4">By Criticality</h3>
          {criticality.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={criticality} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {criticality.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(15,28,53,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {criticality.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No vendors classified</div>
          )}
        </div>

        {/* Recent findings */}
        <div className="glass-card-flat p-6">
          <h3 className="font-display font-semibold text-white mb-4">Recent Findings</h3>
          <div className="space-y-3">
            {findingStats?.recent?.length ? findingStats.recent.map(f => (
              <Link key={f.id} to={`/findings`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <span className={`badge mt-0.5 ${f.severity === 'high' ? 'badge-red' : f.severity === 'medium' ? 'badge-amber' : 'badge-blue'}`}>
                  {f.severity}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{f.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.vendor_name}</div>
                </div>
              </Link>
            )) : (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No findings yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Lifecycle pipeline */}
      <div className="glass-card-flat p-6">
        <h3 className="font-display font-semibold text-white mb-5">Vendor Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { key: 'intake_received', label: 'Intake', color: '#60a5fa' },
            { key: 'under_due_diligence', label: 'Due Diligence', color: '#a78bfa' },
            { key: 'under_assessment', label: 'Assessment', color: '#f59e0b' },
            { key: 'pending_approval', label: 'Approval', color: '#fb923c' },
            { key: 'active', label: 'Active', color: '#4ade80' },
            { key: 'suspended', label: 'Suspended', color: '#f87171' },
          ].map(({ key, label, color }) => {
            const count = parseInt(stats?.by_status?.find(s => s.status === key)?.count || 0);
            return (
              <Link key={key} to={`/vendors?status=${key}`} className="glass-card p-4 text-center group">
                <div className="text-2xl font-bold font-display" style={{ color }}>{count}</div>
                <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Expiring documents alert */}
      {(expiringDocs > 0 || expiredDocs > 0) && (
        <div className="glass-card-flat p-6 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-amber-400" />
            <h3 className="font-display font-semibold text-white">Document Alerts</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {[...(docStats?.expired || []).slice(0, 3), ...(docStats?.expiring_soon || []).slice(0, 3)].map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div>
                  <div className="text-sm font-medium text-white">{d.vendor_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.document_type}</div>
                </div>
                <span className={`badge ${new Date(d.valid_until) < new Date() ? 'badge-red' : 'badge-amber'}`}>
                  {new Date(d.valid_until) < new Date() ? 'Expired' : `Expiring ${new Date(d.valid_until).toLocaleDateString('en-IN')}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
