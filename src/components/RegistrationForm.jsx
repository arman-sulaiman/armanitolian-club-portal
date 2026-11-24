import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  MapPin,
  Briefcase,
  FileUp,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  CalendarClock,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { getBatchRule, formatMonthLabel, addMonthsToYYYYMM } from '../utils/subscriptionEngine';

const BATCH_YEARS = Array.from({ length: 69 }, (_, i) => String(2026 - i));

const initialFormState = {
  fullName: '',
  batch: '',
  religion: 'Islam',
  fathersName: '',
  mothersName: '',
  presentAddress: '',
  permanentAddress: '',
  sameAsPresent: false,
  phone: '',
  secondaryPhone: '',
  email: '',
  bloodGroup: '',
  dob: '',
  profession: '',
  currentInstitution: '',
  lastDegree: '',
  passingYearOrRunning: '',
  educationInstitution: '',
  educationCountry: 'Bangladesh',
  nidNumber: '',
  maritalStatus: 'Single',
  spouseName: '',
  planId: 'plan-permanent',
  paymentMode: 'installment',
  photo: null,
  photoName: '',
  nidPdfName: '',
  nidPdfData: null,
  sscProofName: '',
  sscProofData: null,
  customValues: {},
};

const DRAFT_STORAGE_KEY = 'armanitolian_reg_draft_v1';

function loadSavedDraft(defaultPlanId) {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.form) {
      return {
        step: Number(parsed.step) >= 1 && Number(parsed.step) <= 5 ? Number(parsed.step) : 1,
        form: { ...initialFormState, planId: defaultPlanId, ...parsed.form },
      };
    }
  } catch {
    // ignore corrupt draft
  }
  return null;
}

export default function RegistrationForm({
  isPublic = false,
  revisionData = null,
  revisionToken = '',
  onRevisionSuccess = null,
}) {
  const { lang, t, plans, settings, submitRegistration, showToast, setActiveTab, setRoute } = useApp();
  const isRevisionMode = Boolean(revisionData && revisionToken);
  const enabledPlans = plans.filter((p) => p.enabled !== false);
  const defaultPlanId = enabledPlans[0]?.id || 'plan-permanent';

  const savedDraft = !isRevisionMode ? loadSavedDraft(defaultPlanId) : null;

  const [step, setStep] = useState(() => (isRevisionMode ? 1 : savedDraft?.step || 1));
  const [form, setForm] = useState(() =>
    isRevisionMode
      ? { ...initialFormState, ...revisionData }
      : savedDraft?.form || { ...initialFormState, planId: defaultPlanId }
  );
  const [errors, setErrors] = useState({});
  const [submittedApp, setSubmittedApp] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-save form & step to localStorage across page reloads
  useEffect(() => {
    if (isRevisionMode || submittedApp) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ step, form }));
    } catch {
      // If large base64 files exceed quota, still persist all text fields & step safely
      try {
        const lightForm = {
          ...form,
          photo: null,
          nidPdfData: null,
          sscProofData: null,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ step, form: lightForm }));
      } catch {
        // ignore storage unavailable
      }
    }
  }, [form, step, isRevisionMode, submittedApp]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setForm({ ...initialFormState, planId: defaultPlanId });
    setStep(1);
    setErrors({});
    showToast(lang === 'bn' ? 'খসড়া মুছে ফেলা হয়েছে।' : 'Saved draft cleared.', 'info');
  };

  // Step 5 SMS OTP Verification State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const sendOtpCode = async () => {
    setOtpError('');
    setOtpSending(true);
    try {
      const res = await apiRequest('/api/public/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: form.phone, fullName: form.fullName }),
      });
      setOtpSent(true);
      setOtpVerified(false);
      setOtpToken('');
      setOtpDigits(['', '', '', '', '', '']);
      setResendTimer(60);
      showToast(
        lang === 'bn'
          ? `আপনার মোবাইলে (${res.maskedPhone}) ৬ ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে।`
          : `6-digit confirmation code sent via SMS to ${res.maskedPhone}.`,
        'success'
      );
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setOtpError(err.message);
      showToast(err.message, 'error');
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpDigitChange = (index, rawVal) => {
    const cleaned = rawVal.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      // Handle pasting 6-digit code
      const chars = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((c, idx) => {
        next[idx] = c;
      });
      setOtpDigits(next);
      setOtpError('');
      const focusIdx = Math.min(5, chars.length);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...otpDigits];
    next[index] = cleaned;
    setOtpDigits(next);
    setOtpError('');
    if (index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtpCode = async () => {
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError(
        lang === 'bn' ? 'অনুগ্রহ করে ৬ ডিজিটের কোডটি সম্পূর্ণ লিখুন।' : 'Please enter all 6 digits of your confirmation code.'
      );
      return;
    }
    setOtpError('');
    setOtpVerifying(true);
    try {
      const res = await apiRequest('/api/public/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: form.phone, code }),
      });
      setOtpVerified(true);
      setOtpToken(res.otpToken);
      setErrors((prev) => ({ ...prev, otp: '' }));
      showToast(
        lang === 'bn' ? 'মোবাইল নম্বর সফলভাবে যাচাই হয়েছে!' : 'Phone number verified successfully!',
        'success'
      );
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const isMarried = form.maritalStatus === 'Married';

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'sameAsPresent' && value) {
        next.permanentAddress = prev.presentAddress;
      }
      if (field === 'presentAddress' && prev.sameAsPresent) {
        next.permanentAddress = value;
      }
      if (field === 'maritalStatus' && value !== 'Married') {
        next.spouseName = '';
      }
      return next;
    });
    if (field === 'phone') {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpToken('');
      setOtpDigits(['', '', '', '', '', '']);
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const updateCustomField = (fieldId, value) => {
    setForm((prev) => ({
      ...prev,
      customValues: { ...prev.customValues, [fieldId]: value },
    }));
  };

  const handleFileUpload = (field, file, allowedTypes) => {
    if (!file) return;
    if (allowedTypes && !allowedTypes.some((type) => file.type.includes(type) || file.name.toLowerCase().endsWith(type))) {
      showToast(lang === 'bn' ? 'সঠিক ফরম্যাটের ফাইল আপলোড করুন।' : 'Please upload a valid file format.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (field === 'photo') {
        setForm((prev) => ({ ...prev, photo: reader.result, photoName: file.name }));
        setErrors((prev) => ({ ...prev, photo: '' }));
      } else if (field === 'nidPdf') {
        setForm((prev) => ({ ...prev, nidPdfData: reader.result, nidPdfName: file.name }));
        setErrors((prev) => ({ ...prev, nidPdfName: '' }));
      } else if (field === 'sscProof') {
        setForm((prev) => ({ ...prev, sscProofData: reader.result, sscProofName: file.name }));
        setErrors((prev) => ({ ...prev, sscProofName: '' }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (targetStep) => {
    const errs = {};
    if (targetStep === 1) {
      if (!form.fullName.trim()) errs.fullName = true;
      if (!form.batch) errs.batch = true;
      if (!form.religion) errs.religion = true;
      if (!form.fathersName.trim()) errs.fathersName = true;
      if (!form.mothersName.trim()) errs.mothersName = true;
      if (!form.dob) errs.dob = true;
      if (!form.bloodGroup) errs.bloodGroup = true;
      if (!form.nidNumber.trim()) errs.nidNumber = true;
      if (isMarried && !form.spouseName.trim()) errs.spouseName = true;
    } else if (targetStep === 2) {
      if (!form.phone.trim()) errs.phone = true;
      if (settings.requireSecondaryPhone && !form.secondaryPhone.trim()) errs.secondaryPhone = true;
      if (!form.email.trim() || !form.email.includes('@')) errs.email = true;
      if (!form.presentAddress.trim()) errs.presentAddress = true;
      if (!form.permanentAddress.trim()) errs.permanentAddress = true;
    } else if (targetStep === 3) {
      if (!form.profession.trim()) errs.profession = true;
      if (settings.requireInstitution && !form.currentInstitution.trim()) errs.currentInstitution = true;
      if (!form.lastDegree.trim()) errs.lastDegree = true;
      if (!form.passingYearOrRunning.trim()) errs.passingYearOrRunning = true;
      if (!form.educationInstitution.trim()) errs.educationInstitution = true;
      if (!form.educationCountry.trim()) errs.educationCountry = true;
    } else if (targetStep === 4) {
      if (!form.planId) errs.planId = true;
      (settings.customFields || []).forEach((cf) => {
        if (cf.required && !(form.customValues[cf.id] || '').trim()) {
          errs[`cf_${cf.id}`] = true;
        }
      });
    } else if (targetStep === 5) {
      if (!form.photo) errs.photo = true;
      if (!form.nidPdfName) errs.nidPdfName = true;
      if (!form.sscProofName) errs.sscProofName = true;
      if (!isRevisionMode && !otpVerified) errs.otp = true;
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast(t('registration.validationError'), 'error');
      return false;
    }
    return true;
  };

  const handleNext = (e) => {
    if (e) e.preventDefault();
    if (validateStep(step)) {
      setErrors({});
      setStep((s) => Math.min(5, s + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== 5) return;
    if (!validateStep(5)) return;
    setSubmitting(true);
    try {
      if (isRevisionMode) {
        const res = await apiRequest('/api/public/revision/resubmit', {
          method: 'PUT',
          body: JSON.stringify({ revisionToken, updates: form }),
        });
        setSubmittedApp(res.member);
        showToast(
          lang === 'bn'
            ? 'সংশোধিত আবেদন সফলভাবে পুনরায় জমা হয়েছে!'
            : 'Revised application resubmitted successfully!',
          'success'
        );
        if (onRevisionSuccess) onRevisionSuccess(res.member);
      } else {
        const created = await submitRegistration({ ...form, otpToken });
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setSubmittedApp(created);
        showToast(t('registration.successTitle'), 'success');
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: t('registration.step1'), icon: User },
    { num: 2, title: t('registration.step2'), icon: MapPin },
    { num: 3, title: t('registration.step3'), icon: Briefcase },
    { num: 4, title: lang === 'bn' ? 'সাবস্ক্রিপশন ও ক্লাব তথ্য' : 'Subscription & Plan', icon: CreditCard },
    { num: 5, title: t('registration.step4'), icon: FileUp },
  ];

  const inputClass = (err) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white transition-all outline-none ${
      err
        ? 'border-rose-500 ring-2 ring-rose-100'
        : 'border-slate-300 focus:border-navy-700 focus:ring-2 focus:ring-navy-900/10'
    }`;

  if (submittedApp) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900">{t('registration.successTitle')}</h2>
        <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
          {t('registration.successDesc')}
        </p>

        <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200 inline-block min-w-[260px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('registration.trackingId')}
          </p>
          <p className="text-2xl font-mono font-bold text-navy-900 mt-1">{submittedApp.id}</p>
          <p className="text-xs text-slate-500 mt-1">
            {submittedApp.fullName} · SSC {submittedApp.batch}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              setForm(initialFormState);
              setStep(1);
              setSubmittedApp(null);
            }}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
          >
            {t('registration.registerAnother')}
          </button>
          <button
            onClick={() => (isPublic ? setRoute('portal') : setActiveTab('approvals'))}
            className="px-5 py-2.5 rounded-xl bg-navy-900 text-white font-semibold text-sm hover:bg-navy-800 inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-gold-400" />
            {isPublic
              ? lang === 'bn'
                ? 'আবেদন ট্র্যাক করুন'
                : 'Track Application Status'
              : t('registration.goToApprovals')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#004B76]">
              {isRevisionMode
                ? lang === 'bn'
                  ? 'আবেদন সংশোধন ও পুনরায় জমা'
                  : 'Edit & Resubmit Application'
                : t('registration.title')}
            </h1>
            <p className="text-sm text-slate-600 mt-1">{t('registration.subtitle')}</p>
          </div>
          {!isRevisionMode && (
            <button
              type="button"
              onClick={clearDraft}
              className="self-start text-xs font-semibold text-slate-500 hover:text-rose-700 underline underline-offset-4 shrink-0"
            >
              {lang === 'bn' ? 'ফর্ম রিসেট করুন' : 'Clear saved draft'}
            </button>
          )}
        </div>

        {isRevisionMode && revisionData?.remarks && (
          <div className="mt-4 p-3.5 bg-amber-50 border-l-4 border-amber-500 text-xs text-amber-900">
            <strong>{lang === 'bn' ? 'কমিটির সংশোধন নোট:' : 'Committee Revision Note:'}</strong>{' '}
            {revisionData.remarks}
          </div>
        )}

        {/* Clean Institutional Stepper (5 Steps) */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < step) {
                    setErrors({});
                    setStep(s.num);
                  }
                }}
                className={`flex items-center gap-2 p-2.5 border text-left transition-all ${
                  active
                    ? 'bg-[#004B76] text-white border-[#004B76]'
                    : completed
                    ? 'bg-[#EBF4FA] text-[#004B76] border-[#004B76]/30'
                    : 'bg-[#F8F9FA] text-slate-500 border-slate-200'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                    active
                      ? 'bg-white text-[#004B76]'
                      : completed
                      ? 'bg-[#004B76] text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider opacity-75">
                    {lang === 'bn' ? `ধাপ ${s.num}/৫` : `Step ${s.num}/5`}
                  </p>
                  <p className="text-[11px] font-bold truncate">{s.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        {/* STEP 1: Personal Information */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.fullName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder={t('registration.fullNamePlaceholder')}
                className={inputClass(errors.fullName)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.batch')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.batch}
                onChange={(e) => updateField('batch', e.target.value)}
                className={inputClass(errors.batch)}
              >
                <option value="">{t('registration.batchPlaceholder')}</option>
                {BATCH_YEARS.map((y) => (
                  <option key={y} value={y}>
                    SSC {y}
                  </option>
                ))}
              </select>
              {form.batch && (() => {
                const rule = getBatchRule(form.batch, settings.batchRules);
                return (
                  <p className="text-[11px] font-bold text-navy-800 mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gold-100 text-gold-600">
                    {lang === 'bn' ? `ব্যাচ ক্যাটাগরি: ${rule.categoryBn}` : `Category: ${rule.categoryEn}`}
                  </p>
                );
              })()}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.religion')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.religion}
                onChange={(e) => updateField('religion', e.target.value)}
                className={inputClass(errors.religion)}
              >
                {['Islam', 'Hinduism', 'Buddhism', 'Christianity', 'Other'].map((rel, i) => (
                  <option key={rel} value={rel}>
                    {t('options.religions')[i]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.fathersName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.fathersName}
                onChange={(e) => updateField('fathersName', e.target.value)}
                className={inputClass(errors.fathersName)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.mothersName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.mothersName}
                onChange={(e) => updateField('mothersName', e.target.value)}
                className={inputClass(errors.mothersName)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.dob')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => updateField('dob', e.target.value)}
                className={inputClass(errors.dob)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.bloodGroup')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.bloodGroup}
                onChange={(e) => updateField('bloodGroup', e.target.value)}
                className={inputClass(errors.bloodGroup)}
              >
                <option value="">--</option>
                {t('options.bloodGroups').map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.nidNumber')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.nidNumber}
                onChange={(e) => updateField('nidNumber', e.target.value)}
                placeholder="10 / 13 / 17 Digit NID or Birth Cert No."
                className={`${inputClass(errors.nidNumber)} font-mono`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.maritalStatus')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.maritalStatus}
                onChange={(e) => updateField('maritalStatus', e.target.value)}
                className={inputClass(false)}
              >
                {['Single', 'Married', 'Divorced', 'Widowed'].map((ms, i) => (
                  <option key={ms} value={ms}>
                    {t('options.maritalStatuses')[i]}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Conditional Spouse Name Field */}
            {isMarried && (
              <div className="md:col-span-2 p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                <label className="block text-xs font-bold text-navy-900 mb-1.5">
                  {t('registration.spouseName')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.spouseName}
                  onChange={(e) => updateField('spouseName', e.target.value)}
                  className={inputClass(errors.spouseName)}
                />
                <p className="text-[11px] text-amber-800 mt-1.5">{t('registration.spouseHint')}</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Contact & Address */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.phone')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+880 1XXX-XXXXXX"
                className={inputClass(errors.phone)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.secondaryPhone')}{' '}
                {settings.requireSecondaryPhone ? (
                  <span className="text-rose-500">*</span>
                ) : (
                  <span className="text-slate-400 font-normal">({t('common.optional')})</span>
                )}
              </label>
              <input
                type="tel"
                value={form.secondaryPhone}
                onChange={(e) => updateField('secondaryPhone', e.target.value)}
                placeholder="+880 1XXX-XXXXXX"
                className={inputClass(errors.secondaryPhone)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.email')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="name@example.com"
                className={inputClass(errors.email)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('registration.presentAddress')} <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={form.presentAddress}
                onChange={(e) => updateField('presentAddress', e.target.value)}
                className={inputClass(errors.presentAddress)}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t('registration.permanentAddress')} <span className="text-rose-500">*</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-navy-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sameAsPresent}
                    onChange={(e) => updateField('sameAsPresent', e.target.checked)}
                    className="rounded border-slate-300 text-navy-900 focus:ring-navy-800"
                  />
                  {t('registration.sameAsPresent')}
                </label>
              </div>
              <textarea
                rows={3}
                value={form.permanentAddress}
                disabled={form.sameAsPresent}
                onChange={(e) => updateField('permanentAddress', e.target.value)}
                className={`${inputClass(errors.permanentAddress)} disabled:bg-slate-100 disabled:text-slate-500`}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Academic & Professional */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('registration.profession')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.profession}
                  onChange={(e) => updateField('profession', e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: সফটওয়্যার ইঞ্জিনিয়ার, চিকিৎসক, ব্যবসায়ী' : 'e.g. Engineer, Doctor, Business Owner'}
                  className={inputClass(errors.profession)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('registration.currentInstitution')}{' '}
                  {settings.requireInstitution && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  value={form.currentInstitution}
                  onChange={(e) => updateField('currentInstitution', e.target.value)}
                  placeholder={lang === 'bn' ? 'কোম্পানি / বিশ্ববিদ্যালয় / প্রতিষ্ঠান' : 'Company / University / Organization'}
                  className={inputClass(errors.currentInstitution)}
                />
              </div>
            </div>

            {/* Education Qualification Subsection */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#004B76] mb-4">
                {lang === 'bn' ? 'সর্বশেষ শিক্ষাগত যোগ্যতা' : 'Last Education Qualification'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'সর্বশেষ ডিগ্রি / শিক্ষাগত যোগ্যতা' : 'Last Degree / Education Qualification'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.lastDegree}
                    onChange={(e) => updateField('lastDegree', e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: B.Sc in CSE, MBA, MBBS, HSC' : 'e.g. B.Sc in CSE, MBA, MBBS, HSC'}
                    className={inputClass(errors.lastDegree)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'পাসের সাল / অধ্যয়নরত (Running)' : 'Passing Year / Running'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.passingYearOrRunning}
                    onChange={(e) => updateField('passingYearOrRunning', e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: ২০২২ অথবা Running' : 'e.g. 2022 or Running'}
                    className={inputClass(errors.passingYearOrRunning)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'শিক্ষা প্রতিষ্ঠান' : 'Institution'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.educationInstitution}
                    onChange={(e) => updateField('educationInstitution', e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: ঢাকা বিশ্ববিদ্যালয়, বুয়েট' : 'e.g. University of Dhaka, BUET'}
                    className={inputClass(errors.educationInstitution)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'দেশ' : 'Country'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.educationCountry}
                    onChange={(e) => updateField('educationCountry', e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: বাংলাদেশ' : 'e.g. Bangladesh'}
                    className={inputClass(errors.educationCountry)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Subscription Plan & Additional Club Information */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Subscription Plan Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2.5">
                {t('registration.subscriptionPlan')} <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enabledPlans.map((plan) => {
                  const selected = form.planId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        updateField('planId', plan.id);
                        updateField('paymentMode', plan.allowInstallment ? 'installment' : 'full');
                      }}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-navy-900 bg-navy-900/5 ring-2 ring-navy-900/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-navy-900">
                          {lang === 'bn' ? plan.nameBn : plan.nameEn}
                        </span>
                        <span className="font-extrabold text-sm text-gold-600 tabular-nums">
                          {Number(plan.fee) === 0
                            ? lang === 'bn'
                              ? 'ফ্রি'
                              : 'Free'
                            : `৳${Number(plan.fee).toLocaleString()}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {lang === 'bn' ? plan.descriptionBn : plan.descriptionEn}
                      </p>
                      <div className="mt-2">
                        {plan.allowInstallment ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <CalendarClock className="w-3 h-3" />
                            {lang === 'bn' ? 'মাসিক কিস্তি সুবিধা আছে' : 'Installment Available'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {Number(plan.fee) === 0
                              ? lang === 'bn'
                                ? 'সম্পূর্ণ অবৈতনিক'
                                : 'Free of Charge'
                              : lang === 'bn'
                              ? 'এককালীন পরিশোধ'
                              : 'One-Time Full Payment'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Installment Preview Box */}
              {(() => {
                const selectedPlan = plans.find((p) => p.id === form.planId);
                if (!selectedPlan || !selectedPlan.allowInstallment) return null;
                const rule = getBatchRule(form.batch || 2015, settings.batchRules);
                const startMonth = settings.installmentStartMonth || '2027-01';
                const firstInstMonth = addMonthsToYYYYMM(startMonth, 1);

                return (
                  <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 text-white space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gold-400">
                          {lang === 'bn'
                            ? `পেমেন্ট পদ্ধতি (${rule.categoryBn})`
                            : `Payment Mode (${rule.categoryEn})`}
                        </p>
                        <h4 className="font-bold text-sm mt-0.5">
                          {lang === 'bn'
                            ? 'এককালীন অথবা সহজ মাসিক কিস্তি নির্বাচন করুন'
                            : 'Choose Full Payment or Easy Monthly Installments'}
                        </h4>
                      </div>
                      <div className="inline-flex rounded-full bg-white/15 p-1">
                        <button
                          type="button"
                          onClick={() => updateField('paymentMode', 'installment')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                            form.paymentMode === 'installment'
                              ? 'bg-white text-[#004B76]'
                              : 'text-white/90 hover:text-white'
                          }`}
                        >
                          {lang === 'bn' ? 'মাসিক কিস্তি' : 'Installments'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField('paymentMode', 'full')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                            form.paymentMode === 'full'
                              ? 'bg-white text-[#004B76]'
                              : 'text-white/90 hover:text-white'
                          }`}
                        >
                          {lang === 'bn' ? 'এককালীন (৳৫০,০০০)' : `Full (৳${selectedPlan.fee.toLocaleString()})`}
                        </button>
                      </div>
                    </div>

                    {form.paymentMode === 'installment' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                          <p className="text-gold-400 font-semibold">
                            {lang === 'bn'
                              ? `প্রথম মাস (${formatMonthLabel(startMonth, 'bn')})`
                              : `First-Month (${formatMonthLabel(startMonth, 'en')})`}
                          </p>
                          <p className="text-lg font-extrabold mt-0.5 tabular-nums">
                            ৳{Number(rule.firstMonthPayment).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                          <p className="text-gold-400 font-semibold">
                            {lang === 'bn'
                              ? `কিস্তি শুরু (${formatMonthLabel(firstInstMonth, 'bn')})`
                              : `Installments (${formatMonthLabel(firstInstMonth, 'en')}+)`}
                          </p>
                          <p className="font-bold mt-1 leading-snug">
                            {lang === 'bn' ? rule.summaryBn : rule.summaryEn}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                          <p className="text-gold-400 font-semibold">
                            {lang === 'bn' ? 'মোট কিস্তি সংখ্যা' : 'Total Installments'}
                          </p>
                          <p className="text-lg font-extrabold mt-0.5 tabular-nums">
                            {rule.totalInstallments}{' '}
                            <span className="text-xs font-normal text-slate-300">
                              {lang === 'bn' ? 'মাস' : 'months'}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dynamic Custom Fields from Admin Settings */}
            {settings.customFields && settings.customFields.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  {t('registration.customFieldsTitle')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {settings.customFields.map((cf) => (
                    <div key={cf.id}>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {lang === 'bn' ? cf.labelBn || cf.labelEn : cf.labelEn}{' '}
                        {cf.required && <span className="text-rose-500">*</span>}
                      </label>
                      {cf.type === 'select' ? (
                        <select
                          value={form.customValues[cf.id] || ''}
                          onChange={(e) => updateCustomField(cf.id, e.target.value)}
                          className={inputClass(errors[`cf_${cf.id}`])}
                        >
                          <option value="">--</option>
                          {(cf.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={cf.type || 'text'}
                          value={form.customValues[cf.id] || ''}
                          onChange={(e) => updateCustomField(cf.id, e.target.value)}
                          className={inputClass(errors[`cf_${cf.id}`])}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Documents & Photo Verification */}
        {step === 5 && (
          <div className="space-y-6">
            {/* Photo Upload (White Background) */}
            <div
              className={`p-5 rounded-2xl border-2 border-dashed transition-colors ${
                errors.photo ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-28 h-32 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                  {form.photo ? (
                    <img src={form.photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2">
                      <ImageIcon className="w-7 h-7 text-slate-300 mx-auto" />
                      <span className="text-[10px] text-slate-400 block mt-1">White BG</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-navy-900">
                    {t('registration.photo')} <span className="text-rose-500">*</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{t('registration.photoHint')}</p>
                  <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-semibold cursor-pointer hover:bg-navy-800">
                    <Upload className="w-3.5 h-3.5 text-gold-400" />
                    {form.photo ? t('registration.changeFile') : t('registration.uploadClick')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileUpload('photo', e.target.files?.[0], ['image'])}
                    />
                  </label>
                  {form.photoName && (
                    <p className="text-xs text-emerald-700 font-medium mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {form.photoName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* NID PDF or Image Upload */}
            <div
              className={`p-4 sm:p-5 rounded-xl border-2 border-dashed transition-colors ${
                errors.nidPdfName ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-navy-900">
                      {t('registration.nidPdf')} <span className="text-rose-500">*</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t('registration.nidPdfHint')}</p>
                    {form.nidPdfName && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1.5 flex items-center gap-1 break-all">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {form.nidPdfName}
                      </p>
                    )}
                  </div>
                </div>
                <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#004B76] text-[#004B76] text-xs font-semibold cursor-pointer hover:bg-[#EBF4FA] shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  {form.nidPdfName ? t('registration.changeFile') : t('registration.uploadClick')}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload('nidPdf', e.target.files?.[0], ['pdf', 'image'])}
                  />
                </label>
              </div>
            </div>

            {/* SSC Passing Proof Upload */}
            <div
              className={`p-4 sm:p-5 rounded-xl border-2 border-dashed transition-colors ${
                errors.sscProofName ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-navy-900">
                      {t('registration.sscProof')} <span className="text-rose-500">*</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t('registration.sscProofHint')}</p>
                    {form.sscProofName && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1.5 flex items-center gap-1 break-all">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {form.sscProofName}
                      </p>
                    )}
                  </div>
                </div>
                <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#004B76] text-[#004B76] text-xs font-semibold cursor-pointer hover:bg-[#EBF4FA] shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  {form.sscProofName ? t('registration.changeFile') : t('registration.uploadClick')}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload('sscProof', e.target.files?.[0], ['pdf', 'image'])}
                  />
                </label>
              </div>
            </div>

            {/* SMS OTP Verification Card (Skipped in Revision Mode since OTP already verified) */}
            {!isRevisionMode && (
            <div
              className={`p-4 sm:p-6 border transition-colors ${
                otpVerified
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : errors.otp
                  ? 'border-rose-400 bg-rose-50/30'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      otpVerified ? 'bg-emerald-600 text-white' : 'bg-[#EBF4FA] text-[#004B76]'
                    }`}
                  >
                    {otpVerified ? <CheckCircle2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {lang === 'bn'
                        ? 'মোবাইল নম্বর ভেরিফিকেশন (SMS OTP)'
                        : 'Enter your confirmation code'}
                      <span className="text-rose-500"> *</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {otpVerified
                        ? lang === 'bn'
                          ? `আপনার মোবাইল নম্বর (${form.phone}) সফলভাবে যাচাই সম্পন্ন হয়েছে।`
                          : `Your mobile number (${form.phone}) has been verified via SMS.`
                        : lang === 'bn'
                        ? `আবেদন জমা দেওয়ার আগে আপনার নিবন্ধিত মোবাইল নম্বরে (${form.phone}) ৬ ডিজিটের কোড পাঠিয়ে যাচাই করুন।`
                        : `A 6-digit confirmation code will be sent via SMS to ${form.phone}. Please enter the code below to verify your application.`}
                    </p>
                  </div>
                </div>

                {!otpVerified && !otpSent && (
                  <button
                    type="button"
                    disabled={otpSending}
                    onClick={sendOtpCode}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold shrink-0 disabled:opacity-50"
                  >
                    {otpSending
                      ? lang === 'bn'
                        ? 'কোড পাঠানো হচ্ছে...'
                        : 'Sending code...'
                      : lang === 'bn'
                      ? 'SMS কোড পাঠান'
                      : 'Send SMS code'}
                  </button>
                )}
              </div>

              {otpSent && !otpVerified && (
                <div className="mt-5 p-4 sm:p-6 bg-[#F1F4F6] flex flex-col items-center space-y-4">
                  <p className="text-xs font-semibold text-slate-700">
                    {lang === 'bn' ? 'আপনার ৬ ডিজিটের কনফার্মেশন কোড' : 'Your confirmation code'}
                  </p>

                  <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-10 h-11 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono bg-white border border-slate-300 focus:border-[#004B76] focus:ring-2 focus:ring-[#004B76]/20 outline-none rounded-xs text-slate-900"
                      />
                    ))}
                  </div>

                  {otpError && <p className="text-xs font-semibold text-rose-700 text-center">{otpError}</p>}

                  <button
                    type="button"
                    disabled={otpVerifying || otpDigits.join('').length !== 6}
                    onClick={verifyOtpCode}
                    className="w-full max-w-xs py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    {otpVerifying
                      ? lang === 'bn'
                        ? 'যাচাই হচ্ছে...'
                        : 'Verifying...'
                      : lang === 'bn'
                      ? 'কোড যাচাই করুন'
                      : 'Verify code'}
                  </button>

                  <p className="text-xs text-slate-600 text-center">
                    {lang === 'bn' ? 'কোড পাননি?' : "Haven't received a code yet?"}{' '}
                    {resendTimer > 0 ? (
                      <span className="font-mono text-slate-500">
                        {lang === 'bn' ? `${resendTimer} সেকেন্ড পর আবার পাঠান` : `Resend in ${resendTimer}s`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={otpSending}
                        onClick={sendOtpCode}
                        className="font-semibold text-[#004B76] underline underline-offset-4"
                      >
                        {lang === 'bn' ? 'আবার কোড পাঠান' : 'Send code again'}
                      </button>
                    )}
                  </p>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Navigation Footer (Distinct keys prevent accidental submit when advancing to final step) */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <button
            key="btn-prev"
            type="button"
            disabled={step === 1}
            onClick={() => {
              setErrors({});
              setStep((s) => Math.max(1, s - 1));
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('registration.prevStep')}
          </button>

          {step < 5 ? (
            <button
              key="btn-next"
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white font-semibold text-sm shadow-xs"
            >
              {t('registration.nextStep')}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              key="btn-submit"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white font-semibold text-sm shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Submitting...' : t('registration.submitApplication')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
