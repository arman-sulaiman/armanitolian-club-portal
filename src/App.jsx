import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import PublicPortal from './components/PublicPortal';
import AdminLogin from './components/AdminLogin';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RegistrationForm from './components/RegistrationForm';
import MemberApprovals from './components/MemberApprovals';
import MemberDirectory from './components/MemberDirectory';
import MonthlyPayments from './components/MonthlyPayments';
import ReportGenerator from './components/ReportGenerator';
import NoticeManager from './components/NoticeManager';
import SmsCenter from './components/SmsCenter';
import AdminAuditLog from './components/AdminAuditLog';
import SettingsPanel from './components/SettingsPanel';

function AppContent() {
  const { route, adminUser, authChecked, activeTab } = useApp();

  if (route !== 'admin') {
    return <PublicPortal />;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm font-bold text-navy-900">
        Loading...
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'register':
        return <RegistrationForm />;
      case 'approvals':
        return <MemberApprovals />;
      case 'members':
        return <MemberDirectory />;
      case 'payments':
        return <MonthlyPayments />;
      case 'reports':
        return <ReportGenerator />;
      case 'notices':
        return <NoticeManager />;
      case 'sms':
        return <SmsCenter />;
      case 'audit':
        return <AdminAuditLog />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
