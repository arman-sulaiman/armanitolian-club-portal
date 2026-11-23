import React, { useState } from 'react';
import { Shield, History, Search, CheckCircle2, CreditCard, UserPlus, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AdminAuditLog() {
  const { lang, auditLogs } = useApp();
  const [search, setSearch] = useState('');

  const filtered = (auditLogs || []).filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.details.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.actor.toLowerCase().includes(q)
    );
  });

  const getBadge = (action) => {
    if (action.includes('APPROVED') || action.includes('VERIFIED')) {
      return { cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 };
    }
    if (action.includes('REJECTED')) {
      return { cls: 'bg-rose-100 text-rose-800', icon: AlertCircle };
    }
    if (action.includes('PAYMENT')) {
      return { cls: 'bg-blue-100 text-blue-800', icon: CreditCard };
    }
    return { cls: 'bg-amber-100 text-amber-800', icon: UserPlus };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900">
          {lang === 'bn' ? 'অ্যাডমিন অডিট লগ ও নিরাপত্তা' : 'Admin Audit Log & Governance'}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {lang === 'bn'
            ? 'সদস্য অনুমোদন, পেমেন্ট যাচাই এবং প্রশাসনিক কার্যক্রমের সম্পূর্ণ ইতিহাস।'
            : 'Complete immutable activity trail of member approvals, payment verifications, and club administration.'}
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            role: lang === 'bn' ? 'সুপার অ্যাডমিন / সাধারণ সম্পাদক' : 'Super Admin / General Secretary',
            desc: lang === 'bn' ? 'সম্পূর্ণ সিস্টেম, অনুমোদন ও সেটিংস নিয়ন্ত্রণ' : 'Full system, approvals, form builder & settings access',
          },
          {
            role: lang === 'bn' ? 'কোষাধ্যক্ষ / হিসাব বিভাগ' : 'Treasurer / Accounts',
            desc: lang === 'bn' ? 'মাসিক চাঁদা যাচাই, রসিদ ও বকেয়া ব্যবস্থাপনা' : 'Payment verification, monthly dues matrix & receipts',
          },
          {
            role: lang === 'bn' ? 'সদস্যপদ যাচাই কমিটি' : 'Membership Committee',
            desc: lang === 'bn' ? 'এনআইডি ও এসএসসি সনদ যাচাই এবং অনুমোদন' : 'NID & SSC proof inspection and membership approval',
          },
        ].map((r, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2.5 text-navy-900 font-bold text-sm">
              <Shield className="w-4 h-4 text-gold-600 shrink-0" />
              <span>{r.role}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Search + Log List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-navy-900 text-sm">
            <History className="w-4 h-4 text-gold-600" />
            <span>{lang === 'bn' ? 'সাম্প্রতিক কার্যক্রম' : 'Recent Activity Trail'}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600 tabular-nums">
              {filtered.length}
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'bn' ? 'লগ খুঁজুন...' : 'Filter audit logs...'}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-navy-700"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((log) => {
            const badge = getBadge(log.action);
            const Icon = badge.icon;
            return (
              <div key={log.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 p-1.5 rounded-lg ${badge.cls}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{log.details}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono font-semibold text-navy-800">{log.action}</span> ·{' '}
                      {log.actor}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">{log.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
