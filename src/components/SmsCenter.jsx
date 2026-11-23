import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, Users, Search, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SmsCenter() {
  const { lang, members, smsLogs, smsSenderId, sendAdminSms, showToast } = useApp();
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [customPhone, setCustomPhone] = useState('');
  const [bulkGroup, setBulkGroup] = useState('approved'); // 'approved' | 'pending' | 'batch'
  const [bulkBatch, setBulkBatch] = useState('');
  const [message, setMessage] = useState('');
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

  const bulkRecipients = useMemo(() => {
    if (bulkGroup === 'approved') return members.filter((m) => m.status === 'approved');
    if (bulkGroup === 'pending') return members.filter((m) => m.status === 'pending');
    if (bulkGroup === 'batch' && bulkBatch) {
      return members.filter((m) => m.status === 'approved' && String(m.batch) === String(bulkBatch));
    }
    return [];
  }, [members, bulkGroup, bulkBatch]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    let recipients = [];
    if (mode === 'single') {
      if (selectedMember) {
        recipients = [{ name: selectedMember.fullName, phone: selectedMember.phone }];
      } else if (customPhone.trim()) {
        recipients = [{ name: customPhone.trim(), phone: customPhone.trim() }];
      }
    } else {
      recipients = bulkRecipients.map((m) => ({ name: m.fullName, phone: m.phone }));
    }

    if (recipients.length === 0) {
      showToast(
        lang === 'bn' ? 'কমপক্ষে একজন প্রাপক নির্বাচন করুন।' : 'Please select at least one recipient.',
        'error'
      );
      return;
    }

    setSending(true);
    try {
      const res = await sendAdminSms(recipients, message.trim());
      if (res.ok) {
        showToast(
          lang === 'bn'
            ? `${recipients.length} জন সদস্যকে এসএমএস পাঠানো হয়েছে।`
            : `SMS sent to ${recipients.length} recipient(s).`,
          'success'
        );
        setMessage('');
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
            {lang === 'bn' ? 'এসএমএস নোটিফিকেশন সেন্টার' : 'SMS Notification Center'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'bn'
              ? 'সদস্যদের একক বা দলগত এসএমএস পাঠান এবং স্বয়ংক্রিয় এসএমএস লগ পর্যবেক্ষণ করুন।'
              : 'Send individual or bulk SMS notifications via GreenWeb and monitor automated delivery logs.'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
          GreenWeb Sender ID: <strong className="font-mono text-[#004B76]">{smsSenderId}</strong>
        </span>
      </div>

      {/* Compose Card */}
      <form onSubmit={handleSend} className="bg-white rounded-md border border-slate-200 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="inline-flex rounded-full bg-[#F1F4F6] p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === 'single' ? 'bg-[#004B76] text-white' : 'text-slate-600'
              }`}
            >
              {lang === 'bn' ? 'একক সদস্য' : 'Single Member'}
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === 'bulk' ? 'bg-[#004B76] text-white' : 'text-slate-600'
              }`}
            >
              {lang === 'bn' ? 'গ্রুপ / বাল্ক এসএমএস' : 'Bulk SMS'}
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {lang === 'bn'
              ? 'নিবন্ধন, অনুমোদন, সংশোধন ও প্রত্যাখ্যানে স্বয়ংক্রিয় এসএমএস চালু আছে।'
              : 'Auto-SMS is active for Registration, Approval, Revision, and Rejection.'}
          </span>
        </div>

        {mode === 'single' ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {lang === 'bn' ? 'প্রাপক গ্রুপ' : 'Recipient Group'}
              </label>
              <select
                value={bulkGroup}
                onChange={(e) => setBulkGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
              >
                <option value="approved">All Approved Members</option>
                <option value="pending">Pending Applications</option>
                <option value="batch">Specific SSC Batch (Approved)</option>
              </select>
            </div>
            {bulkGroup === 'batch' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  SSC Batch
                </label>
                <select
                  value={bulkBatch}
                  onChange={(e) => setBulkBatch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm bg-white"
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>
                      SSC {b}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold text-[#004B76]">
              <Users className="w-4 h-4" />
              <span>{bulkRecipients.length} recipient(s) matched</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'এসএমএস বার্তা' : 'Message Content'}
          </label>
          <textarea
            rows={3}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'সদস্যদের উদ্দেশ্যে আপনার বার্তা লিখুন...'
                : 'Write your official Armanitollian Club SMS message...'
            }
            className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
          />
          <p className="text-[11px] text-slate-400 mt-1 text-right">{message.length} characters</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending
              ? lang === 'bn'
                ? 'পাঠানো হচ্ছে...'
                : 'Sending...'
              : lang === 'bn'
              ? 'এসএমএস পাঠান'
              : 'Send SMS Now'}
          </button>
        </div>
      </form>

      {/* SMS Logs Table */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
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
                    <td className="px-4 py-3 text-slate-700 max-w-md">{log.message}</td>
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
