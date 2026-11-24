import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  BellRing,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';

export default function SmsCenter() {
  const { lang, members, plans, smsLogs, smsSenderId, sendAdminSms, reloadAdmin, showToast } = useApp();
  const [sectionTab, setSectionTab] = useState('notifications'); // 'notifications' | 'dues'

  // Due Reminder State (7th day at 4:00 PM BST + Manual Trigger)
  const [dueMonth, setDueMonth] = useState('2027-01');
  const [duePreview, setDuePreview] = useState({ overdue: [], totalOverdueAmount: 0 });
  const [loadingDue, setLoadingDue] = useState(false);
  const [sendingDue, setSendingDue] = useState(false);

  const fetchDuePreview = async (m = dueMonth) => {
    setLoadingDue(true);
    try {
      const res = await apiRequest(`/api/admin/dues/preview?month=${encodeURIComponent(m)}`);
      setDuePreview(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDue(false);
    }
  };

  useEffect(() => {
    if (sectionTab === 'dues') {
      fetchDuePreview(dueMonth);
    }
  }, [sectionTab, dueMonth]);

  const handleSendDueReminders = async () => {
    setSendingDue(true);
    try {
      const res = await apiRequest('/api/admin/dues/send-reminders', {
        method: 'POST',
        body: JSON.stringify({ month: dueMonth }),
      });
      await reloadAdmin();
      showToast(
        lang === 'bn'
          ? `${res.sentCount}/${res.totalCount} জন বকেয়া সদস্যকে রিমাইন্ডার এসএমএস পাঠানো হয়েছে।`
          : `Due Reminder SMS dispatched to ${res.sentCount}/${res.totalCount} overdue member(s).`,
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingDue(false);
    }
  };

  // Audience mode: 'single' | 'categorized'
  const [audienceMode, setAudienceMode] = useState('categorized');
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [customPhone, setCustomPhone] = useState('');

  // Categorized targeting: 'all' | 'plans' | 'batch' | 'pending'
  const [categoryMode, setCategoryMode] = useState('plans');
  const [selectedPlanIds, setSelectedPlanIds] = useState(['plan-founding', 'plan-permanent', 'plan-associate']);
  const [bulkBatch, setBulkBatch] = useState('');

  // Message Composition Mode: 'manual' | 'meeting_template'
  const [composeMode, setComposeMode] = useState('meeting_template');
  const [manualMessage, setManualMessage] = useState('');

  // Meeting Notice Ready Template fields
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingVenue, setMeetingVenue] = useState('');
  const [meetingPurpose, setMeetingPurpose] = useState('');

  const [sending, setSending] = useState(false);

  const batches = useMemo(
    () => [...new Set(members.map((m) => m.batch).filter(Boolean))].sort(),
    [members]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '___')
    );
  }, [members, search]);

  const togglePlanSelection = (planId) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const targetRecipients = useMemo(() => {
    if (audienceMode === 'single') {
      if (selectedMember) {
        return [{ name: selectedMember.fullName, phone: selectedMember.phone }];
      }
      if (customPhone.trim()) {
        return [{ name: 'Member', phone: customPhone.trim() }];
      }
      return [];
    }

    const approved = members.filter((m) => m.status === 'approved');
    if (categoryMode === 'all') {
      return approved.map((m) => ({ name: m.fullName, phone: m.phone }));
    }
    if (categoryMode === 'pending') {
      return members
        .filter((m) => m.status === 'pending')
        .map((m) => ({ name: m.fullName, phone: m.phone }));
    }
    if (categoryMode === 'batch' && bulkBatch) {
      return approved
        .filter((m) => String(m.batch) === String(bulkBatch))
        .map((m) => ({ name: m.fullName, phone: m.phone }));
    }
    if (categoryMode === 'plans') {
      return approved
        .filter((m) => selectedPlanIds.includes(m.planId))
        .map((m) => ({ name: m.fullName, phone: m.phone }));
    }
    return [];
  }, [audienceMode, selectedMember, customPhone, members, categoryMode, selectedPlanIds, bulkBatch]);

  const formattedMeetingDate = useMemo(() => {
    if (!meetingDate) return '{Date}';
    try {
      const [y, m, d] = meetingDate.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return meetingDate;
    }
  }, [meetingDate]);

  const formattedMeetingTime = useMemo(() => {
    if (!meetingTime) return '{Time}';
    try {
      const [hh, mm] = meetingTime.split(':').map(Number);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
    } catch {
      return meetingTime;
    }
  }, [meetingTime]);

  const builtTemplateMessage = useMemo(() => {
    const addr = meetingVenue.trim() || '{Address}';
    const purposePart = meetingPurpose.trim() ? ` Purpose: ${meetingPurpose.trim()}.` : '';
    return `Meeting Notice – Armanitolians Club\nDear {Name}, You are cordially invited to attend a meeting of Armanitolians Club on ${formattedMeetingDate} at ${formattedMeetingTime}, at ${addr}.${purposePart} Your presence is highly appreciated.`;
  }, [formattedMeetingDate, formattedMeetingTime, meetingVenue, meetingPurpose]);

  const finalMessageToSend = composeMode === 'meeting_template' ? builtTemplateMessage : manualMessage.trim();

  const handleSend = async (e) => {
    e.preventDefault();
    if (targetRecipients.length === 0) {
      showToast(
        lang === 'bn' ? 'কমপক্ষে একজন প্রাপক নির্বাচন করুন।' : 'Please select at least one recipient.',
        'error'
      );
      return;
    }
    if (composeMode === 'meeting_template' && (!meetingDate || !meetingTime || !meetingVenue.trim())) {
      showToast(
        lang === 'bn' ? 'মিটিংয়ের তারিখ, সময় এবং স্থান পূরণ করুন।' : 'Please enter Meeting Date, Time, and Venue.',
        'error'
      );
      return;
    }
    if (!finalMessageToSend) return;

    setSending(true);
    try {
      const res = await sendAdminSms(targetRecipients, finalMessageToSend);
      if (res.ok) {
        showToast(
          lang === 'bn'
            ? `${targetRecipients.length} জন সদস্যকে নোটিফিকেশন এসএমএস পাঠানো হয়েছে।`
            : `Notification SMS dispatched to ${targetRecipients.length} member(s).`,
          'success'
        );
        if (composeMode === 'manual') setManualMessage('');
      } else {
        showToast(`SMS gateway response: ${res.providerResponse}`, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#004B76]">
            {lang === 'bn' ? 'নোটিফিকেশন ও এসএমএস সেন্টার' : 'Send Notifications & SMS Center'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'bn'
              ? 'সদস্য ক্যাটাগরি অনুযায়ী (প্রতিষ্ঠাতা/স্থায়ী/সহযোগী/আজীবন/সকল) ম্যানুয়াল বা রেডি মিটিং টেমপ্লেট এসএমএস পাঠান।'
              : 'Send manual or ready-template Meeting Notice SMS to categorized members (Founder, Associate, Lifetime, Multiple, or All).'}
          </p>
        </div>
        <span className="self-start sm:self-auto px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
          GreenWeb Sender ID: <strong className="font-mono text-[#004B76]">{smsSenderId}</strong>
        </span>
      </div>

      {/* Section Switcher: Notifications vs Due Reminders */}
      <div className="inline-flex rounded-full bg-white border border-slate-200 p-1">
        <button
          type="button"
          onClick={() => setSectionTab('notifications')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            sectionTab === 'notifications' ? 'bg-[#004B76] text-white' : 'text-slate-600'
          }`}
        >
          {lang === 'bn' ? 'নোটিফিকেশন ও মিটিং এসএমএস' : 'Send Notifications & Meetings'}
        </button>
        <button
          type="button"
          onClick={() => setSectionTab('dues')}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            sectionTab === 'dues' ? 'bg-[#004B76] text-white' : 'text-slate-600'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          {lang === 'bn' ? 'বকেয়া রিমাইন্ডার (৭ তারিখ বিকাল ৪টা)' : 'Send Due Reminder (7th · 4 PM)'}
        </button>
      </div>

      {/* DUE REMINDER PANEL */}
      {sectionTab === 'dues' && (
        <div className="bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#EBF4FA] text-[#004B76] text-[11px] font-bold">
                <Clock className="w-3.5 h-3.5" />
                Auto-Scheduled: Every Month 7th Day at 4:00 PM (BST)
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-2">
                {lang === 'bn' ? 'বকেয়া চাঁদা রিমাইন্ডার এসএমএস' : 'Past Dues SMS Reminder'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Channel: <strong>GreenWeb SMS</strong> ·{' '}
                <span className="text-slate-400">WhatsApp channel architecture ready for future activation</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <input
                type="month"
                value={dueMonth}
                onChange={(e) => setDueMonth(e.target.value)}
                className="px-3 py-2 rounded border border-slate-300 text-sm font-semibold"
              />
              <button
                type="button"
                disabled={sendingDue || (duePreview.overdue || []).length === 0}
                onClick={handleSendDueReminders}
                className="px-5 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingDue
                  ? 'Sending...'
                  : `Send Now (${(duePreview.overdue || []).length})`}
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#F1F4F6] border border-slate-200 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#004B76] mb-1">
              Bangla Due Reminder Template
            </p>
            {`প্রিয় সদস্য, আমাদের রেকর্ড অনুযায়ী আপনার মাসিক চাঁদা এখনো বকেয়া রয়েছে। অনুগ্রহ করে বকেয়া পেমেন্টঃ {Amount} টাকা পরিশোধ করুন। উল্লেখ্য, প্রতি মাসের ১০ তারিখের মধ্যে মাসিক পেমেন্ট/ইনস্টলমেন্ট পরিশোধ করার অনুরোধ রইল।\nধন্যবাদান্তে,\nআরমানিটোলিয়ান্স ক্লাব`}
          </div>

          {loadingDue ? (
            <p className="text-xs text-slate-500">Loading overdue members...</p>
          ) : (duePreview.overdue || []).length === 0 ? (
            <p className="text-sm text-emerald-700 font-semibold">
              No overdue members found up to {dueMonth}.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F3F5F7] border-b border-slate-200 text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Club ID</th>
                    <th className="px-4 py-2.5">Member</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5 text-center">Missed</th>
                    <th className="px-4 py-2.5 text-right">Due Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {duePreview.overdue.map((item) => (
                    <tr key={item.memberId}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#004B76]">
                        {item.memberId}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {item.name} (SSC {item.batch})
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{item.phone}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{item.missedCount}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-700 tabular-nums">
                        ৳{Number(item.dueAmount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Compose Card */}
      {sectionTab === 'notifications' && (
      <form onSubmit={handleSend} className="bg-white border border-slate-200 p-5 sm:p-6 space-y-6">
        {/* Step 1: Audience Selection */}
        <div className="space-y-4 pb-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {lang === 'bn' ? '১. প্রাপক নির্বাচন করুন' : '1. Select Recipients'}
            </span>
            <div className="inline-flex rounded-full bg-[#F1F4F6] p-1">
              <button
                type="button"
                onClick={() => setAudienceMode('categorized')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  audienceMode === 'categorized' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'ক্যাটাগরি / গ্রুপ' : 'Categorized / All'}
              </button>
              <button
                type="button"
                onClick={() => setAudienceMode('single')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  audienceMode === 'single' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'একক সদস্য' : 'Single Member'}
              </button>
            </div>
          </div>

          {audienceMode === 'single' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {lang === 'bn' ? 'সদস্য খুঁজুন (আইডি, নাম বা ফোন)' : 'Search Member (Club ID, Name, or Phone)'}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="e.g. AC-2004-0012 or 01711..."
                    className="w-full pl-9 pr-3 py-2.5 rounded border border-slate-300 text-sm"
                  />
                </div>
                {search.trim() && searchResults.length > 0 && (
                  <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {searchResults.slice(0, 6).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMember(m);
                          setCustomPhone(m.phone);
                          setSearch('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#F3F5F7] text-xs flex justify-between"
                      >
                        <span className="font-semibold text-slate-800">{m.fullName}</span>
                        <span className="font-mono text-slate-500">{m.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {lang === 'bn' ? 'প্রাপকের মোবাইল নম্বর' : 'Recipient Phone Number'}
                </label>
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => {
                    setCustomPhone(e.target.value);
                    setSelectedMember(null);
                  }}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm font-mono"
                />
                {selectedMember && (
                  <p className="text-xs text-[#004B76] font-semibold mt-1.5">
                    Selected: {selectedMember.fullName} ({selectedMember.memberId || selectedMember.id})
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'plans', label: lang === 'bn' ? 'সদস্য ধরন (এক বা একাধিক)' : 'By Member Type (Single / Multiple)' },
                  { id: 'all', label: lang === 'bn' ? 'সকল অনুমোদিত সদস্য' : 'All Approved Members' },
                  { id: 'batch', label: lang === 'bn' ? 'নির্দিষ্ট এসএসসি ব্যাচ' : 'Specific SSC Batch' },
                  { id: 'pending', label: lang === 'bn' ? 'অপেক্ষমাণ আবেদনকারী' : 'Pending Applicants' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCategoryMode(opt.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      categoryMode === opt.id
                        ? 'bg-[#EBF4FA] border-[#004B76] text-[#004B76]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {categoryMode === 'plans' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {plans.map((p) => {
                    const checked = selectedPlanIds.includes(p.id);
                    const count = members.filter((m) => m.status === 'approved' && m.planId === p.id).length;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded border cursor-pointer text-xs transition-all ${
                          checked
                            ? 'bg-[#EBF4FA] border-[#004B76] text-[#004B76] font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlanSelection(p.id)}
                            className="rounded text-[#004B76]"
                          />
                          <span className="truncate">{lang === 'bn' ? p.nameBn : p.nameEn}</span>
                        </span>
                        <span className="text-[11px] font-mono opacity-75">({count})</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {categoryMode === 'batch' && (
                <select
                  value={bulkBatch}
                  onChange={(e) => setBulkBatch(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
                >
                  <option value="">Select SSC Batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>
                      SSC {b}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-2 text-xs font-semibold text-[#004B76]">
                <Users className="w-4 h-4" />
                <span>
                  {targetRecipients.length}{' '}
                  {lang === 'bn' ? 'জন সদস্য নির্বাচিত হয়েছে' : 'member(s) matched'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Message Mode (Ready Template vs Manual Typed SMS) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {lang === 'bn' ? '২. বার্তা তৈরি করুন' : '2. Compose Notification'}
            </span>
            <div className="inline-flex rounded-full bg-[#F1F4F6] p-1">
              <button
                type="button"
                onClick={() => setComposeMode('meeting_template')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                  composeMode === 'meeting_template' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'মিটিং নোটিশ টেমপ্লেট' : 'Ready Meeting Template'}
              </button>
              <button
                type="button"
                onClick={() => setComposeMode('manual')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                  composeMode === 'manual' ? 'bg-[#004B76] text-white' : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'ম্যানুয়াল এসএমএস' : 'Manual Typed SMS'}
              </button>
            </div>
          </div>

          {composeMode === 'meeting_template' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'মিটিংয়ের তারিখ' : 'Meeting Date'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'সময়' : 'Time'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'স্থান / ভেন্যু (Venue)' : 'Venue / Address'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={meetingVenue}
                    onChange={(e) => setMeetingVenue(e.target.value)}
                    placeholder="e.g. Armanitolians Club Lounge, Old Dhaka"
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn' ? 'উদ্দেশ্য (ঐচ্ছিক)' : 'Purpose (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={meetingPurpose}
                    onChange={(e) => setMeetingPurpose(e.target.value)}
                    placeholder="e.g. Annual General Meeting / Reunion Planning"
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#F1F4F6] border border-slate-200 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#004B76]">
                  Live SMS Preview ({`{Name}`} auto-replaced per member)
                </p>
                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {builtTemplateMessage}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {lang === 'bn' ? 'এসএমএস বার্তা (ব্যক্তিগত নামের জন্য {Name} ব্যবহার করুন)' : 'SMS Message (use {Name} to personalize per member)'}
              </label>
              <textarea
                rows={4}
                required
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                placeholder="Dear {Name}, ..."
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1 text-right">
                {manualMessage.length} characters
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={sending || targetRecipients.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {sending
              ? lang === 'bn'
                ? 'পাঠানো হচ্ছে...'
                : 'Sending...'
              : lang === 'bn'
              ? `এসএমএস পাঠান (${targetRecipients.length} জন)`
              : `Send Notification SMS (${targetRecipients.length})`}
          </button>
        </div>
      </form>
      )}

      {/* SMS Logs Table */}
      <div className="bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[#004B76]">
            <MessageSquare className="w-4 h-4" />
            <span>{lang === 'bn' ? 'এসএমএস ডেলিভারি লগ' : 'SMS Delivery History'}</span>
          </div>
          <span className="text-xs text-slate-500">{(smsLogs || []).length} records</span>
        </div>

        {(smsLogs || []).length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No SMS records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F5F7] border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {smsLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {log.time}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{log.recipient_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{log.recipient_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-[#EBF4FA] text-[#004B76] font-mono text-[10px] font-semibold">
                        {log.trigger_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-md whitespace-pre-line">{log.message}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                          log.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
