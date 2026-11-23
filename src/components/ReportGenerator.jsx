import React, { useEffect, useRef, useState } from 'react';
import {
  FileBarChart2,
  Users,
  CreditCard,
  Lock,
  Eye,
  Download,
  CheckCircle2,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { buildReportPdf } from '../utils/reportPdfGenerator';

const BATCH_YEARS = Array.from({ length: 69 }, (_, i) => String(2026 - i));

export default function ReportGenerator() {
  const { lang, plans, showToast } = useApp();

  const [reportType, setReportType] = useState('monthly_payment'); // 'monthly_payment' | 'member_list'
  const [month, setMonth] = useState('2027-01');
  const [batchFilter, setBatchFilter] = useState('all');
  const [singleBatch, setSingleBatch] = useState('2020');
  const [multiBatchInput, setMultiBatchInput] = useState('1980-1985, 2012, 2020');
  const [memberType, setMemberType] = useState('all');

  // Access Code Modal State
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  // 15-Second Progress Bar State
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [stageLabel, setStageLabel] = useState('');
  const [readyReport, setReadyReport] = useState(null); // { blobUrl, fileName, summary }

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (readyReport?.blobUrl) URL.revokeObjectURL(readyReport.blobUrl);
    };
  }, [readyReport]);

  const openConfirmModal = (e) => {
    e.preventDefault();
    setCodeError('');
    setAccessCode('');
    setShowCodeModal(true);
  };

  const handleVerifyAndGenerate = async (e) => {
    e.preventDefault();
    setCodeError('');
    setVerifyingCode(true);

    try {
      const authRes = await apiRequest('/api/admin/reports/verify-code', {
        method: 'POST',
        body: JSON.stringify({ accessCode }),
      });

      const reportData = await apiRequest('/api/admin/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          reportToken: authRes.reportToken,
          reportType,
          month,
          batchFilter,
          singleBatch,
          multiBatchInput,
          memberType,
        }),
      });

      const pdfResult = buildReportPdf(reportData);

      // Close modal & start 15-second progress loader
      setShowCodeModal(false);
      setReadyReport(null);
      setGenerating(true);
      setProgress(0);
      setSecondsLeft(15);

      const startTime = Date.now();
      const totalMs = 15000;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
        const rem = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        setProgress(pct);
        setSecondsLeft(rem);

        if (pct < 25) {
          setStageLabel(
            lang === 'bn'
              ? 'অ্যাক্সেস কোড ও অনুমতি যাচাই করা হচ্ছে...'
              : 'Verifying encrypted report access authorization...'
          );
        } else if (pct < 55) {
          setStageLabel(
            lang === 'bn'
              ? 'ডাটাবেস থেকে প্রকৃত তথ্য সংগ্রহ করা হচ্ছে...'
              : 'Retrieving live records from SQLite database...'
          );
        } else if (pct < 85) {
          setStageLabel(
            lang === 'bn'
              ? 'অফিশিয়াল পিডিএফ টেবিল ও হিসাব তৈরি হচ্ছে...'
              : 'Compiling official club letterhead, tables & totals...'
          );
        } else {
          setStageLabel(
            lang === 'bn' ? 'চূড়ান্ত পিডিএফ প্রস্তুত করা হচ্ছে...' : 'Finalizing downloadable PDF document...'
          );
        }

        if (elapsed >= totalMs) {
          clearInterval(timerRef.current);
          setGenerating(false);
          setReadyReport({
            ...pdfResult,
            summary: reportData,
          });
          showToast(
            lang === 'bn' ? 'অফিশিয়াল পিডিএফ রিপোর্ট প্রস্তুত হয়েছে!' : 'Official PDF Report is ready!',
            'success'
          );
        }
      }, 150);
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#004B76]">
          {lang === 'bn' ? 'অফিশিয়াল রিপোর্ট জেনারেশন সিস্টেম' : 'Official Report Generation System'}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {lang === 'bn'
            ? 'ডাটাবেস থেকে মাসিক পেমেন্ট রিপোর্ট এবং ক্যাটাগরি/ব্যাচভিত্তিক সদস্য তালিকা পিডিএফ আকারে তৈরি করুন।'
            : 'Generate institutional PDF reports directly from live database records with encrypted access-code protection.'}
        </p>
      </div>

      {/* Report Configuration Form */}
      <form onSubmit={openConfirmModal} className="bg-white border border-slate-200 p-6 space-y-6">
        {/* Step 1: Choose Report Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            {lang === 'bn' ? '১. রিপোর্টের ধরন নির্বাচন করুন' : '1. Select Report Type'}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setReportType('monthly_payment');
                setReadyReport(null);
              }}
              className={`p-5 border text-left transition-all flex items-start gap-3.5 ${
                reportType === 'monthly_payment'
                  ? 'border-[#004B76] bg-[#EBF4FA]/60 ring-1 ring-[#004B76]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#004B76] text-white flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'bn' ? 'মাসিক পেমেন্ট রিপোর্ট' : 'Monthly Payment Report'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {lang === 'bn'
                    ? 'নির্বাচিত মাসে সংগৃহীত পেমেন্টের তালিকা (Paid List) এবং বকেয়া তালিকা (Due List) ২ পৃষ্ঠার পিডিএফ।'
                    : 'Includes payments received during the selected month (Paid List) and unpaid dues (Due List) with BDT totals.'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setReportType('member_list');
                setReadyReport(null);
              }}
              className={`p-5 border text-left transition-all flex items-start gap-3.5 ${
                reportType === 'member_list'
                  ? 'border-[#004B76] bg-[#EBF4FA]/60 ring-1 ring-[#004B76]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#004B76] text-white flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'bn' ? 'সদস্য তালিকা রিপোর্ট' : 'Member Lists Report'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {lang === 'bn'
                    ? 'ক্লাসিক, রাইজিং স্টার, লিগ্যাসি, মেম্বার টাইপ (প্রতিষ্ঠাতা/স্থায়ী/সহযোগী) অথবা ব্যাচ অনুযায়ী তালিকা।'
                    : 'Categorized directory by Rising Star, Classic, Legacy/Legendary, Member Type (Founder/Associate/etc.), or Batch.'}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Filter Criteria */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            {lang === 'bn' ? '২. ফিল্টার ও সময়কাল নির্ধারণ করুন' : '2. Configure Report Parameters'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportType === 'monthly_payment' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'পেমেন্ট গ্রহণের মাস' : 'Payment Received Month'}
                </label>
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm font-semibold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {lang === 'bn'
                    ? 'এই মাসে প্রাপ্ত সকল যাচাইকৃত পেমেন্ট অন্তর্ভুক্ত হবে।'
                    : 'Includes all verified payments received in this month.'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {lang === 'bn' ? 'ব্যাচ / ক্যাটাগরি ফিল্টার' : 'Batch / Category Scope'}
              </label>
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
              >
                <option value="all">All Batches</option>
                <option value="rising_star_all">Rising Star (All: 2009–2024)</option>
                <option value="rising_star_young">Rising Star (2015–2024)</option>
                <option value="rising_star_senior">Rising Star (2009–2014)</option>
                <option value="classic">Classic (1980–2008)</option>
                <option value="legacy">Legacy / Legendary (1958–1979)</option>
                <option value="single">Single SSC Batch</option>
                <option value="multiple">Multiple Batches / Range (e.g. 1980-1985)</option>
              </select>
            </div>

            {batchFilter === 'single' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'এসএসসি ব্যাচ নির্বাচন' : 'Select SSC Batch'}
                </label>
                <select
                  value={singleBatch}
                  onChange={(e) => setSingleBatch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
                >
                  {BATCH_YEARS.map((y) => (
                    <option key={y} value={y}>
                      SSC {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {batchFilter === 'multiple' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'একাধিক ব্যাচ বা রেঞ্জ লিখুন' : 'Multiple Batches or Range'}
                </label>
                <input
                  type="text"
                  required
                  value={multiBatchInput}
                  onChange={(e) => setMultiBatchInput(e.target.value)}
                  placeholder="e.g. 1980-1985, 2012, 2020"
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm font-mono"
                />
              </div>
            )}

            {reportType === 'member_list' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'সদস্যপদের ধরন (Member Type)' : 'Member Type'}
                </label>
                <select
                  value={memberType}
                  onChange={(e) => setMemberType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
                >
                  <option value="all">All Member Types</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {lang === 'bn' ? p.nameBn : p.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-[#004B76]" />
            {lang === 'bn'
              ? 'রিপোর্ট তৈরির জন্য অনুমোদিত অ্যাক্সেস কোড প্রয়োজন।'
              : 'Requires authorized Access Code confirmation before generation.'}
          </span>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <FileBarChart2 className="w-4 h-4" />
            {lang === 'bn' ? 'রিপোর্ট জেনারেট করুন' : 'Generate PDF Report'}
          </button>
        </div>
      </form>

      {/* 15-SECOND PROGRESS BAR PANEL */}
      {generating && (
        <div className="bg-white border border-[#004B76]/30 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#004B76]">
                {lang === 'bn' ? 'অফিশিয়াল পিডিএফ রিপোর্ট তৈরি হচ্ছে...' : 'Generating Official PDF Report...'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">{stageLabel}</p>
            </div>
            <span className="text-sm font-mono font-bold text-[#004B76] tabular-nums">
              {progress}% · {secondsLeft}s
            </span>
          </div>

          <div className="w-full h-3 bg-[#F1F4F6] rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-[#004B76] transition-all duration-150 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* READY PDF PANEL: VIEW & DOWNLOAD */}
      {readyReport && !generating && (
        <div className="bg-white border border-emerald-300 border-l-4 border-l-emerald-600 p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  {lang === 'bn' ? 'রিপোর্ট পিডিএফ প্রস্তুত!' : 'Official PDF Report Ready'}
                </h3>
                <p className="text-xs font-mono text-slate-600 mt-0.5">{readyReport.fileName}</p>
                {readyReport.summary?.reportType === 'monthly_payment' ? (
                  <p className="text-xs text-slate-700 mt-1.5">
                    Month: <strong>{readyReport.summary.monthLabel}</strong> · Batch:{' '}
                    <strong>{readyReport.summary.batchLabel}</strong> · Total Paid:{' '}
                    <strong className="text-emerald-700">
                      ৳{Number(readyReport.summary.totalPaid).toLocaleString()}
                    </strong>{' '}
                    · Due:{' '}
                    <strong className="text-rose-700">
                      ৳{Number(readyReport.summary.totalDue).toLocaleString()}
                    </strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-700 mt-1.5">
                    Scope: <strong>{readyReport.summary.batchLabel}</strong> · Type:{' '}
                    <strong>{readyReport.summary.memberTypeLabel}</strong> · Total Members:{' '}
                    <strong className="text-[#004B76]">{readyReport.summary.totalMembers}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href={readyReport.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-xs font-semibold"
              >
                <Eye className="w-4 h-4" />
                {lang === 'bn' ? 'পিডিএফ দেখুন' : 'View PDF'}
              </a>
              <a
                href={readyReport.blobUrl}
                download={readyReport.fileName}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                {lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ACCESS CODE CONFIRMATION MODAL */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#004B76] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-sm">
                  {lang === 'bn' ? 'রিপোর্ট অ্যাক্সেস কোড নিশ্চিত করুন' : 'Confirm Report Access Code'}
                </h3>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleVerifyAndGenerate} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {lang === 'bn'
                  ? 'অফিশিয়াল রিপোর্ট জেনারেট করতে আপনার অনুমোদিত ৮ ডিজিটের অ্যাক্সেস কোড প্রবেশ করান।'
                  : 'Enter your authorized 8-digit Report Access Code to verify authorization and generate the PDF.'}
              </p>

              <div className="p-4 bg-[#F1F4F6]">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'অ্যাক্সেস কোড' : 'Access Code'}
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded border border-slate-300 bg-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#004B76]"
                />
              </div>

              {codeError && (
                <div className="p-3 bg-rose-50 border-l-4 border-rose-600 text-xs font-semibold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={verifyingCode}
                  className="px-6 py-2 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {verifyingCode
                    ? lang === 'bn'
                      ? 'যাচাই হচ্ছে...'
                      : 'Verifying...'
                    : lang === 'bn'
                    ? 'নিশ্চিত করুন'
                    : 'Confirm & Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
