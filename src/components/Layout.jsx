import React, { useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  ShieldCheck,
  Users,
  CreditCard,
  FileBarChart2,
  Megaphone,
  MessageSquare,
  History,
  Settings,
  Menu,
  X,
  Globe,
  CheckCircle2,
  AlertCircle,
  Award,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Layout({ children }) {
  const {
    lang,
    setLang,
    t,
    activeTab,
    setActiveTab,
    setRoute,
    logoutAdmin,
    adminUser,
    members,
    payments,
    settings,
    toast,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pendingApprovals = members.filter((m) => m.status === 'pending').length;
  const pendingPayments = payments.filter((p) => p.status === 'pending').length;

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'register', label: t('nav.register'), icon: UserPlus },
    {
      id: 'approvals',
      label: t('nav.approvals'),
      icon: ShieldCheck,
      badge: pendingApprovals > 0 ? pendingApprovals : null,
    },
    { id: 'members', label: t('nav.members'), icon: Users },
    {
      id: 'payments',
      label: t('nav.payments'),
      icon: CreditCard,
      badge: pendingPayments > 0 ? pendingPayments : null,
    },
    { id: 'reports', label: lang === 'bn' ? 'রিপোর্ট ও পিডিএফ' : 'Reports & PDF', icon: FileBarChart2 },
    { id: 'notices', label: lang === 'bn' ? 'নোটিশ ও প্রেস' : 'Notices & Press', icon: Megaphone },
    { id: 'sms', label: lang === 'bn' ? 'এসএমএস সেন্টার' : 'SMS Center', icon: MessageSquare },
    { id: 'audit', label: lang === 'bn' ? 'অডিট লগ' : 'Audit Log', icon: History },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const clubName = lang === 'bn' ? settings.clubNameBn : settings.clubNameEn;

  return (
    <div className="min-h-screen flex bg-[#F3F5F7] text-[#1A202C]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Clean White Institutional Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-68 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 h-16 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-[#004B76] text-white flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-slate-900 truncate">{clubName}</h1>
              <p className="text-[11px] text-slate-500 truncate">
                {lang === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Administration'}
              </p>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded text-slate-500 hover:bg-slate-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EBF4FA] text-[#004B76] font-semibold border-l-[3px] border-[#004B76]'
                    : 'text-slate-700 hover:bg-[#F3F5F7] border-l-[3px] border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#004B76]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#004B76] text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-[#F9FAFB] space-y-3">
          <div className="text-xs">
            <p className="font-bold text-slate-800">{adminUser?.username || 'admin'}</p>
            <p className="text-slate-500">{adminUser?.role || 'Administrator'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRoute('home')}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-xs font-semibold"
            >
              <ExternalLink className="w-3 h-3" />
              {lang === 'bn' ? 'পাবলিক' : 'Portal'}
            </button>
            <button
              onClick={logoutAdmin}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
            >
              <LogOut className="w-3 h-3" />
              {lang === 'bn' ? 'লগআউট' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded text-slate-600 hover:bg-slate-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-[#004B76]">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#004B76]"
            >
              <span className="underline underline-offset-4">
                {lang === 'en' ? 'বাংলা' : 'English'}
              </span>
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded shadow-lg text-sm font-semibold text-white ${
              toast.type === 'error'
                ? 'bg-rose-700'
                : toast.type === 'info'
                ? 'bg-[#004B76]'
                : 'bg-emerald-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
