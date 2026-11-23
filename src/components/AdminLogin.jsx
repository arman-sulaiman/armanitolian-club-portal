import React, { useState } from 'react';
import { Award, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AdminLogin() {
  const { lang, settings, loginAdmin, setRoute, showToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(username, password);
      showToast(
        lang === 'bn' ? 'অ্যাডমিন পোর্টালে লগইন সফল হয়েছে।' : 'Signed in to Administration Portal.',
        'success'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F7] flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between">
        <button onClick={() => setRoute('home')} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#004B76] text-white flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-slate-900">
            {lang === 'bn' ? settings.clubNameBn : settings.clubNameEn}
          </span>
        </button>
        <button
          onClick={() => setRoute('home')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004B76] underline underline-offset-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {lang === 'bn' ? 'পোর্টালে ফিরে যান' : 'Back to Member Portal'}
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'bn' ? 'অ্যাডমিন সাইন ইন' : 'Administrator Sign In'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {lang === 'bn'
                ? 'ক্লাব ব্যবস্থাপনা পোর্টালে প্রবেশ করতে আপনার ইউজারনেম ও পাসওয়ার্ড দিন।'
                : 'Enter your authorized administrator credentials to access the management portal.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-[#F1F4F6] space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'ইউজারনেম' : 'Username'}
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#004B76]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#004B76]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border-l-4 border-rose-600 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-[#004B76] hover:bg-[#003B5C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4" />
              {loading
                ? lang === 'bn'
                  ? 'যাচাই হচ্ছে...'
                  : 'Signing in...'
                : lang === 'bn'
                ? 'লগইন করুন'
                : 'CONTINUE'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
