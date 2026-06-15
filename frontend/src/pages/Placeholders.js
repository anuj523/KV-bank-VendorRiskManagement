import React from 'react';
import { Package, Shield, RefreshCw } from 'lucide-react';

function PlaceholderPage({ title, icon: Icon, color, description }) {
  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
      <div className="glass-card-flat p-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <Icon size={28} style={{ color }} />
        </div>
        <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          This module is ready and will be populated as vendors are onboarded and assessed.
        </p>
      </div>
    </div>
  );
}

export function SupplyChainPage() {
  return <PlaceholderPage
    title="Supply Chain & Fourth-Party Risk"
    icon={Package}
    color="#a78bfa"
    description="Fourth-party sub-contractor registry, concentration detection, geographic risk flags"
  />;
}

export function CompliancePage() {
  return <PlaceholderPage
    title="Compliance & Regulatory"
    icon={Shield}
    color="#4a9fd4"
    description="RBI circular compliance traceability, regulatory findings, audit-ready reports"
  />;
}

export function RenewalsPage() {
  return <PlaceholderPage
    title="Renewal Management"
    icon={RefreshCw}
    color="#fbbf24"
    description="Contract renewal tracking, 90/60/30-day alerts, renewal hold management"
  />;
}

export function SettingsPage() {
  return <PlaceholderPage
    title="System Settings"
    icon={Shield}
    color="#60b8e8"
    description="Configure workflows, user roles, SLAs, and platform settings"
  />;
}
