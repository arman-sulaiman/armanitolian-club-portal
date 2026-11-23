import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  UserPlus,
  Search,
  CreditCard,
  Globe,
  CheckCircle2,
  Clock,
  AlertCircle,
  Printer,
  Share2,
  X,
  User,
  FileText,
  Lock,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { generateMemberSchedule, formatMonthLabel } from '../utils/subscriptionEngine';
import RegistrationForm from './RegistrationForm';

export default function PublicPortal() {
  const { lang, setLang, route, setRoute, settings, showToast, toast } = useApp();
  const [portalTab, setPortalTab] = useState('payments'); // 'track' | 'payments'

  const [trackQuery, setTrackQuery] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackedApp, setTrackedApp] = useState(null);
  const [trackError, setTrackError] = useState('');

  const [clubId, setClubId] = useState('');
  const [phone, setPhone] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [memberBundle, setMemberBundle] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [paymentBanner, setPaymentBanner] = useState(null);

  const [spOrder, setSpOrder] = useState(null);
  const [spProcessing, setSpProcessing] = useState(false);

  const clubName = lang === 'bn' ? settings.clubNameBn : settings.clubNameEn;
  const portalSubtitle = lang === 'bn' ? 'সদস্য সেবা পোর্টাল' : 'Member Services Portal';

  const loadMemberPayments = async (cId = clubId, ph = phone) => {
    setPayError('');
    setPayLoading(true);
    try {
      const res = await apiRequest('/api/public/member-payments', {
        method: 'POST',
        body: JSON.stringify({ clubId: cId, phone: ph }),
      });
      setMemberBundle(res);
    } catch (err) {
      setMemberBundle(null);
      setPayError(err.message);
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => {
    const hash = window.location.hash || '';
    const savedRaw = sessionStorage.getItem('armanitollian_member_lookup');
    let saved = null;
    try {
      if (savedRaw) saved = JSON.parse(savedRaw);
    } catch {
      // ignore
    }

    const qs = new URLSearchParams(hash.split('?')[1] || '');
    const receipt = qs.get('receipt') || '';
    const amount = qs.get('amount') || '';
    const label = qs.get('label') || '';
    const month = qs.get('month') || '';
    const trxId = qs.get('trxId') || '';
    const orderId = qs.get('orderId') || '';

    if (hash.includes('payment=success')) {
      setPaymentBanner({
        type: 'success',
        receipt,
        amount,
        label,
        month,
        trxId,
      });
      setPortalTab('payments');
      if (saved?.clubId && saved?.phone) {
        setClubId(saved.clubId);
        setPhone(saved.phone);
        loadMemberPayments(saved.clubId, saved.phone);
      }
    } else if (hash.includes('payment=cancelled')) {
      setPaymentBanner({
        type: 'info',
        orderId,
      });
      setPortalTab('payments');
      if (saved?.clubId && saved?.phone) {
        setClubId(saved.clubId);
        setPhone(saved.phone);
        loadMemberPayments(saved.clubId, saved.phone);
      }
    } else if (hash.includes('payment=failed')) {
      setPaymentBanner({
        type: 'error',
        orderId,
        amount,
        label,
        month,
      });
      setPortalTab('payments');
      if (saved?.clubId && saved?.phone) {
        setClubId(saved.clubId);
        setPhone(saved.phone);
        loadMemberPayments(saved.clubId, saved.phone);
      }
    }
  }, [route, lang]);

  const copyPublicRegisterLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#register`;
    navigator.clipboard?.writeText(url);
    showToast(
      lang === 'bn' ? 'নিবন্ধন ফর্মের লিংক কপি করা হয়েছে।' : 'Registration link copied to clipboard.',
      'success'
    );
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    setTrackError('');
    setTrackedApp(null);
    setTrackLoading(true);
    try {
      const res = await apiRequest('/api/public/track', {
        method: 'POST',
        body: JSON.stringify({ query: trackQuery }),
      });
      setTrackedApp(res.application);
    } catch (err) {
      setTrackError(err.message);
    } finally {
      setTrackLoading(false);
    }
  };

  const handleMemberPaymentLookup = (e) => {
    e.preventDefault();
    loadMemberPayments(clubId, phone);
  };

  const handleShurjoPay = async (item) => {
    if (!memberBundle?.member) return;
    setSpProcessing(true);
    try {
      const res = await apiRequest('/api/shurjopay/initiate', {
        method: 'POST',
        body: JSON.stringify({
          clubId: memberBundle.member.memberId,
          phone,
          month: item.month,
          amount: item.amount,
          paymentType: item.type,
          installmentLabel: item.labelEn,
        }),
      });

      if (res.checkoutUrl && !res.simulated) {
        sessionStorage.setItem(
          'armanitollian_member_lookup',
          JSON.stringify({ clubId: memberBundle.member.memberId, phone })
        );
        window.location.href = res.checkoutUrl;
        return;
      }

      setSpOrder({
        orderId: res.orderId,
        amount: item.amount,
        label: lang === 'bn' ? item.labelBn : item.labelEn,
        month: item.month,
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSpProcessing(false);
    }
  };

  const completeSimulatedShurjoPay = async (channel) => {
    if (!spOrder) return;
    setSpProcessing(true);
    try {
      const res = await apiRequest('/api/shurjopay/simulate-complete', {
        method: 'POST',
        body: JSON.stringify({ orderId: spOrder.orderId, channel }),
      });
      setSpOrder(null);
      showToast(
        lang === 'bn' ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।' : 'Payment completed and receipt issued.',
        'success'
      );
      await loadMemberPayments(clubId, phone);
      if (res.payment) setReceiptPayment(res.payment);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSpProcessing(false);
    }
  };

  const schedule = useMemo(() => {
    if (!memberBundle?.member || !memberBundle?.plan) return null;
    return generateMemberSchedule(memberBundle.member, memberBundle.plan, memberBundle.settings);
  }, [memberBundle]);

  // Determine the SINGLE earliest unpaid month (only this month is enabled for payment)
  const firstUnpaidMonth = useMemo(() => {
    if (!schedule?.items) return null;
    const paidMonths = new Set((memberBundle?.payments || []).map((p) => p.month));
    const next = schedule.items.find((item) => !paidMonths.has(item.month));
    return next ? next.month : null;
  }, [schedule, memberBundle]);

  const paidTotal = (memberBundle?.payments || [])
    .filter((p) => p.status === 'verified')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalDue = schedule?.totalPayable || 0;
  const remaining = Math.max(0, totalDue - paidTotal);
  const paidCount = (memberBundle?.payments || []).filter((p) => p.status === 'verified').length;
  const totalSteps = schedule?.items?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F5F7] text-[#1A202C]">
      {/* Official Institutional White Header (Consular Portal Theme) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setRoute('home')}
            className="flex items-center gap-3 text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded flex items-center justify-center bg-[#004B76] text-white shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <span className="h-8 w-[3px] bg-gradient-to-b from-[#002B45] via-[#C8102E] to-[#D4A017] rounded-full" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2.5">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                {clubName}
              </span>
              <span className="text-xs sm:text-sm text-slate-500 font-normal">
                {portalSubtitle}
              </span>
            </div>
          </button>

          {/* Clean Underlined Utility Links */}
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-700">
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="inline-flex items-center gap-1.5 hover:text-[#004B76] transition-colors"
            >
              <span className="underline underline-offset-4">
                {lang === 'en' ? 'বাংলা' : 'English'}
              </span>
              <Globe className="w-4 h-4 text-slate-600" />
            </button>

            <a
              href={`mailto:${settings.contactEmail}`}
              className="hidden sm:inline-flex items-center gap-1.5 hover:text-[#004B76] transition-colors"
            >
              <span className="underline underline-offset-4">
                {lang === 'bn' ? 'যোগাযোগ' : 'Contact'}
              </span>
              <Mail className="w-4 h-4 text-slate-600" />
            </a>

            <button
              onClick={() => setRoute('admin')}
              className="inline-flex items-center gap-1.5 hover:text-[#004B76] transition-colors"
            >
              <span className="underline underline-offset-4">
                {lang === 'bn' ? 'অ্যাডমিন' : 'Account'}
              </span>
              <User className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN BODY */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* DEFAULT HOME VIEW (Official Institutional Portal Cards) */}
        {route === 'home' && (
          <div className="space-y-8">
            <div className="max-w-3xl space-y-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#004B76] flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#004B76] text-white inline-flex items-center justify-center text-xs shrink-0">
                  ✓
                </span>
                <span>
                  {lang === 'bn'
                    ? 'সদস্য নিবন্ধন, আবেদন পর্যবেক্ষণ এবং সাবস্ক্রিপশন পেমেন্ট পোর্টাল'
                    : 'Membership registration, application tracking and subscription payments'}
                </span>
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {lang === 'bn'
                  ? 'আরমানিটোলিয়ান ক্লাবের সদস্যপদের জন্য অনলাইনে আবেদন জমা দিন, আপনার আবেদনের বর্তমান অবস্থা যাচাই করুন এবং অনুমোদিত সদস্যরা নির্ধারিত কিস্তি পরিশোধ করুন।'
                  : 'Submit your official membership application with supporting documents, track committee review status, or manage and pay your monthly subscription installments.'}
              </p>
            </div>

            {/* Clean White Institutional Portal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              {/* Card 1: Member Registration */}
              <div className="bg-white border border-slate-200/90 p-7 sm:p-8 flex flex-col justify-between min-h-[300px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      {lang === 'bn' ? 'সদস্য নিবন্ধন ফর্ম' : 'Member registration'}
                    </h2>
                    <UserPlus className="w-6 h-6 text-[#004B76] shrink-0" />
                  </div>
                  <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                    {lang === 'bn'
                      ? 'ব্যক্তিগত তথ্য, এসএসসি ব্যাচ, ছবি, জাতীয় পরিচয়পত্র ও এসএসসি সনদ সংযুক্ত করে নতুন সদস্যপদের আবেদন সম্পন্ন করুন।'
                      : 'Complete your alumni membership application by providing personal details, SSC batch verification, photograph, NID PDF, and passing certificate.'}
                  </p>
                </div>

                <div className="pt-8 space-y-3">
                  <div className="flex gap-1.5">
                    <span className="h-1 flex-1 bg-[#004B76]" />
                    <span className="h-1 flex-1 bg-slate-200" />
                    <span className="h-1 flex-1 bg-slate-200" />
                    <span className="h-1 flex-1 bg-slate-200" />
                  </div>
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      onClick={() => setRoute('register')}
                      className="flex-1 py-2.5 px-5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold transition-colors"
                    >
                      {lang === 'bn' ? 'আবেদন ফর্ম পূরণ করুন' : 'Fill out application'}
                    </button>
                    <button
                      onClick={copyPublicRegisterLink}
                      title="Copy Public Link"
                      className="py-2.5 px-4 rounded-full border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Track Registration & Payments */}
              <div className="bg-white border border-slate-200/90 p-7 sm:p-8 flex flex-col justify-between min-h-[300px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      {lang === 'bn' ? 'আবেদন ট্র্যাক ও পেমেন্ট' : 'Track application & payments'}
                    </h2>
                    <FileText className="w-6 h-6 text-[#004B76] shrink-0" />
                  </div>
                  <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                    {lang === 'bn'
                      ? 'ট্র্যাকিং নম্বর দিয়ে আবেদনের অবস্থা দেখুন অথবা অনুমোদিত সদস্যরা ক্লাব আইডি ও মোবাইল নম্বর দিয়ে মাসিক কিস্তি পরিশোধ করুন।'
                      : 'Check your membership review status using your tracking ID, or sign in with your Club ID and Phone Number to view installments and pay via ShurjoPay.'}
                  </p>
                </div>

                <div className="pt-8 space-y-3">
                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={() => {
                        setPortalTab('payments');
                        setRoute('portal');
                      }}
                      className="flex-1 py-2.5 px-5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold transition-colors"
                    >
                      {lang === 'bn' ? 'পেমেন্ট করুন' : 'Member payments'}
                    </button>
                    <button
                      onClick={() => {
                        setPortalTab('track');
                        setRoute('portal');
                      }}
                      className="py-2.5 px-5 rounded-full border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-sm font-semibold transition-colors"
                    >
                      {lang === 'bn' ? 'আবেদন ট্র্যাক' : 'Track status'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PUBLIC REGISTRATION VIEW */}
        {route === 'register' && (
          <div className="space-y-5">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setRoute('home')}
                className="text-sm font-semibold text-[#004B76] underline underline-offset-4"
              >
                ← {lang === 'bn' ? 'পোর্টালে ফিরে যান' : 'Back to portal overview'}
              </button>
              <button
                onClick={copyPublicRegisterLink}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-xs font-semibold"
              >
                <Share2 className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'লিংক কপি করুন' : 'Copy form link'}
              </button>
            </div>
            <RegistrationForm isPublic />
          </div>
        )}

        {/* TRACK & MEMBER PAYMENTS VIEW */}
        {route === 'portal' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <button
                  onClick={() => setRoute('home')}
                  className="text-xs font-semibold text-[#004B76] underline underline-offset-4 mb-2 block"
                >
                  ← {lang === 'bn' ? 'পোর্টালে ফিরে যান' : 'Back to portal overview'}
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-[#004B76]">
                  {lang === 'bn' ? 'আবেদন ট্র্যাকিং ও সদস্য পেমেন্ট' : 'Application status & member payments'}
                </h1>
              </div>

              <div className="inline-flex rounded-full bg-white border border-slate-200 p-1">
                <button
                  onClick={() => setPortalTab('payments')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    portalTab === 'payments' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                  }`}
                >
                  {lang === 'bn' ? 'সদস্য পেমেন্ট' : 'Member payments'}
                </button>
                <button
                  onClick={() => setPortalTab('track')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    portalTab === 'track' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                  }`}
                >
                  {lang === 'bn' ? 'আবেদন ট্র্যাক' : 'Track application'}
                </button>
              </div>
            </div>

            {/* SUB-TAB: TRACK APPLICATION */}
            {portalTab === 'track' && (
              <div className="max-w-2xl mx-auto space-y-5">
                <form
                  onSubmit={handleTrack}
                  className="bg-white border border-slate-200 p-6 space-y-4"
                >
                  <label className="block text-sm font-semibold text-slate-800">
                    {lang === 'bn'
                      ? 'আবেদন ট্র্যাকিং আইডি অথবা নিবন্ধিত মোবাইল নম্বর'
                      : 'Application Tracking ID or Registered Phone Number'}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      value={trackQuery}
                      onChange={(e) => setTrackQuery(e.target.value)}
                      placeholder="APP-2026-1005 / 017XXXXXXXX"
                      className="flex-1 px-4 py-2.5 rounded border border-slate-300 text-sm font-mono bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#004B76]"
                    />
                    <button
                      type="submit"
                      disabled={trackLoading}
                      className="px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      {lang === 'bn' ? 'অনুসন্ধান' : 'Search'}
                    </button>
                  </div>
                  {trackError && <p className="text-xs font-semibold text-rose-700">{trackError}</p>}
                </form>

                {trackedApp && (
                  <div className="bg-white border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={trackedApp.photo}
                        alt={trackedApp.fullName}
                        className="w-16 h-16 rounded object-cover border border-slate-200 bg-white"
                      />
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            trackedApp.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : trackedApp.status === 'pending'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {trackedApp.status === 'approved' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {trackedApp.status.toUpperCase()}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">{trackedApp.fullName}</h3>
                        <p className="text-xs text-slate-500">
                          SSC {trackedApp.batch} · {lang === 'bn' ? trackedApp.planNameBn : trackedApp.planNameEn}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100">
                      <div className="p-3 bg-[#F3F5F7]">
                        <p className="text-slate-500 font-semibold uppercase text-[10px]">Tracking ID</p>
                        <p className="font-mono font-bold text-slate-900 mt-0.5">{trackedApp.id}</p>
                      </div>
                      <div className="p-3 bg-[#F3F5F7]">
                        <p className="text-slate-500 font-semibold uppercase text-[10px]">Club Member ID</p>
                        <p className="font-mono font-bold text-[#004B76] mt-0.5">
                          {trackedApp.memberId || 'Pending Approval'}
                        </p>
                      </div>
                    </div>

                    {trackedApp.remarks && (
                      <div className="p-3.5 bg-[#EBF4FA] border-l-4 border-[#004B76] text-xs text-slate-800">
                        <strong>Committee Remarks:</strong> {trackedApp.remarks}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: APPROVED MEMBER PAYMENTS + SHURJOPAY */}
            {portalTab === 'payments' && (
              <div className="space-y-6">
                {paymentBanner && (
                  <div
                    className={`bg-white border border-slate-200 border-l-4 p-5 sm:p-6 shadow-xs ${
                      paymentBanner.type === 'success'
                        ? 'border-l-emerald-600'
                        : paymentBanner.type === 'error'
                        ? 'border-l-rose-600'
                        : 'border-l-[#004B76]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            paymentBanner.type === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : paymentBanner.type === 'error'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-[#EBF4FA] text-[#004B76]'
                          }`}
                        >
                          {paymentBanner.type === 'success' ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : (
                            <AlertCircle className="w-6 h-6" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <h3
                            className={`text-base font-bold ${
                              paymentBanner.type === 'success'
                                ? 'text-emerald-800'
                                : paymentBanner.type === 'error'
                                ? 'text-rose-800'
                                : 'text-[#004B76]'
                            }`}
                          >
                            {paymentBanner.type === 'success'
                              ? lang === 'bn'
                                ? 'পেমেন্ট সফলভাবে সম্পন্ন ও যাচাই হয়েছে'
                                : 'Payment Confirmed & Verified'
                              : paymentBanner.type === 'error'
                              ? lang === 'bn'
                                ? 'পেমেন্ট সম্পন্ন করা যায়নি'
                                : 'Payment Could Not Be Completed'
                              : lang === 'bn'
                              ? 'পেমেন্ট প্রক্রিয়া বাতিল করা হয়েছে'
                              : 'Payment Cancelled'}
                          </h3>

                          <p className="text-sm text-slate-600 leading-relaxed">
                            {paymentBanner.type === 'success'
                              ? lang === 'bn'
                                ? `আপনার ${paymentBanner.label || 'কিস্তি'} (${formatMonthLabel(paymentBanner.month, 'bn')}) বাবদ ৳${Number(paymentBanner.amount || 0).toLocaleString()} টাকা সফলভাবে গ্রহণ করা হয়েছে। একটি নিশ্চিতকরণ এসএমএস আপনার নিবন্ধিত মোবাইলে পাঠানো হয়েছে।`
                                : `Your payment of BDT ${Number(paymentBanner.amount || 0).toLocaleString()} for ${paymentBanner.label || 'Subscription'} (${formatMonthLabel(paymentBanner.month, 'en')}) has been verified and recorded. A confirmation SMS has been sent to your registered phone number.`
                              : paymentBanner.type === 'error'
                              ? lang === 'bn'
                                ? 'গেটওয়ে থেকে পেমেন্ট যাচাই সম্পন্ন হয়নি এবং কোনো কিস্তি পরিশোধিত হিসেবে যুক্ত হয়নি। আপনার অ্যাকাউন্ট থেকে টাকা কাটা হয়ে থাকলে অর্ডার নম্বরসহ ক্লাব অফিসে যোগাযোগ করুন অথবা পুনরায় চেষ্টা করুন। একটি এসএমএস নোটিফিকেশন পাঠানো হয়েছে।'
                                : 'The transaction was not confirmed by ShurjoPay, so no installment was marked as paid. If any amount was debited from your bank/MFS, please contact the club office with your Order ID or try paying again. An SMS notification has been sent to your phone.'
                              : lang === 'bn'
                              ? 'আপনি পেমেন্ট গেটওয়ে থেকে ফিরে এসেছেন। আপনি নিচের তালিকা থেকে পুনরায় পেমেন্ট করতে পারবেন।'
                              : 'You cancelled the payment session before completion. No amount was recorded; you may retry payment anytime below.'}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                            {paymentBanner.receipt && (
                              <span className="px-2.5 py-1 bg-[#F3F5F7] rounded font-mono font-semibold text-slate-800">
                                Receipt: {paymentBanner.receipt}
                              </span>
                            )}
                            {paymentBanner.trxId && (
                              <span className="px-2.5 py-1 bg-[#F3F5F7] rounded font-mono text-slate-700">
                                TrxID: {paymentBanner.trxId}
                              </span>
                            )}
                            {paymentBanner.orderId && (
                              <span className="px-2.5 py-1 bg-rose-50 rounded font-mono text-rose-800">
                                Order ID: {paymentBanner.orderId}
                              </span>
                            )}
                          </div>

                          {paymentBanner.type === 'success' && (
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  const matched =
                                    (memberBundle?.payments || []).find(
                                      (p) => p.id === paymentBanner.receipt
                                    ) || (memberBundle?.payments || [])[0];
                                  if (matched) setReceiptPayment(matched);
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                {lang === 'bn' ? 'অফিশিয়াল রসিদ দেখুন / প্রিন্ট করুন' : 'View / Print Official Receipt'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setPaymentBanner(null)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={handleMemberPaymentLookup}
                  className="bg-white border border-slate-200 p-6 space-y-4"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {lang === 'bn'
                      ? 'আপনার ক্লাব সদস্য আইডি এবং নিবন্ধিত মোবাইল নম্বর প্রবেশ করান:'
                      : 'Enter your Club Member ID and registered Phone Number to view and pay installments:'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={clubId}
                      onChange={(e) => setClubId(e.target.value)}
                      placeholder="Club ID (e.g. AC-2004-0012)"
                      className="px-4 py-2.5 rounded border border-slate-300 text-sm font-mono bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#004B76]"
                    />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (e.g. 01711542891)"
                      className="px-4 py-2.5 rounded border border-slate-300 text-sm bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#004B76]"
                    />
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      {lang === 'bn' ? 'পেমেন্ট দেখুন' : 'View payments'}
                    </button>
                  </div>
                  {payError && (
                    <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> {payError}
                    </p>
                  )}
                </form>

                {memberBundle && schedule && (
                  <div className="space-y-5">
                    {/* Member Summary Header */}
                    <div className="bg-white border border-slate-200 p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={memberBundle.member.photo}
                            alt={memberBundle.member.fullName}
                            className="w-16 h-16 rounded object-cover border border-slate-200 bg-white"
                          />
                          <div>
                            <span className="text-xs font-semibold text-[#004B76] bg-[#EBF4FA] px-2.5 py-0.5 rounded">
                              {lang === 'bn' ? memberBundle.plan?.nameBn : memberBundle.plan?.nameEn}
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 mt-1">
                              {memberBundle.member.fullName}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">
                              {memberBundle.member.memberId} · SSC {memberBundle.member.batch} ·{' '}
                              {schedule.batchRule.categoryEn}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                          <div>
                            <p className="text-xs text-slate-500">{lang === 'bn' ? 'মোট' : 'Total'}</p>
                            <p className="text-lg font-bold text-slate-900 tabular-nums">
                              ৳{totalDue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</p>
                            <p className="text-lg font-bold text-emerald-700 tabular-nums">
                              ৳{paidTotal.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{lang === 'bn' ? 'বকেয়া' : 'Remaining'}</p>
                            <p className="text-lg font-bold text-[#004B76] tabular-nums">
                              ৳{remaining.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {lang === 'bn'
                            ? 'ক্রমানুসারে শুধুমাত্র সর্বশেষ বকেয়া মাসের পেমেন্ট সক্রিয় রয়েছে।'
                            : 'Sequential billing: only the current earliest unpaid month is enabled for payment.'}
                        </span>
                        <span className="font-bold text-[#004B76] tabular-nums">
                          {paidCount} / {totalSteps}
                        </span>
                      </div>
                    </div>

                    {/* Installment Cards (ONLY Latest/Next Unpaid Month Enabled!) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {schedule.items.map((item) => {
                        const matched = (memberBundle.payments || []).find(
                          (p) => p.month === item.month
                        );
                        const isVerified = matched?.status === 'verified';
                        const isPending = matched?.status === 'pending';
                        const isCurrentDue = !matched && item.month === firstUnpaidMonth;
                        const isLocked = !matched && item.month !== firstUnpaidMonth;

                        return (
                          <div
                            key={`${item.type}-${item.month}`}
                            className={`p-5 border flex flex-col justify-between transition-all ${
                              isVerified
                                ? 'bg-white border-emerald-300'
                                : isPending
                                ? 'bg-amber-50/50 border-amber-300'
                                : isCurrentDue
                                ? 'bg-white border-[#004B76] ring-1 ring-[#004B76]/20'
                                : 'bg-[#F8F9FA] border-slate-200 opacity-70'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    isCurrentDue
                                      ? 'bg-[#004B76] text-white'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {lang === 'bn' ? item.labelBn : item.labelEn}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {formatMonthLabel(item.month, lang)}
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                                ৳{item.amount.toLocaleString()}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                              {isVerified ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                                  </span>
                                  <button
                                    onClick={() => setReceiptPayment(matched)}
                                    className="text-xs font-semibold text-[#004B76] underline underline-offset-2 inline-flex items-center gap-1"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    {lang === 'bn' ? 'রসিদ' : 'Receipt'}
                                  </button>
                                </>
                              ) : isPending ? (
                                <span className="text-xs font-semibold text-amber-700">
                                  {lang === 'bn' ? 'যাচাই প্রক্রিয়াধীন' : 'Pending verification'}
                                </span>
                              ) : isCurrentDue ? (
                                <button
                                  disabled={spProcessing}
                                  onClick={() => handleShurjoPay(item)}
                                  className="w-full py-2 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  {lang === 'bn' ? 'ShurjoPay-তে পরিশোধ' : 'Pay via ShurjoPay'}
                                </button>
                              ) : (
                                <span className="w-full py-1.5 text-center text-[11px] font-medium text-slate-400 inline-flex items-center justify-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  {lang === 'bn' ? 'পূর্ববর্তী মাস বাকি' : 'Pay previous due first'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Clean Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-xs text-slate-500 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {clubName} · {settings.clubAddress}
          </span>
          <span>{settings.contactPhone} · {settings.contactEmail}</span>
        </div>
      </footer>

      {/* SHURJOPAY SANDBOX FALLBACK MODAL */}
      {spOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-[#004B76] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sky-200">ShurjoPay Checkout</p>
                <h3 className="font-bold text-base">{clubName}</h3>
              </div>
              <button onClick={() => setSpOrder(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-[#F3F5F7] border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{spOrder.label}</p>
                  <p className="text-[11px] font-mono text-slate-500">{spOrder.orderId}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  ৳{Number(spOrder.amount).toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {['bKash', 'Nagad', 'Visa / Mastercard', 'DBBL Nexus'].map((ch) => (
                  <button
                    key={ch}
                    disabled={spProcessing}
                    onClick={() => completeSimulatedShurjoPay(ch)}
                    className="p-3 rounded border border-slate-300 hover:border-[#004B76] hover:bg-[#EBF4FA] text-xs font-semibold text-slate-800"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {receiptPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 no-print">
              <h3 className="font-bold text-[#004B76]">Official Payment Receipt</h3>
              <button onClick={() => setReceiptPayment(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border border-slate-300 p-6 space-y-4 text-sm">
              <div className="text-center border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#004B76] text-base">{clubName}</h4>
                <p className="font-mono text-xs text-slate-600 mt-1">{receiptPayment.id}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Member</span>
                  <span className="font-semibold">{receiptPayment.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Club ID</span>
                  <span className="font-mono font-semibold">{receiptPayment.memberId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment For</span>
                  <span className="font-semibold">
                    {receiptPayment.installmentLabel} ({formatMonthLabel(receiptPayment.month, lang)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method / TrxID</span>
                  <span className="font-mono text-xs">
                    {receiptPayment.method} · {receiptPayment.transactionId}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-[#004B76] text-white flex justify-between items-center">
                <span className="text-xs uppercase text-sky-100">Amount Paid</span>
                <span className="text-xl font-bold tabular-nums">
                  ৳{Number(receiptPayment.amount).toLocaleString()} BDT
                </span>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 no-print">
              <button
                onClick={() => setReceiptPayment(null)}
                className="px-4 py-2 rounded-full border border-slate-300 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-full bg-[#004B76] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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
            <CheckCircle2 className="w-4 h-4" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
