import React, { useState } from 'react';
import {
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  X,
  CheckCheck,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function MemberApprovals() {
  const { lang, t, members, plans, reviewApplication, showToast } = useApp();
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState('');

  const counts = {
    pending: members.filter((m) => m.status === 'pending').length,
    approved: members.filter((m) => m.status === 'approved').length,
    revision: members.filter((m) => m.status === 'revision').length,
    rejected: members.filter((m) => m.status === 'rejected').length,
  };

  const filtered = members.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        String(m.batch).includes(q) ||
        (m.phone || '').includes(q)
      );
    }
    return true;
  });

  const handleAction = (member, decision) => {
    reviewApplication(member.id, decision, remarks);
    if (decision === 'approved') showToast(t('approvals.approvedToast'), 'success');
    else if (decision === 'rejected') showToast(t('approvals.rejectedToast'), 'error');
    else showToast(t('approvals.revisionToast'), 'info');
    setSelected(null);
    setRemarks('');
  };

  const handleBulkApprove = () => {
    const pendingList = members.filter((m) => m.status === 'pending');
    if (pendingList.length === 0) return;
    pendingList.forEach((m) => reviewApplication(m.id, 'approved', 'Bulk approved by Admin'));
    showToast(
      lang === 'bn'
        ? `${pendingList.length}টি আবেদন একসাথে অনুমোদিত হয়েছে!`
        : `${pendingList.length} pending applications approved!`,
      'success'
    );
  };

  const getPlanName = (planId) => {
    const p = plans.find((x) => x.id === planId);
    if (!p) return '-';
    return lang === 'bn' ? p.nameBn : p.nameEn;
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900">{t('approvals.title')}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{t('approvals.subtitle')}</p>
        </div>
        {counts.pending > 0 && (
          <button
            onClick={handleBulkApprove}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            {lang === 'bn'
              ? `সকল অপেক্ষমাণ অনুমোদন করুন (${counts.pending})`
              : `Approve All Pending (${counts.pending})`}
          </button>
        )}
      </div>

      {/* Filter Tabs + Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'pending', label: t('approvals.pendingCount'), count: counts.pending },
            { id: 'revision', label: t('common.revision'), count: counts.revision },
            { id: 'approved', label: t('approvals.approvedCount'), count: counts.approved },
            { id: 'rejected', label: t('approvals.rejectedCount'), count: counts.rejected },
            { id: 'all', label: t('common.all'), count: members.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-navy-700"
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              {filter === 'pending' ? t('approvals.noPending') : t('common.noData')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-5 py-3.5">SSC Batch</th>
                  <th className="px-5 py-3.5">Plan & Contact</th>
                  <th className="px-5 py-3.5">Documents</th>
                  <th className="px-5 py-3.5">{t('common.status')}</th>
                  <th className="px-5 py-3.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.photo}
                          alt={m.fullName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                        />
                        <div>
                          <p className="font-bold text-navy-900">{m.fullName}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {m.memberId || m.id} · {m.submittedAt}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                        SSC {m.batch}
                      </span>
                      <span className="ml-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-bold">
                        {m.bloodGroup}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-800">{getPlanName(m.planId)}</p>
                      <p className="text-xs text-slate-500">{m.phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          <FileText className="w-3 h-3 text-rose-600" /> NID PDF
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          <FileText className="w-3 h-3 text-blue-600" /> SSC Proof
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : m.status === 'revision'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t(`common.${m.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelected(m);
                          setRemarks(m.remarks || '');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800"
                      >
                        <Eye className="w-3.5 h-3.5 text-gold-400" />
                        {t('approvals.inspect')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-navy-900 text-white px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-base">{t('approvals.applicantDetails')}</h3>
                <p className="text-xs text-gold-400 font-mono">{selected.id}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top Profile Strip */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-slate-100">
                <img
                  src={selected.photo}
                  alt={selected.fullName}
                  className="w-24 h-28 rounded-2xl object-cover border-2 border-slate-200 bg-white shadow-xs shrink-0"
                />
                <div className="space-y-1">
                  <h4 className="text-xl font-extrabold text-navy-900">{selected.fullName}</h4>
                  <p className="text-sm text-slate-600">
                    {selected.profession} · {selected.currentInstitution}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-3 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                      SSC {selected.batch}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold">
                      Blood: {selected.bloodGroup}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">
                      {getPlanName(selected.planId)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  [t('registration.fathersName'), selected.fathersName],
                  [t('registration.mothersName'), selected.mothersName],
                  [t('registration.religion'), selected.religion],
                  [t('registration.dob'), selected.dob],
                  [t('registration.nidNumber'), selected.nidNumber],
                  [t('registration.maritalStatus'), selected.maritalStatus],
                  ...(selected.maritalStatus === 'Married'
                    ? [[t('registration.spouseName'), selected.spouseName]]
                    : []),
                  [t('registration.phone'), selected.phone],
                  [t('registration.secondaryPhone'), selected.secondaryPhone || '—'],
                  [t('registration.email'), selected.email],
                  ['Last Degree / Qualification', selected.lastDegree || '—'],
                  ['Passing Year / Running', selected.passingYearOrRunning || '—'],
                  ['Education Institution', selected.educationInstitution || '—'],
                  ['Country', selected.educationCountry || '—'],
                  [t('registration.presentAddress'), selected.presentAddress],
                  [t('registration.permanentAddress'), selected.permanentAddress],
                ].map(([label, val], idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <p className="font-semibold text-slate-800 mt-0.5 break-words">{val}</p>
                  </div>
                ))}
              </div>

              {/* Verification Documents */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {t('approvals.documentsSection')}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-8 h-8 text-rose-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">NID / Birth Cert PDF</p>
                        <p className="text-[11px] text-slate-500 truncate">{selected.nidPdfName}</p>
                      </div>
                    </div>
                    {selected.nidPdfData && (
                      <a
                        href={selected.nidPdfData}
                        download={selected.nidPdfName}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-8 h-8 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">SSC Passing Proof</p>
                        <p className="text-[11px] text-slate-500 truncate">{selected.sscProofName}</p>
                      </div>
                    </div>
                    {selected.sscProofData && (
                      <a
                        href={selected.sscProofData}
                        download={selected.sscProofName}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Committee Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('approvals.reviewRemarks')}
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={t('approvals.remarksPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-navy-700"
                />
              </div>

              {/* Decision Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleAction(selected, 'rejected')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs"
                >
                  <XCircle className="w-4 h-4" />
                  {t('approvals.rejectApplication')}
                </button>
                <button
                  onClick={() => handleAction(selected, 'revision')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('approvals.requestRevision')}
                </button>
                <button
                  onClick={() => handleAction(selected, 'approved')}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('approvals.approveMember')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
