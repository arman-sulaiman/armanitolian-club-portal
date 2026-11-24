import React, { useState } from 'react';
import { Megaphone, Upload, Trash2, FileText, Image as ImageIcon, Calendar, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function NoticeManager() {
  const { lang, notices, publishNotice, deleteNotice, showToast } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('');
  const [attachmentData, setAttachmentData] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentName(file.name);
      setAttachmentType(file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'));
      setAttachmentData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await publishNotice({
        date,
        title: title.trim(),
        description: description.trim(),
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
        attachmentData: attachmentData || null,
      });
      setTitle('');
      setDescription('');
      setAttachmentName('');
      setAttachmentType('');
      setAttachmentData(null);
      showToast(
        lang === 'bn' ? 'নোটিশ সফলভাবে প্রকাশিত হয়েছে!' : 'Notice published to Public Portal!',
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#004B76]">
          {lang === 'bn' ? 'নোটিশ ও প্রেস রিলিজ প্রকাশনা' : 'Notices & Press Releases'}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {lang === 'bn'
            ? 'পাবলিক পোর্টালে সদস্যদের জন্য নতুন নোটিশ, প্রেস রিলিজ ও পিডিএফ/ছবি প্রকাশ করুন।'
            : 'Release official notices and press releases with optional PDF or Image attachments directly to the Public Portal.'}
        </p>
      </div>

      {/* Publish Form */}
      <form onSubmit={handlePublish} className="bg-white border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {lang === 'bn' ? 'তারিখ' : 'Notice Date'}
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {lang === 'bn' ? 'নোটিশের শিরোনাম' : 'Notice Title'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: বার্ষিক সাধারণ সভার বিজ্ঞপ্তি' : 'e.g. Annual General Meeting Notice & Press Release'}
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {lang === 'bn' ? 'বিস্তারিত বিবরণ' : 'Description'} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={lang === 'bn' ? 'নোটিশের বিস্তারিত বিবরণ লিখুন...' : 'Write the full notice or press release content...'}
            className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-sm"
          />
        </div>

        {/* Optional PDF / Image Upload */}
        <div className="p-4 bg-[#F3F5F7] border border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {lang === 'bn' ? 'সংযুক্তি (PDF বা ছবি — ঐচ্ছিক)' : 'Attachment (PDF or Image — Optional)'}
            </p>
            {attachmentName && (
              <p className="text-emerald-700 font-semibold mt-1 flex items-center gap-1 break-all">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {attachmentName}
              </p>
            )}
          </div>
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white border border-[#004B76] text-[#004B76] hover:bg-[#EBF4FA] text-xs font-semibold cursor-pointer shrink-0">
            <Upload className="w-3.5 h-3.5" />
            {attachmentName ? 'Change File' : 'Upload PDF / Image'}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,.pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Megaphone className="w-3.5 h-3.5" />
            {saving
              ? 'Publishing...'
              : lang === 'bn'
              ? 'পাবলিক পোর্টালে প্রকাশ করুন'
              : 'Publish Notice'}
          </button>
        </div>
      </form>

      {/* Published Notices List */}
      <div className="bg-white border border-slate-200 divide-y divide-slate-100">
        <div className="px-5 py-3.5 bg-[#F3F5F7] font-bold text-xs uppercase tracking-wider text-slate-600">
          {lang === 'bn' ? 'প্রকাশিত নোটিশসমূহ' : 'Published Notices'} ({(notices || []).length})
        </div>
        {(notices || []).map((n) => (
          <div key={n.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-[#004B76]" />
                <span className="font-mono font-semibold">{n.date}</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">{n.title}</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {n.description}
              </p>
              {n.attachment_name && (
                <p className="text-xs font-semibold text-[#004B76] inline-flex items-center gap-1 pt-1">
                  {String(n.attachment_type || '').includes('pdf') ? (
                    <FileText className="w-3.5 h-3.5" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  {n.attachment_name}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (window.confirm('Delete this notice?')) deleteNotice(n.id);
              }}
              className="self-start p-2 rounded text-rose-600 hover:bg-rose-50 shrink-0"
              title="Delete notice"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
