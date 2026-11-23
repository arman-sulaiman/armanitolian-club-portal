import React, { useMemo, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Printer,
  X,
  Search,
  Wallet,
  Clock,
  CalendarClock,
  Award,
  BookOpen,
  CreditCard,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  generateMemberSchedule,
  formatMonthLabel,
  getBatchRule,
  DEFAULT_BATCH_RULES,
} from '../utils/subscriptionEngine';

export default function MonthlyPayments() {
  const { lang, t, members, payments, plans, settings, addPayment, verifyPayment, showToast } = useApp();
  const [subTab, setSubTab] = useState('tracker');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [searchedMemberId, setSearchedMemberId] = useState('');

  const matchingMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return approvedMembers.filter(
      (m) =>
        (m.memberId || '').toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        (m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '___') ||
        String(m.batch).includes(q)
    );
  }, [approvedMembers, memberSearchQuery]);

  const activeMember =
    approvedMembers.find((m) => m.memberId === searchedMemberId) || null;
  const activePlan = plans.find((p) => p.id === activeMember?.planId);

  const schedule = useMemo(() => {
    if (!activeMember || !activePlan) return null;
    return generateMemberSchedule(activeMember, activePlan, settings);
  }, [activeMember, activePlan, settings]);

  const [form, setForm] = useState({
    memberId: '',
    memberName: '',
    month: settings.installmentStartMonth || '2027-01',
    installmentLabel: 'First-Month Payment',
    paymentType: 'first_month',
    amount: 0,
    method: 'bKash',
    transactionId: '',
    notes: '',
  });
  const [modalSearch, setModalSearch] = useState('');

  const getNextUnpaidForMember = (member) => {
    const plan = plans.find((p) => p.id === member?.planId);
    if (!member || !plan) return null;
    const sched = generateMemberSchedule(member, plan, settings);
    const paidMonths = new Set(
      payments.filter((p) => p.memberId === member.memberId).map((p) => p.month)
    );
    return sched.items.find((item) => !paidMonths.has(item.month)) || null;
  };

  const selectModalMember = (member) => {
    const nextItem = getNextUnpaidForMember(member);
    setModalSearch(`${member.memberId} - ${member.fullName}`);
    if (!nextItem) {
      setForm((prev) => ({
        ...prev,
        memberId: member.memberId,
        memberName: member.fullName,
        month: '',
        installmentLabel: 'All Installments Paid',
        amount: 0,
        notes: '',
      }));
      return;
    }
    setForm({
      memberId: member.memberId,
      memberName: member.fullName,
      month: nextItem.month,
      installmentLabel: nextItem.labelEn,
      paymentType: nextItem.type,
      amount: nextItem.amount,
      method: 'bKash',
      transactionId: '',
      notes: `${nextItem.labelEn} (${formatMonthLabel(nextItem.month, 'en')})`,
    });
  };

  const modalMatches = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return [];
    return approvedMembers.filter(
      (m) =>
        (m.memberId || '').toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        (m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '___')
    );
  }, [approvedMembers, modalSearch]);

  const openPayModalForItem = (member, item) => {
    setModalSearch(`${member.memberId} - ${member.fullName}`);
    setForm({
      memberId: member.memberId,
      memberName: member.fullName,
      month: item.month,
      installmentLabel: item.labelEn,
      paymentType: item.type,
      amount: item.amount,
      method: 'bKash',
      transactionId: '',
      notes: `${item.labelEn} (${formatMonthLabel(item.month, 'en')})`,
    });
    setShowRecordModal(true);
  };

  const handleRecordSubmit = (e) => {
    e.preventDefault();
    const member = approvedMembers.find((m) => m.memberId === form.memberId);
    if (!member) return;
    addPayment({
      memberId: member.memberId,
      memberName: member.fullName,
      batch: member.batch,
      month: form.month,
      paymentType: form.paymentType,
      installmentLabel: form.installmentLabel,
      amount: Number(form.amount),
      method: form.method,
      transactionId: form.transactionId || `TRX-${Date.now().toString().slice(-6)}`,
      notes: form.notes || `${form.installmentLabel} (${form.month})`,
    });
    showToast(t('payments.paidSuccess'), 'success');
    setShowRecordModal(false);
  };

  const totalCollected = payments
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const memberPayments = activeMember
    ? payments.filter((p) => p.memberId === activeMember.memberId)
    : [];
  const firstUnpaidMonth = useMemo(() => {
    if (!schedule?.items) return null;
    const paidMonths = new Set(memberPayments.map((p) => p.month));
    const next = schedule.items.find((item) => !paidMonths.has(item.month));
    return next ? next.month : null;
  }, [schedule, memberPayments]);
  const memberPaidTotal = memberPayments
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const memberTotalDue = schedule?.totalPayable || 0;
  const memberRemaining = Math.max(0, memberTotalDue - memberPaidTotal);
  const progressPct =
    memberTotalDue > 0 ? Math.min(100, Math.round((memberPaidTotal / memberTotalDue) * 100)) : 100;

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.memberName.toLowerCase().includes(q) ||
        p.memberId.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.installmentLabel || '').toLowerCase().includes(q) ||
        (p.transactionId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const batchRules = settings.batchRules || DEFAULT_BATCH_RULES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900">
            {lang === 'bn' ? 'সাবস্ক্রিপশন ও সহজ কিস্তি পেমেন্ট' : 'Subscription & Easy Installment Payments'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'bn'
              ? 'জানুয়ারি ২০২৭ থেকে প্রথম মাসের পেমেন্ট এবং ফেব্রুয়ারি ২০২৭ থেকে মাসিক কিস্তি হিসাব শুরু।'
              : 'Starts January 2027 (First-Month Payment) · Monthly Installments counted from February 2027.'}
          </p>
        </div>
        <button
          onClick={() => {
            if (activeMember && schedule?.items?.[0]) {
              const nextUnpaid =
                schedule.items.find(
                  (item) => !memberPayments.some((p) => p.month === item.month)
                ) || schedule.items[0];
              openPayModalForItem(activeMember, nextUnpaid);
            } else {
              setShowRecordModal(true);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4 text-gold-400" />
          {t('payments.recordNew')}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">{t('payments.totalCollected')}</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">
              ৳{totalCollected.toLocaleString()}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">{t('payments.pendingVerification')}</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">{pendingCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {lang === 'bn' ? 'পেমেন্ট শুরুর মাস' : 'Schedule Start'}
            </p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">
              {formatMonthLabel(settings.installmentStartMonth || '2027-01', lang)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-navy-900/10 text-navy-900 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-200/70 p-1 gap-1">
          <button
            onClick={() => setSubTab('tracker')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'tracker' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            {lang === 'bn' ? 'সহজ কিস্তি ট্র্যাকার' : 'Easy Installment Tracker'}
          </button>
          <button
            onClick={() => setSubTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'ledger' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {t('payments.ledgerTab')}
          </button>
          <button
            onClick={() => setSubTab('guide')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'guide' ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {lang === 'bn' ? 'ফি ও কিস্তির নিয়মাবলী' : 'Fee & Installment Guide'}
          </button>
        </div>
      </div>

      {/* TAB 1: EASY VISUAL INSTALLMENT TRACKER (BY SEARCHING) */}
      {subTab === 'tracker' && (
        <div className="space-y-5">
          {/* Member Search Bar (Search instead of selecting) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {lang === 'bn'
                ? 'সদস্যের পেমেন্ট দেখতে ক্লাব আইডি, নাম, মোবাইল নম্বর বা ব্যাচ লিখে খুঁজুন'
                : 'Search Member by Club ID, Name, Phone Number, or SSC Batch to View Payments'}
            </p>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setMemberSearchQuery(val);
                  const q = val.trim().toLowerCase();
                  if (!q) {
                    setSearchedMemberId('');
                    return;
                  }
                  const exact = approvedMembers.find(
                    (m) => (m.memberId || '').toLowerCase() === q
                  );
                  if (exact) setSearchedMemberId(exact.memberId);
                }}
                placeholder="e.g. AC-2004-0012, Mahmudul, 01711542891, or 2012..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-navy-700"
              />
            </div>

            {memberSearchQuery.trim() && matchingMembers.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {matchingMembers.slice(0, 6).map((m) => {
                  const p = plans.find((x) => x.id === m.planId);
                  const isSelected = m.memberId === searchedMemberId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSearchedMemberId(m.memberId)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors ${
                        isSelected ? 'bg-navy-900 text-white' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={m.photo}
                          alt={m.fullName}
                          className="w-8 h-8 rounded-full object-cover bg-white"
                        />
                        <div>
                          <p className="text-xs font-bold">{m.fullName}</p>
                          <p className={`text-[11px] font-mono ${isSelected ? 'text-gold-400' : 'text-slate-500'}`}>
                            {m.memberId} · {m.phone} · SSC {m.batch}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                          isSelected ? 'bg-white text-[#004B76]' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? p?.nameBn : p?.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {memberSearchQuery.trim() && matchingMembers.length === 0 && (
              <p className="text-xs font-semibold text-rose-600">
                {lang === 'bn' ? 'কোনো অনুমোদিত সদস্য পাওয়া যায়নি।' : 'No matching approved member found.'}
              </p>
            )}
          </div>

          {!activeMember && (
            <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-300 text-center text-slate-500">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">
                {lang === 'bn'
                  ? 'কিস্তির তালিকা দেখতে উপরে কোনো সদস্যের আইডি, নাম বা ফোন নম্বর লিখে খুঁজুন।'
                  : 'Search for a member above by Club ID, Name, or Phone to inspect and record their installment payments.'}
              </p>
            </div>
          )}

          {activeMember && schedule && (
            <>

          {/* Member Subscription Progress Banner */}
          <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-white text-[#004B76] text-xs font-bold shadow-xs">
                    {lang === 'bn' ? activePlan?.nameBn : activePlan?.nameEn}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold">
                    {lang === 'bn' ? schedule.batchRule.categoryBn : schedule.batchRule.categoryEn}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                    {schedule.mode === 'installment'
                      ? lang === 'bn'
                        ? `মাসিক কিস্তি (${schedule.batchRule.totalInstallments}টি কিস্তি)`
                        : `Installment Plan (${schedule.batchRule.totalInstallments} Installments)`
                      : schedule.mode === 'free'
                      ? lang === 'bn'
                        ? 'অবৈতনিক (ফ্রি)'
                        : 'Free of Charge'
                      : lang === 'bn'
                      ? 'এককালীন পরিশোধ'
                      : 'Full One-Time Subscription'}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold">{activeMember.fullName}</h2>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  {activeMember.memberId} · SSC {activeMember.batch}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:gap-6 bg-white/10 rounded-2xl p-4 border border-white/10">
                <div>
                  <p className="text-[11px] text-slate-300">{lang === 'bn' ? 'মোট প্রদেয়' : 'Total Plan'}</p>
                  <p className="text-lg font-extrabold tabular-nums">৳{memberTotalDue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-300">{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</p>
                  <p className="text-lg font-extrabold text-emerald-400 tabular-nums">
                    ৳{memberPaidTotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sky-200">{lang === 'bn' ? 'বাকি আছে' : 'Remaining'}</p>
                  <p className="text-lg font-extrabold text-white tabular-nums">
                    ৳{memberRemaining.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300">
                  {lang === 'bn' ? 'সাবস্ক্রিপশন পরিশোধের অগ্রগতি' : 'Subscription Payment Progress'}
                </span>
                <span className="text-gold-400 tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Schedule Cards Grid */}
          {schedule.mode === 'free' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <Sparkles className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-bold text-emerald-900">
                {lang === 'bn' ? 'সম্মানিত সদস্য — কোনো ফি প্রযোজ্য নয়' : 'Honorary Member — Free of Charge'}
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {schedule.items.map((item) => {
                const matchedPay = memberPayments.find((p) => p.month === item.month);
                const isFirstMonth = item.type === 'first_month';
                const isVerified = matchedPay?.status === 'verified';
                const isPending = matchedPay?.status === 'pending';
                const isCurrentDue = !matchedPay && item.month === firstUnpaidMonth;

                return (
                  <div
                    key={`${item.type}-${item.month}`}
                    className={`rounded-md p-4 border transition-all flex flex-col justify-between ${
                      isVerified
                        ? 'bg-white border-emerald-300'
                        : isPending
                        ? 'bg-amber-50/70 border-amber-300'
                        : isCurrentDue
                        ? 'bg-white border-[#004B76] ring-1 ring-[#004B76]/20'
                        : 'bg-[#F8F9FA] border-slate-200 opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isCurrentDue
                              ? 'bg-[#004B76] text-white'
                              : isFirstMonth
                              ? 'bg-[#EBF4FA] text-[#004B76]'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {lang === 'bn' ? item.labelBn : item.labelEn}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {formatMonthLabel(item.month, lang)}
                        </span>
                      </div>

                      <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                        ৳{item.amount.toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                      {isVerified ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.paid')}
                          </span>
                          <button
                            onClick={() => setReceiptPayment(matchedPay)}
                            className="text-xs font-semibold text-[#004B76] underline underline-offset-2 inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" /> {t('payments.receipt')}
                          </button>
                        </>
                      ) : isPending ? (
                        <>
                          <span className="text-xs font-semibold text-amber-700">{t('common.pending')}</span>
                          <button
                            onClick={() => {
                              verifyPayment(matchedPay.id);
                              showToast(t('payments.verifiedSuccess'), 'success');
                            }}
                            className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700"
                          >
                            {t('payments.verifyPayment')}
                          </button>
                        </>
                      ) : isCurrentDue ? (
                        <>
                          <span className="text-xs font-semibold text-[#004B76]">
                            {lang === 'bn' ? 'সর্বশেষ বকেয়া' : 'Current due'}
                          </span>
                          <button
                            onClick={() => openPayModalForItem(activeMember, item)}
                            className="px-3.5 py-1.5 rounded-full bg-[#004B76] text-white text-[11px] font-semibold hover:bg-[#003B5C]"
                          >
                            {lang === 'bn' ? 'পেমেন্ট করুন' : 'Record pay'}
                          </button>
                        </>
                      ) : (
                        <span className="w-full py-1 text-center text-[11px] font-medium text-slate-400 inline-flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3" />
                          {lang === 'bn' ? 'পূর্ববর্তী মাস বাকি' : 'Pay previous due first'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT LEDGER */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-navy-700"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            >
              <option value="all">{t('common.all')}</option>
              <option value="verified">{t('common.verified')}</option>
              <option value="pending">{t('common.pending')}</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">{t('payments.receiptNo')}</th>
                    <th className="px-5 py-3.5">Member</th>
                    <th className="px-5 py-3.5">Type & Month</th>
                    <th className="px-5 py-3.5">{t('payments.method')} & TrxID</th>
                    <th className="px-5 py-3.5">{t('payments.amount')}</th>
                    <th className="px-5 py-3.5">{t('common.status')}</th>
                    <th className="px-5 py-3.5 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-navy-900">
                        {p.id}
                        <span className="block text-[11px] font-sans font-normal text-slate-400">
                          {p.date}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900">{p.memberName}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {p.memberId} · SSC {p.batch}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-navy-900 block">
                          {p.installmentLabel || 'Monthly Payment'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatMonthLabel(p.month, lang)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-slate-800">{p.method}</span>
                        <span className="block text-[11px] font-mono text-slate-500">
                          {p.transactionId}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-navy-900 tabular-nums">
                        ৳{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.status === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t(`common.${p.status}`)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {p.status === 'pending' && (
                          <button
                            onClick={() => {
                              verifyPayment(p.id);
                              showToast(t('payments.verifiedSuccess'), 'success');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('payments.verifyPayment')}
                          </button>
                        )}
                        <button
                          onClick={() => setReceiptPayment(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {t('payments.receipt')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL SUBSCRIPTION & INSTALLMENT GUIDE */}
      {subTab === 'guide' && (
        <div className="space-y-6">
          {/* Table 1: Batch Categories */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-navy-900 text-white font-bold text-sm">
              {lang === 'bn' ? '১. অ্যালামনাই ব্যাচ ক্যাটাগরি' : '1. Alumni Batch Categories'}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Eligible Alumni Batches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-6 py-3 font-bold text-navy-900">Rising Star</td>
                  <td className="px-6 py-3">2015–2024 and 2009–2014</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-bold text-navy-900">Classic</td>
                  <td className="px-6 py-3">1980–2008</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-bold text-navy-900">Legacy</td>
                  <td className="px-6 py-3">1958–1979</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: Membership Types & Subscription Fees */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-navy-900 text-white font-bold text-sm">
              {lang === 'bn' ? '২. সদস্যপদের ধরন ও সাবস্ক্রিপশন ফি' : '2. Membership Types & Subscription Fees'}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Membership Type</th>
                  <th className="px-6 py-3">Subscription Fee</th>
                  <th className="px-6 py-3">Installment System</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 font-bold text-navy-900">
                      {lang === 'bn' ? p.nameBn : p.nameEn}
                    </td>
                    <td className="px-6 py-3 font-bold tabular-nums">
                      {Number(p.fee) === 0 ? 'Free of charge' : `BDT ${Number(p.fee).toLocaleString()}`}
                    </td>
                    <td className="px-6 py-3">
                      {p.allowInstallment ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Available (Starts {formatMonthLabel(settings.installmentStartMonth || '2027-01', lang)})
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not Applicable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 3: Installment Schedule by Alumni Batch */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-navy-900 text-white font-bold text-sm">
              {lang === 'bn'
                ? '৩. অ্যালামনাই ব্যাচ অনুযায়ী কিস্তির সময়সূচি (জানুয়ারি ২০২৭ থেকে শুরু)'
                : '3. Installment Schedule by Alumni Batch (Starts January 2027 · Installments from Feb 2027)'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Batch Category</th>
                    <th className="px-6 py-3">Full Subscription</th>
                    <th className="px-6 py-3">First-Month Payment (Jan 2027)</th>
                    <th className="px-6 py-3">Monthly Installment (Feb 2027+)</th>
                    <th className="px-6 py-3 text-center">Total Installments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchRules.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-3.5 font-bold text-navy-900">
                        {lang === 'bn' ? r.categoryBn : r.categoryEn}
                      </td>
                      <td className="px-6 py-3.5 tabular-nums font-semibold">
                        BDT {Number(r.fullSubscription).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 tabular-nums font-bold text-gold-600">
                        BDT {Number(r.firstMonthPayment).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-medium">
                        {lang === 'bn' ? r.summaryBn : r.summaryEn}
                      </td>
                      <td className="px-6 py-3.5 text-center font-extrabold text-navy-900 tabular-nums">
                        {r.totalInstallments}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC RECORD PAYMENT MODAL (Search by Club ID or Phone -> Auto Amount & Latest Unpaid Month) */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#004B76] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{t('payments.recordNew')}</h3>
                <p className="text-xs text-sky-100">{form.installmentLabel}</p>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {lang === 'bn'
                    ? 'সদস্য খুঁজুন (ক্লাব আইডি বা মোবাইল নম্বর)'
                    : 'Search Member by Club ID or Phone Number'}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalSearch(val);
                      const q = val.trim().toLowerCase();
                      const exact = approvedMembers.find(
                        (m) =>
                          (m.memberId || '').toLowerCase() === q ||
                          (m.phone || '').replace(/\D/g, '').endsWith(q.replace(/\D/g, '') || '___')
                      );
                      if (exact && q.length >= 8) selectModalMember(exact);
                    }}
                    placeholder="e.g. AC-2004-0012 or 01711542891"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded border border-slate-300 text-sm font-mono"
                  />
                </div>
                {modalSearch.trim() && modalMatches.length > 0 && !form.memberName && (
                  <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {modalMatches.slice(0, 5).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectModalMember(m)}
                        className="w-full px-3 py-2 text-left hover:bg-[#EBF4FA] text-xs flex justify-between"
                      >
                        <span className="font-semibold text-slate-900">{m.fullName}</span>
                        <span className="font-mono text-slate-500">
                          {m.memberId} · {m.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {form.memberId && (
                  <div className="p-2.5 rounded bg-[#EBF4FA] text-xs flex items-center justify-between text-[#004B76]">
                    <span className="font-semibold">
                      {form.memberName} ({form.memberId})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalSearch('');
                        setForm((p) => ({ ...p, memberId: '', memberName: '', amount: 0, month: '' }));
                      }}
                      className="underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'সর্বশেষ বকেয়া মাস' : 'Next Unpaid Month'}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={form.month ? `${formatMonthLabel(form.month, lang)} (${form.installmentLabel})` : '—'}
                    className="w-full px-3.5 py-2.5 rounded border border-slate-200 bg-[#F3F5F7] text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('payments.amount')}
                  </label>
                  <input
                    type="number"
                    required
                    readOnly
                    min="1"
                    value={form.amount}
                    className="w-full px-3.5 py-2.5 rounded border border-slate-200 bg-[#F3F5F7] text-sm font-bold text-[#004B76] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('payments.method')}
                  </label>
                  <select
                    value={form.method}
                    onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
                  >
                    {['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Cash'].map((m, i) => (
                      <option key={m} value={m}>
                        {t('options.paymentMethods')[i]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('payments.transactionId')}
                  </label>
                  <input
                    type="text"
                    value={form.transactionId}
                    onChange={(e) => setForm((p) => ({ ...p, transactionId: e.target.value }))}
                    placeholder="e.g. BKH8X2M9Q"
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('payments.notes')}
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-5 py-2 rounded-full border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!form.memberId || !form.month || Number(form.amount) <= 0}
                  className="px-6 py-2 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold disabled:opacity-40"
                >
                  {t('common.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 no-print">
              <h3 className="font-bold text-navy-900">{t('payments.receipt')}</h3>
              <button
                onClick={() => setReceiptPayment(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-navy-900/15 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-400 flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-navy-900 text-base">
                      {lang === 'bn' ? settings.clubNameBn : settings.clubNameEn}
                    </h4>
                    <p className="text-[11px] text-slate-500">{settings.clubAddress}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase">
                  {receiptPayment.status}
                </span>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold tracking-widest uppercase text-gold-600">
                  {t('payments.receiptTitle')}
                </p>
                <p className="font-mono font-bold text-lg text-navy-900 mt-0.5">{receiptPayment.id}</p>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.paymentDate')}</span>
                  <span className="font-semibold text-slate-900">{receiptPayment.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.receivedFrom')}</span>
                  <span className="font-bold text-navy-900">{receiptPayment.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('members.memberId')}</span>
                  <span className="font-mono font-semibold text-slate-800">{receiptPayment.memberId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.paymentFor')}</span>
                  <span className="font-bold text-navy-900">
                    {receiptPayment.installmentLabel} ({formatMonthLabel(receiptPayment.month, lang)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('payments.paidVia')}</span>
                  <span className="font-semibold text-slate-800">
                    {receiptPayment.method} ({receiptPayment.transactionId})
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-navy-900 text-white flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {t('payments.amount')}
                </span>
                <span className="text-xl font-extrabold text-gold-400 tabular-nums">
                  ৳{Number(receiptPayment.amount).toLocaleString()} {t('common.bdt')}
                </span>
              </div>

              <div className="pt-4 flex items-center justify-between text-xs text-slate-500 border-t border-dashed border-slate-200">
                <span>{settings.contactEmail}</span>
                <span className="font-semibold text-navy-900">{t('payments.authorizedBy')}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 no-print">
              <button
                onClick={() => setReceiptPayment(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
              >
                <Printer className="w-4 h-4 text-gold-400" />
                {t('payments.printReceipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
