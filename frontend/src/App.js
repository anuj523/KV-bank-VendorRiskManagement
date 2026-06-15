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
import { SupplyChainPage, CompliancePage, RenewalsPage, SettingsPage } from './pages/Placeholders';

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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to={user?.type === 'vendor' ? '/portal/dashboard' : '/dashboard'} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><AppLayout><Vendors /></AppLayout></ProtectedRoute>} />
      <Route path="/vendors/new" element={<ProtectedRoute><AppLayout><AddVendor /></AppLayout></ProtectedRoute>} />
      <Route path="/vendors/:id" element={<ProtectedRoute><AppLayout><VendorDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/findings" element={<ProtectedRoute><AppLayout><Findings /></AppLayout></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><AppLayout><Documents /></AppLayout></ProtectedRoute>} />
      <Route path="/risk/:vendorId" element={<ProtectedRoute><AppLayout><RiskQuestionnaire /></AppLayout></ProtectedRoute>} />
      <Route path="/ai-insights" element={<ProtectedRoute><AppLayout><AIInsights /></AppLayout></ProtectedRoute>} />
      <Route path="/supply-chain" element={<ProtectedRoute><AppLayout><SupplyChainPage /></AppLayout></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><AppLayout><CompliancePage /></AppLayout></ProtectedRoute>} />
      <Route path="/renewals" element={<ProtectedRoute><AppLayout><RenewalsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/portal/dashboard" element={<ProtectedRoute vendorOk><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
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
