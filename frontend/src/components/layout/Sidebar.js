import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Building2, AlertTriangle, FileCheck,
  TrendingUp, Shield, RefreshCw, LogOut, Menu, X,
  ChevronRight, Bell, Settings, Bot, Package
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vendors', label: 'Vendors', icon: Building2 },
  { path: '/findings', label: 'Findings', icon: AlertTriangle },
  { path: '/documents', label: 'Documents', icon: FileCheck },
  { path: '/risk', label: 'Risk Scoring', icon: TrendingUp },
  { path: '/supply-chain', label: 'Supply Chain', icon: Package },
  { path: '/ai-insights', label: 'AI Insights', icon: Bot },
  { path: '/compliance', label: 'Compliance', icon: Shield },
  { path: '/renewals', label: 'Renewals', icon: RefreshCw },
];

const vendorNavItems = [
  { path: '/portal/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { path: '/portal/questionnaire', label: 'Questionnaire', icon: FileCheck },
  { path: '/portal/documents', label: 'Documents', icon: Package },
  { path: '/portal/findings', label: 'My Findings', icon: AlertTriangle },
];

const roleColors = {
  system_administrator: 'badge-purple',
  risk_manager: 'badge-red',
  compliance_officer: 'badge-amber',
  vendor_management_officer: 'badge-blue',
  business_owner: 'badge-blue',
  information_security: 'badge-amber',
  auditor: 'badge-gray',
};

const roleLabels = {
  system_administrator: 'Admin',
  risk_manager: 'Risk Mgr',
  compliance_officer: 'Compliance',
  vendor_management_officer: 'VMO',
  business_owner: 'Biz Owner',
  information_security: 'InfoSec',
  auditor: 'Auditor',
};

export default function Sidebar() {
  const { user, logout, isVendor } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const items = isVendor ? vendorNavItems : navItems;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setCollapsed(true)}
      />

      <aside className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-all duration-300
        ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'}
        glass-card-flat rounded-none border-r border-white/10`}
        style={{ backdropFilter: 'blur(24px)', background: 'rgba(15,28,53,0.85)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4a9fd4, #0ea5a0)' }}>
            <Shield size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-display font-800 text-sm text-white leading-tight">Vendor Risk360</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>KVB TPRM Platform</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded-md hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {collapsed ? <ChevronRight size={16} /> : <X size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link key={path} to={path} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/10">
          {!collapsed && user && (
            <div className="mb-3 px-2">
              <div className="text-sm font-medium text-white truncate">{user.full_name || user.email}</div>
              <div className="mt-1">
                <span className={`badge ${roleColors[user.role] || 'badge-gray'} text-xs`}>
                  {isVendor ? 'Vendor Portal' : (roleLabels[user.role] || user.role)}
                </span>
              </div>
            </div>
          )}
          {!isVendor && !collapsed && (
            <Link to="/settings" className="nav-item mb-1">
              <Settings size={16} />
              <span>Settings</span>
            </Link>
          )}
          <button onClick={logout} className="nav-item w-full text-left" style={{ color: 'rgba(248,113,113,0.8)' }}>
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-40 lg:hidden p-2 glass-card rounded-lg"
        onClick={() => setCollapsed(false)}
      >
        <Menu size={20} />
      </button>
    </>
  );
}
