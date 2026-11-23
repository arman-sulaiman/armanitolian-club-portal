import React from 'react';
import {
  Users,
  Clock,
  Wallet,
  CreditCard,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const { lang, t, members, payments, plans, setActiveTab } = useApp();

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingMembers = members.filter((m) => m.status === 'pending');

  const verifiedPayments = payments.filter((p) => p.status === 'verified');
  const totalCollected = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const currentMonth = '2027-01';
  const thisMonthCollected = verifiedPayments
    .filter((p) => p.month === currentMonth)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Monthly revenue chart data (Jan - Jun 2027)
  const months = [
    { key: '2027-01', labelEn: 'Jan 27', labelBn: 'জানু ২৭' },
    { key: '2027-02', labelEn: 'Feb 27', labelBn: 'ফেব্রু ২৭' },
    { key: '2027-03', labelEn: 'Mar 27', labelBn: 'মার্চ ২৭' },
    { key: '2027-04', labelEn: 'Apr 27', labelBn: 'এপ্রিল ২৭' },
    { key: '2027-05', labelEn: 'May 27', labelBn: 'মে ২৭' },
    { key: '2027-06', labelEn: 'Jun 27', labelBn: 'জুন ২৭' },
  ];

  const monthlyTotals = months.map((m) => {
    const base = verifiedPayments
      .filter((p) => p.month === m.key)
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
    return { ...m, value: base };
  });
  const maxRevenue = Math.max(...monthlyTotals.map((m) => m.value), 1000);

  // Batch distribution
  const batchCounts = approvedMembers.reduce((acc, m) => {
    const key = m.batch || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sortedBatches = Object.entries(batchCounts).sort((a, b) => Number(a[0]) - Number(b[0]));

  const kpis = [
    {
      label: t('dashboard.totalMembers'),
      value: approvedMembers.length,
      sub: `${members.length} ${lang === 'bn' ? 'মোট আবেদন' : 'total records'}`,
      icon: Users,
      accent: 'from-navy-900 to-navy-700',
      onClick: () => setActiveTab('members'),
    },
    {
      label: t('dashboard.pendingApprovals'),
      value: pendingMembers.length,
      sub: lang === 'bn' ? 'যাচাইয়ের অপেক্ষায়' : 'Awaiting committee review',
      icon: Clock,
      accent: 'from-amber-500 to-amber-600',
      onClick: () => setActiveTab('approvals'),
    },
    {
      label: t('dashboard.monthlyCollection'),
      value: `৳${thisMonthCollected.toLocaleString()}`,
      sub: `${lang === 'bn' ? 'সর্বমোট' : 'All-time'}: ৳${totalCollected.toLocaleString()}`,
      icon: Wallet,
      accent: 'from-emerald-600 to-teal-600',
      onClick: () => setActiveTab('payments'),
    },
    {
      label: t('dashboard.activeSubscriptions'),
      value: approvedMembers.length,
      sub: `${plans.length} ${lang === 'bn' ? 'টি প্ল্যান সক্রিয়' : 'configured tiers'}`,
      icon: CreditCard,
      accent: 'from-indigo-600 to-blue-700',
      onClick: () => setActiveTab('settings'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-sky-200" />
              {t('brand.est')}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('dashboard.title')}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-1.5 leading-relaxed">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('register')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-[#004B76] font-bold text-sm transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-[#004B76]" />
              {t('dashboard.quickRegister')}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-sm border border-white/40 transition-colors"
            >
              <CreditCard className="w-4 h-4 text-white" />
              {t('dashboard.recordPayment')}
            </button>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <button
              key={idx}
              onClick={kpi.onClick}
              className="text-left bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-2 tabular-nums">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${kpi.accent} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center justify-between">
                <span>{kpi.sub}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </button>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-900">{t('dashboard.monthlyRevenueChart')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">2027 · {t('common.bdt')}</p>
            </div>
          </div>
          <div className="h-52 flex items-end justify-between gap-3 pt-4">
            {monthlyTotals.map((m) => {
              const heightPct = Math.max(8, Math.round((m.value / maxRevenue) * 100));
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                    ৳{m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}k` : m.value}
                  </span>
                  <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl h-36 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full rounded-t-xl bg-gradient-to-t from-navy-900 via-navy-700 to-gold-500 transition-all duration-500"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {lang === 'bn' ? m.labelBn : m.labelEn}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Batch Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-navy-900 mb-4">{t('dashboard.batchDistribution')}</h3>
          <div className="space-y-3.5">
            {sortedBatches.map(([batch, count]) => {
              const pct = Math.round((count / Math.max(approvedMembers.length, 1)) * 100);
              return (
                <div key={batch}>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700">SSC {batch}</span>
                    <span className="text-navy-900 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-navy-800 to-gold-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-navy-900">{t('dashboard.recentApplications')}</h3>
            <button
              onClick={() => setActiveTab('approvals')}
              className="text-xs font-semibold text-navy-700 hover:text-gold-600"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {members.slice(0, 4).map((m) => (
              <div key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={m.photo}
                    alt={m.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-white shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.fullName}</p>
                    <p className="text-xs text-slate-500">
                      SSC {m.batch} · {m.bloodGroup} · {m.submittedAt}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                    m.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : m.status === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {t(`common.${m.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-navy-900">{t('dashboard.recentPayments')}</h3>
            <button
              onClick={() => setActiveTab('payments')}
              className="text-xs font-semibold text-navy-700 hover:text-gold-600"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {payments.slice(0, 4).map((p) => (
              <div key={p.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.memberName}</p>
                  <p className="text-xs text-slate-500">
                    {p.month} · {p.method} · <span className="font-mono">{p.transactionId}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-navy-900 tabular-nums">
                    ৳{Number(p.amount).toLocaleString()}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      p.status === 'verified' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t(`common.${p.status}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
