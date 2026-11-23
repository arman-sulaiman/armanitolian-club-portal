import React, { useState } from 'react';
import {
  Building2,
  CreditCard,
  Sliders,
  Wallet,
  Database,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Download,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';

export default function SettingsPanel() {
  const {
    lang,
    t,
    settings,
    setSettings,
    plans,
    setPlans,
    members,
    payments,
    shurjopayMode,
    showToast,
    resetDemoData,
  } = useApp();
  const [tab, setTab] = useState('profile');
  const [draft, setDraft] = useState(settings);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwForm),
      });
      setPwForm({ currentPassword: '', newPassword: '' });
      showToast(
        lang === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!' : 'Admin password updated successfully!',
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const [newPlan, setNewPlan] = useState({
    nameEn: '',
    nameBn: '',
    fee: 500,
    cycle: 'Monthly',
    descriptionEn: '',
    descriptionBn: '',
  });

  const [newField, setNewField] = useState({
    labelEn: '',
    labelBn: '',
    type: 'text',
    optionsText: '',
    required: false,
  });

  const saveSettings = () => {
    setSettings(draft);
    showToast(t('settings.savedToast'), 'success');
  };

  const handleAddPlan = (e) => {
    e.preventDefault();
    if (!newPlan.nameEn.trim()) return;
    const plan = {
      id: `plan-${Date.now()}`,
      ...newPlan,
      nameBn: newPlan.nameBn || newPlan.nameEn,
      fee: Number(newPlan.fee),
      badgeColor: 'bg-slate-100 text-slate-800',
    };
    setPlans((prev) => [...prev, plan]);
    setNewPlan({ nameEn: '', nameBn: '', fee: 500, cycle: 'Monthly', descriptionEn: '', descriptionBn: '' });
    showToast(t('settings.savedToast'), 'success');
  };

  const handleAddCustomField = (e) => {
    e.preventDefault();
    if (!newField.labelEn.trim()) return;
    const cf = {
      id: `cf-${Date.now()}`,
      labelEn: newField.labelEn.trim(),
      labelBn: newField.labelBn.trim() || newField.labelEn.trim(),
      type: newField.type,
      options:
        newField.type === 'select'
          ? newField.optionsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      required: newField.required,
    };
    const updated = { ...draft, customFields: [...(draft.customFields || []), cf] };
    setDraft(updated);
    setSettings(updated);
    setNewField({ labelEn: '', labelBn: '', type: 'text', optionsText: '', required: false });
    showToast(t('settings.savedToast'), 'success');
  };

  const removeCustomField = (id) => {
    const updated = {
      ...draft,
      customFields: (draft.customFields || []).filter((f) => f.id !== id),
    };
    setDraft(updated);
    setSettings(updated);
  };

  const exportJsonBackup = () => {
    const payload = { exportedAt: new Date().toISOString(), settings, plans, members, payments };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `armanitollian_club_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'profile', label: t('settings.tabProfile'), icon: Building2 },
    { id: 'plans', label: t('settings.tabPlans'), icon: CreditCard },
    { id: 'dynamicForm', label: t('settings.tabDynamicForm'), icon: Sliders },
    { id: 'payments', label: t('settings.tabPayments'), icon: Wallet },
    { id: 'data', label: t('settings.tabData'), icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900">{t('settings.title')}</h1>
        <p className="text-sm text-slate-600 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                active
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-gold-400' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Club Profile */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.clubNameEn')}
              </label>
              <input
                type="text"
                value={draft.clubNameEn}
                onChange={(e) => setDraft({ ...draft, clubNameEn: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.clubNameBn')}
              </label>
              <input
                type="text"
                value={draft.clubNameBn}
                onChange={(e) => setDraft({ ...draft, clubNameBn: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.mottoEn')}
              </label>
              <input
                type="text"
                value={draft.mottoEn}
                onChange={(e) => setDraft({ ...draft, mottoEn: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.mottoBn')}
              </label>
              <input
                type="text"
                value={draft.mottoBn}
                onChange={(e) => setDraft({ ...draft, mottoBn: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.contactEmail')}
              </label>
              <input
                type="email"
                value={draft.contactEmail}
                onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.contactPhone')}
              </label>
              <input
                type="text"
                value={draft.contactPhone}
                onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {lang === 'bn' ? 'ওয়েবপেজ ঠিকানা' : 'Webpage Address'}
              </label>
              <input
                type="text"
                value={draft.clubWebpage || ''}
                onChange={(e) => setDraft({ ...draft, clubWebpage: e.target.value })}
                placeholder="armanitolianclub.org"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.clubAddress')}
              </label>
              <input
                type="text"
                value={draft.clubAddress}
                onChange={(e) => setDraft({ ...draft, clubAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
          >
            <Save className="w-4 h-4 text-gold-400" />
            {t('common.save')}
          </button>
        </div>
      )}

      {/* TAB 2: Subscription Plans & Installment Controls */}
      {tab === 'plans' && (
        <div className="space-y-6 max-w-5xl">
          {/* Installment Start Month Config */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h4 className="font-bold text-navy-900 text-sm">
                {lang === 'bn'
                  ? 'কিস্তি ও প্রথম মাসের পেমেন্ট শুরুর তারিখ'
                  : 'First-Month Payment & Installment Start Month'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'bn'
                  ? 'এই মাসটি "প্রথম মাসের পেমেন্ট" হিসেবে গণ্য হবে এবং পরবর্তী মাস থেকে কিস্তি #১ শুরু হবে।'
                  : 'This month is counted as the First-Month Payment; Installment #1 begins the following month.'}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <input
                type="month"
                value={draft.installmentStartMonth || '2027-01'}
                onChange={(e) => {
                  const updated = { ...draft, installmentStartMonth: e.target.value };
                  setDraft(updated);
                  setSettings(updated);
                  showToast(t('settings.savedToast'), 'success');
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-navy-900"
              />
            </div>
          </div>

          {/* 7 Membership Types with Admin Installment Toggle & Fee Editor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h4 className="font-bold text-navy-900 text-sm">
                {lang === 'bn'
                  ? 'সদস্যপদের ধরন, ফি এবং কিস্তি অনুমতি (অ্যাডমিন নিয়ন্ত্রণ)'
                  : 'Membership Types, Fees & Installment Eligibility (Admin Control)'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'bn'
                  ? 'ডিফল্টভাবে শুধুমাত্র প্রতিষ্ঠাতা, স্থায়ী এবং সহযোগী সদস্যদের জন্য কিস্তি চালু আছে। অ্যাডমিন যেকোনো সময় পরিবর্তন করতে পারবেন।'
                  : 'By default, installments are enabled only for Founding, Permanent, and Associate members. Toggle any plan below.'}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-navy-900 text-sm">
                      {lang === 'bn' ? p.nameBn : p.nameEn}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'bn' ? p.descriptionBn : p.descriptionEn}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">BDT</span>
                      <input
                        type="number"
                        min="0"
                        value={p.fee}
                        onChange={(e) => {
                          const fee = Number(e.target.value);
                          setPlans(
                            plans.map((x) => (x.id === p.id ? { ...x, fee } : x))
                          );
                        }}
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-navy-900 tabular-nums"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                      <input
                        type="checkbox"
                        checked={p.enabled !== false}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setPlans(
                            plans.map((x) => (x.id === p.id ? { ...x, enabled } : x))
                          );
                          showToast(t('settings.savedToast'), 'success');
                        }}
                        className="rounded text-emerald-600"
                      />
                      <span
                        className={`text-xs font-bold ${
                          p.enabled !== false ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {p.enabled !== false
                          ? lang === 'bn'
                            ? 'সক্রিয়'
                            : 'Enabled'
                          : lang === 'bn'
                          ? 'নিষ্ক্রিয়'
                          : 'Disabled'}
                      </span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(p.allowInstallment)}
                        disabled={Number(p.fee) === 0}
                        onChange={(e) => {
                          const allowInstallment = e.target.checked;
                          setPlans(
                            plans.map((x) =>
                              x.id === p.id ? { ...x, allowInstallment } : x
                            )
                          );
                          showToast(t('settings.savedToast'), 'success');
                        }}
                        className="rounded text-navy-900"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {lang === 'bn' ? 'কিস্তি চালু' : 'Allow Installments'}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dynamic Form Builder */}
      {tab === 'dynamicForm' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <p className="text-sm text-slate-600">{t('settings.dynamicFormDesc')}</p>

            {/* Built-in Dynamic Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">
                  {t('registration.secondaryPhone')} ({t('common.required')})
                </span>
                <input
                  type="checkbox"
                  checked={draft.requireSecondaryPhone}
                  onChange={(e) => {
                    const updated = { ...draft, requireSecondaryPhone: e.target.checked };
                    setDraft(updated);
                    setSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-navy-900"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">
                  {t('registration.currentInstitution')} ({t('common.required')})
                </span>
                <input
                  type="checkbox"
                  checked={draft.requireInstitution}
                  onChange={(e) => {
                    const updated = { ...draft, requireInstitution: e.target.checked };
                    setDraft(updated);
                    setSettings(updated);
                  }}
                  className="w-4 h-4 rounded text-navy-900"
                />
              </label>
            </div>

            {/* Active Custom Fields */}
            <div className="pt-3 space-y-2.5">
              {(draft.customFields || []).map((cf) => (
                <div
                  key={cf.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div>
                    <p className="text-sm font-bold text-navy-900">
                      {cf.labelEn} / {cf.labelBn}
                    </p>
                    <p className="text-xs text-slate-500">
                      Type: <span className="font-mono">{cf.type}</span> ·{' '}
                      {cf.required ? t('common.required') : t('common.optional')}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCustomField(cf.id)}
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Custom Dynamic Field */}
          <form
            onSubmit={handleAddCustomField}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <h4 className="font-bold text-navy-900 text-sm">{t('settings.addCustomField')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                required
                placeholder={t('settings.fieldLabelEn')}
                value={newField.labelEn}
                onChange={(e) => setNewField({ ...newField, labelEn: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                placeholder={t('settings.fieldLabelBn')}
                value={newField.labelBn}
                onChange={(e) => setNewField({ ...newField, labelBn: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <select
                value={newField.type}
                onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="text">Text Input</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Dropdown Select</option>
              </select>
              {newField.type === 'select' && (
                <input
                  type="text"
                  placeholder="Options comma-separated (e.g. S, M, L, XL)"
                  value={newField.optionsText}
                  onChange={(e) => setNewField({ ...newField, optionsText: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={newField.required}
                onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              />
              {t('settings.fieldRequired')}
            </label>
            <div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
              >
                <Plus className="w-4 h-4 text-gold-400" />
                {t('settings.addCustomField')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Payment Gateways & Billing Rules */}
      {tab === 'payments' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                ShurjoPay Online Gateway · Mode: {shurjopayMode?.toUpperCase()}
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                {lang === 'bn'
                  ? 'লাইভ পেমেন্ট চালু করতে .env ফাইলে SHURJOPAY_MODE=live এবং আপনার লাইভ ক্রেডেনশিয়াল সেট করুন।'
                  : 'To switch to Live in production, update SHURJOPAY_MODE=live and your live credentials in .env.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.bkashNumber')}
              </label>
              <input
                type="text"
                value={draft.bkashNumber}
                onChange={(e) => setDraft({ ...draft, bkashNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.nagadNumber')}
              </label>
              <input
                type="text"
                value={draft.nagadNumber}
                onChange={(e) => setDraft({ ...draft, nagadNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.bankDetails')}
              </label>
              <input
                type="text"
                value={draft.bankDetails}
                onChange={(e) => setDraft({ ...draft, bankDetails: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.monthlyDueDay')}
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={draft.monthlyDueDay}
                onChange={(e) => setDraft({ ...draft, monthlyDueDay: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('settings.lateFee')}
              </label>
              <input
                type="number"
                min="0"
                value={draft.lateFee}
                onChange={(e) => setDraft({ ...draft, lateFee: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 pt-2">
            <input
              type="checkbox"
              checked={draft.autoApproveCash}
              onChange={(e) => setDraft({ ...draft, autoApproveCash: e.target.checked })}
            />
            {t('settings.autoApproveVerified')}
          </label>

          <button
            onClick={saveSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
          >
            <Save className="w-4 h-4 text-gold-400" />
            {t('common.save')}
          </button>
        </div>
      )}

      {/* TAB 5: Data, Backup & Admin Security */}
      {tab === 'data' && (
        <div className="space-y-6 max-w-2xl">
          <form
            onSubmit={handleChangePassword}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-gold-600" />
              {lang === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন' : 'Change Admin Password'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="password"
                required
                placeholder={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড (সর্বনিম্ন ৬ অক্ষর)' : 'New Password (min 6 chars)'}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
            >
              <Lock className="w-3.5 h-3.5 text-gold-400" />
              {pwSaving ? 'Updating...' : lang === 'bn' ? 'পাসওয়ার্ড আপডেট করুন' : 'Update Password'}
            </button>
          </form>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="font-bold text-navy-900 text-sm">
              {lang === 'bn' ? 'ডাটাবেস ব্যাকআপ ও রিসেট' : 'Database Backup & Reset'}
            </h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportJsonBackup}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
              >
                <Download className="w-4 h-4 text-gold-400" />
                {t('common.exportJson')}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('settings.resetConfirm'))) resetDemoData();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold"
              >
                <RotateCcw className="w-4 h-4" />
                {t('common.resetDemo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
