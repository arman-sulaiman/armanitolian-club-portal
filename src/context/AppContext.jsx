import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { initialPlans, initialSettings } from '../data/seedData';
import { apiRequest, getAdminToken, setAdminToken } from '../utils/api';

const LANG_KEY = 'armanitollian_lang';
const AppContext = createContext(null);

function parseHashRoute() {
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  const [route] = hash.split('?');
  if (route === 'admin') return 'admin';
  if (route === 'register') return 'register';
  if (route === 'portal') return 'portal';
  return 'home';
}

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'en');
  const [route, setRouteState] = useState(parseHashRoute);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [adminUser, setAdminUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState(initialPlans.map((p) => ({ ...p, enabled: true })));
  const [settings, setSettings] = useState(initialSettings);
  const [auditLogs, setAuditLogs] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsSenderId, setSmsSenderId] = useState('8809617621831');
  const [shurjopayMode, setShurjopayMode] = useState('sandbox');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const setRoute = (nextRoute) => {
    setRouteState(nextRoute);
    window.location.hash = nextRoute === 'home' ? '' : `#${nextRoute}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHashChange = () => setRouteState(parseHashRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.body.classList.toggle('lang-bn', lang === 'bn');
    document.documentElement.lang = lang;
  }, [lang]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev && Date.now() - prev.id >= 3400 ? null : prev));
    }, 3600);
  }, []);

  const loadPublicBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest('/api/public/bootstrap');
      if (data.settings) setSettings(data.settings);
      if (data.plans) setPlans(data.plans);
      if (data.shurjopayMode) setShurjopayMode(data.shurjopayMode);
    } catch {
      // keep defaults if server starting
    }
  }, []);

  const loadAdminBootstrap = useCallback(async () => {
    const data = await apiRequest('/api/admin/bootstrap');
    setMembers(data.members || []);
    setPayments(data.payments || []);
    setPlans(data.plans || []);
    setSettings(data.settings || initialSettings);
    setAuditLogs(data.auditLogs || []);
    setSmsLogs(data.smsLogs || []);
    if (data.shurjopayMode) setShurjopayMode(data.shurjopayMode);
    if (data.smsSenderId) setSmsSenderId(data.smsSenderId);
  }, []);

  useEffect(() => {
    (async () => {
      await loadPublicBootstrap();
      const token = getAdminToken();
      if (token) {
        try {
          const me = await apiRequest('/api/auth/me');
          setAdminUser(me.admin);
          await loadAdminBootstrap();
        } catch {
          setAdminToken('');
          setAdminUser(null);
        }
      }
      setAuthChecked(true);
      setLoading(false);
    })();
  }, [loadPublicBootstrap, loadAdminBootstrap]);

  const t = (path) => {
    const keys = path.split('.');
    let cur = translations[lang] || translations.en;
    for (const k of keys) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, k)) {
        cur = cur[k];
      } else {
        return path;
      }
    }
    return cur;
  };

  // --- Auth Actions ---
  const loginAdmin = async (username, password) => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAdminToken(res.token);
    setAdminUser(res.admin);
    await loadAdminBootstrap();
    return res.admin;
  };

  const logoutAdmin = () => {
    setAdminToken('');
    setAdminUser(null);
    setMembers([]);
    setPayments([]);
    setAuditLogs([]);
    setRoute('home');
    showToast(lang === 'bn' ? 'অ্যাডমিন লগআউট সম্পন্ন' : 'Signed out of Admin Portal', 'info');
  };

  // --- Public Registration ---
  const submitRegistration = async (formData) => {
    const res = await apiRequest('/api/public/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    if (adminUser) {
      await loadAdminBootstrap();
    }
    return res.member;
  };

  // --- Admin Actions ---
  const reviewApplication = async (id, decision, remarks = '') => {
    await apiRequest(`/api/admin/members/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, remarks }),
    });
    await loadAdminBootstrap();
  };

  const updateMemberData = async (id, updates) => {
    const res = await apiRequest(`/api/admin/members/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    await loadAdminBootstrap();
    return res.member;
  };

  const updateMemberPlan = async (id, planId) => {
    const plan = plans.find((p) => p.id === planId);
    await updateMemberData(id, {
      planId,
      paymentMode: plan?.allowInstallment ? 'installment' : 'full',
      renewalDate: plan && !plan.allowInstallment ? 'Lifetime' : 'Jan 2030',
    });
  };

  const addPayment = async (paymentData) => {
    const res = await apiRequest('/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    await loadAdminBootstrap();
    return res.payment;
  };

  const verifyPayment = async (paymentId) => {
    await apiRequest(`/api/admin/payments/${encodeURIComponent(paymentId)}/verify`, {
      method: 'POST',
    });
    await loadAdminBootstrap();
  };

  const savePlansToDb = async (nextPlans) => {
    setPlans(nextPlans);
    await apiRequest('/api/admin/plans', {
      method: 'PUT',
      body: JSON.stringify({ plans: nextPlans }),
    });
    await loadAdminBootstrap();
  };

  const saveSettingsToDb = async (nextSettings) => {
    setSettings(nextSettings);
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: nextSettings }),
    });
    await loadAdminBootstrap();
  };

  const sendAdminSms = async (recipients, message) => {
    const res = await apiRequest('/api/admin/sms/send', {
      method: 'POST',
      body: JSON.stringify({ recipients, message }),
    });
    if (res.smsLogs) setSmsLogs(res.smsLogs);
    await loadAdminBootstrap();
    return res;
  };

  const resetDemoData = async () => {
    await apiRequest('/api/admin/reset-demo', { method: 'POST' });
    await loadAdminBootstrap();
    showToast(lang === 'bn' ? 'ডাটাবেস ডেমো অবস্থায় রিসেট হয়েছে!' : 'Database restored to demo data!', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        t,
        route,
        setRoute,
        activeTab,
        setActiveTab,
        adminUser,
        authChecked,
        loading,
        shurjopayMode,
        members,
        payments,
        plans,
        setPlans: savePlansToDb,
        settings,
        setSettings: saveSettingsToDb,
        auditLogs,
        smsLogs,
        smsSenderId,
        sendAdminSms,
        toast,
        showToast,
        loginAdmin,
        logoutAdmin,
        submitRegistration,
        reviewApplication,
        updateMemberData,
        updateMemberPlan,
        addPayment,
        verifyPayment,
        resetDemoData,
        reloadAdmin: loadAdminBootstrap,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
