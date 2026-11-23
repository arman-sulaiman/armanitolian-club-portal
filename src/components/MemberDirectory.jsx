import React, { useState } from 'react';
import {
  Search,
  X,
  Download,
  Phone,
  Mail,
  Building2,
  Droplets,
  Pencil,
  Save,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getBatchRule } from '../utils/subscriptionEngine';

export default function MemberDirectory() {
  const { lang, t, members, plans, settings, updateMemberPlan, updateMemberData, sendAdminSms, showToast } =
    useApp();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [editMember, setEditMember] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [smsTarget, setSmsTarget] = useState(null);
  const [smsBody, setSmsBody] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  const handleQuickSms = async (e) => {
    e.preventDefault();
    if (!smsTarget || !smsBody.trim()) return;
    setSendingSms(true);
    try {
      const res = await sendAdminSms(
        [{ name: smsTarget.fullName, phone: smsTarget.phone }],
        smsBody.trim()
      );
      if (res.ok) {
        showToast(lang === 'bn' ? 'এসএমএস পাঠানো হয়েছে।' : 'SMS sent successfully.', 'success');
        setSmsTarget(null);
        setSmsBody('');
      } else {
        showToast(`SMS Error: ${res.providerResponse}`, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingSms(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editMember) return;
    setSavingEdit(true);
    try {
      await updateMemberData(editMember.id, editMember);
      showToast(
        lang === 'bn' ? 'সদস্যের তথ্য সফলভাবে আপডেট হয়েছে!' : 'Member data updated successfully!',
        'success'
      );
      setEditMember(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const batches = [...new Set(approvedMembers.map((m) => m.batch))].sort();

  const filtered = approvedMembers.filter((m) => {
    if (batchFilter && m.batch !== batchFilter) return false;
    if (bloodFilter && m.bloodGroup !== bloodFilter) return false;
    if (planFilter && m.planId !== planFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q) ||
        (m.email || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getPlan = (planId) => plans.find((p) => p.id === planId);

  const exportCsv = () => {
    const headers = [
      'Member ID',
      'Full Name',
      'SSC Batch',
      'Blood Group',
      'Phone',
      'Email',
      'Profession',
      'Institution',
      'Subscription Plan',
      'Renewal Date',
    ];
    const rows = filtered.map((m) => [
      m.memberId,
      `"${m.fullName}"`,
      m.batch,
      m.bloodGroup,
      `"${m.phone}"`,
      m.email,
      `"${m.profession}"`,
      `"${m.currentInstitution}"`,
      `"${getPlan(m.planId)?.nameEn || ''}"`,
      m.renewalDate,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `armanitollian_members_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900">{t('members.title')}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{t('members.subtitle')}</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs shrink-0"
        >
          <Download className="w-4 h-4 text-navy-800" />
          {t('common.exportCsv')} ({filtered.length})
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-navy-700"
          />
        </div>

        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-navy-700"
        >
          <option value="">{t('members.filterBatch')}</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              SSC {b}
            </option>
          ))}
        </select>

        <select
          value={bloodFilter}
          onChange={(e) => setBloodFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-navy-700"
        >
          <option value="">{t('members.filterBlood')}</option>
          {t('options.bloodGroups').map((bg) => (
            <option key={bg} value={bg}>
              {bg}
            </option>
          ))}
        </select>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-navy-700"
        >
          <option value="">{t('members.filterPlan')}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {lang === 'bn' ? p.nameBn : p.nameEn}
            </option>
          ))}
        </select>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((m) => {
          const plan = getPlan(m.planId);
          return (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <img
                    src={m.photo}
                    alt={m.fullName}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-gold-600 bg-gold-100 px-2 py-0.5 rounded-md">
                        {m.memberId}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                        <Droplets className="w-3 h-3" /> {m.bloodGroup}
                      </span>
                    </div>
                    <h3 className="font-bold text-navy-900 text-base truncate mt-1">{m.fullName}</h3>
                    <p className="text-xs text-slate-500">
                      SSC {m.batch} ·{' '}
                      <span className="font-semibold text-navy-800">
                        {lang === 'bn'
                          ? getBatchRule(m.batch, settings.batchRules).groupBn
                          : getBatchRule(m.batch, settings.batchRules).groupEn}
                      </span>{' '}
                      · {m.profession}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{m.currentInstitution}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{m.phone}</span>
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{m.email}</span>
                  </p>
                </div>
              </div>

              {/* Subscription & Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">
                    {t('members.subscription')}
                  </label>
                  <select
                    value={m.planId}
                    onChange={(e) => {
                      updateMemberPlan(m.id, e.target.value);
                      showToast(
                        lang === 'bn' ? 'সাবস্ক্রিপশন প্ল্যান আপডেট হয়েছে!' : 'Subscription plan updated!',
                        'success'
                      );
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-navy-900 focus:outline-none focus:border-navy-700"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {lang === 'bn' ? p.nameBn : p.nameEn} (৳{p.fee})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setEditMember({ ...m })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#004B76] text-[#004B76] text-xs font-semibold hover:bg-[#EBF4FA]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'তথ্য সম্পাদনা' : 'Edit Data'}
                  </button>
                  <button
                    onClick={() => {
                      setSmsTarget(m);
                      setSmsBody('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#004B76] text-white text-xs font-semibold hover:bg-[#003B5C]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'এসএমএস' : 'Send SMS'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QUICK SEND SMS MODAL */}
      {smsTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="bg-[#004B76] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {lang === 'bn' ? 'সদস্যকে এসএমএস পাঠান' : 'Send SMS to Member'}
                </h3>
                <p className="text-xs text-sky-100">
                  {smsTarget.fullName} · {smsTarget.phone}
                </p>
              </div>
              <button onClick={() => setSmsTarget(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickSms} className="p-5 space-y-4">
              <textarea
                rows={4}
                required
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder={lang === 'bn' ? 'বার্তা লিখুন...' : 'Type your SMS message...'}
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSmsTarget(null)}
                  className="px-4 py-2 rounded-full border border-slate-300 text-xs font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sendingSms}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingSms ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT ANY MEMBER DATA MODAL */}
      {editMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-navy-900 text-white px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-base">
                  {lang === 'bn' ? 'সদস্যের তথ্য সম্পাদনা (অ্যাডমিন)' : 'Edit Member Data (Admin)'}
                </h3>
                <p className="text-xs text-gold-400 font-mono">
                  {editMember.memberId || editMember.id}
                </p>
              </div>
              <button onClick={() => setEditMember(null)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  ['fullName', 'Full Name'],
                  ['memberId', 'Official Club Member ID'],
                  ['batch', 'SSC Batch'],
                  ['religion', 'Religion'],
                  ['fathersName', "Father's Name"],
                  ['mothersName', "Mother's Name"],
                  ['dob', 'Date of Birth'],
                  ['bloodGroup', 'Blood Group'],
                  ['nidNumber', 'NID / Birth Cert No.'],
                  ['maritalStatus', 'Marital Status'],
                  ['spouseName', 'Spouse Name'],
                  ['phone', 'Phone Number'],
                  ['secondaryPhone', 'Secondary Phone'],
                  ['email', 'Email Address'],
                  ['profession', 'Profession'],
                  ['currentInstitution', 'Current Institution'],
                  ['lastDegree', 'Last Degree / Qualification'],
                  ['passingYearOrRunning', 'Passing Year / Running'],
                  ['educationInstitution', 'Education Institution'],
                  ['educationCountry', 'Country'],
                  ['presentAddress', 'Present Address'],
                  ['permanentAddress', 'Permanent Address'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={editMember[key] || ''}
                      onChange={(e) => setEditMember({ ...editMember, [key]: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Subscription Plan</label>
                  <select
                    value={editMember.planId}
                    onChange={(e) => setEditMember({ ...editMember, planId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameEn} (৳{p.fee})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Payment Mode</label>
                  <select
                    value={editMember.paymentMode || 'installment'}
                    onChange={(e) => setEditMember({ ...editMember, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="installment">Monthly Installment</option>
                    <option value="full">Full One-Time Payment</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
                >
                  <Save className="w-4 h-4 text-gold-400" />
                  {savingEdit ? 'Saving...' : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
