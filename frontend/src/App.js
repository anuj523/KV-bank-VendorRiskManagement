import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import VendorDetail from './pages/VendorDetail';
import AddVendor from './pages/AddVendor';
import Findings from './pages/Findings';
import Documents from './pages/Documents';
import RiskQuestionnaire from './pages/RiskQuestionnaire';
import AIInsights from './pages/AIInsights';
import Escalation from './pages/Escalation';
import Renewals from './pages/Renewals';
import Workflows from './pages/Workflows';
import { SupplyChainPage, CompliancePage, SettingsPage } from './pages/Placeholders';

function ProtectedRoute({ children, vendorOk }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.type === 'vendor' && !vendorOk) return <Navigate to="/portal/dashboard" replace />;
  if (user.type === 'internal' && vendorOk) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const P = ({ children, vendorOk }) => (
    <ProtectedRoute vendorOk={vendorOk}><AppLayout>{children}</AppLayout></ProtectedRoute>
  );
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to={user?.type === 'vendor' ? '/portal/dashboard' : '/dashboard'} replace />} />
      <Route path="/dashboard" element={<P><Dashboard /></P>} />
      <Route path="/vendors" element={<P><Vendors /></P>} />
      <Route path="/vendors/new" element={<P><AddVendor /></P>} />
      <Route path="/vendors/:id" element={<P><VendorDetail /></P>} />
      <Route path="/findings" element={<P><Findings /></P>} />
      <Route path="/documents" element={<P><Documents /></P>} />
      <Route path="/risk/:vendorId" element={<P><RiskQuestionnaire /></P>} />
      <Route path="/ai-insights" element={<P><AIInsights /></P>} />
      <Route path="/escalation" element={<P><Escalation /></P>} />
      <Route path="/renewals" element={<P><Renewals /></P>} />
      <Route path="/workflows" element={<P><Workflows /></P>} />
      <Route path="/supply-chain" element={<P><SupplyChainPage /></P>} />
      <Route path="/compliance" element={<P><CompliancePage /></P>} />
      <Route path="/settings" element={<P><SettingsPage /></P>} />
      <Route path="/portal/dashboard" element={<P vendorOk><Dashboard /></P>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
