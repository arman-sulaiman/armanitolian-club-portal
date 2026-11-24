import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  isPostgres,
  ensureDbReady,
  verifyPassword,
  hashPassword,
  normalizePhone,
  getAdminByUsername,
  updateAdminPassword,
  getPlans,
  savePlans,
  getSettings,
  saveSettings,
  getAllMembers,
  upsertMember,
  getAllPayments,
  upsertPayment,
  createPaymentOrder,
  updatePaymentOrderSpId,
  getPaymentOrder,
  updatePaymentOrderStatus,
  saveOtp,
  getOtp,
  incrementOtpAttempts,
  markOtpVerified,
  addAuditLog,
  getAuditLogs,
  addSmsLog,
  getSmsLogs,
  verifyReportAccessCode,
  getAllNotices,
  insertNotice,
  deleteNoticeById,
  seedIfEmpty,
} from './db.js';
import { initiateShurjoPayCheckout, verifyShurjoPayOrder } from './shurjopay.js';
import { sendGreenWebSms } from './sms.js';
import {
  generateMemberSchedule,
  getBatchRule,
  formatMonthLabel,
} from '../src/utils/subscriptionEngine.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const AUTH_SECRET = process.env.AUTH_SECRET || 'armanitollian-club-secret';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure DB schema & seed are initialized before handling any API request
app.use('/api', async (_req, res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database initialization failed: ' + err.message });
  }
});

function getBaseUrls(req) {
  const proto = req?.headers?.['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http');
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const derived = host ? `${proto}://${host}` : '';
  const appUrl = (
    process.env.APP_BASE_URL ||
    derived ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')
  ).replace(/\/$/, '');
  const apiUrl = (
    process.env.API_BASE_URL ||
    derived ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`)
  ).replace(/\/$/, '');
  return { appUrl, apiUrl };
}

async function dispatchSms({ to, recipientName, message, triggerType }) {
  const result = await sendGreenWebSms({ to, message });
  await addSmsLog({
    recipientName: recipientName || '',
    recipientPhone: result.recipients.join(', ') || String(to || ''),
    triggerType,
    message,
    status: result.ok ? 'sent' : 'failed',
    providerResponse: result.providerResponse,
  });
  return result;
}

// --- HMAC-SHA256 Signed Auth Token ---
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = String(token || '').split('.');
    if (!header || !body || !sig) return null;
    const expected = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Admin login required' });
  }
  req.admin = decoded;
  next();
}

// ==========================================
// PUBLIC ENDPOINTS (No Login Required)
// ==========================================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: isPostgres ? 'postgresql' : 'sqlite',
    shurjopayMode: (process.env.SHURJOPAY_MODE || 'sandbox').toLowerCase(),
  });
});

app.get('/api/public/bootstrap', async (_req, res) => {
  const [settings, plans, notices] = await Promise.all([
    getSettings(),
    getPlans(),
    getAllNotices(),
  ]);
  res.json({
    settings,
    plans,
    notices,
    shurjopayMode: (process.env.SHURJOPAY_MODE || 'sandbox').toLowerCase(),
  });
});

app.get('/api/public/notices', async (_req, res) => {
  res.json({ notices: await getAllNotices() });
});

// Public: Membership Fee Progress Report — Send OTP
app.post('/api/public/progress-report/send-otp', async (req, res) => {
  const clubId = String(req.body?.clubId || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!clubId || !phone) {
    return res.status(400).json({ error: 'Both Membership ID and Phone Number are required.' });
  }
  const normPhone = normalizePhone(phone);
  const members = await getAllMembers();
  const member = members.find(
    (m) =>
      m.status === 'approved' &&
      m.memberId &&
      m.memberId.toLowerCase() === clubId.toLowerCase() &&
      normalizePhone(m.phone) === normPhone
  );
  if (!member) {
    return res.status(404).json({
      error: 'No approved member found matching both Membership ID and Phone Number.',
    });
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await saveOtp(normPhone, code, Date.now() + 5 * 60 * 1000);

  const smsResult = await dispatchSms({
    to: member.phone,
    recipientName: member.fullName,
    triggerType: 'AUTO_PROGRESS_REPORT_OTP',
    message: `Your Armanitolians Club Fee Progress Report OTP is ${code}. Valid for 5 minutes.`,
  });

  const maskedPhone =
    member.phone.length >= 6 ? `${member.phone.slice(0, 4)}****${member.phone.slice(-3)}` : member.phone;
  res.json({ ok: true, maskedPhone, smsDelivered: smsResult.ok });
});

// Public: Membership Fee Progress Report — Verify OTP & Return Report
app.post('/api/public/progress-report/verify-otp', async (req, res) => {
  const clubId = String(req.body?.clubId || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();

  const normPhone = normalizePhone(phone);
  const members = await getAllMembers();
  const member = members.find(
    (m) =>
      m.status === 'approved' &&
      m.memberId &&
      m.memberId.toLowerCase() === clubId.toLowerCase() &&
      normalizePhone(m.phone) === normPhone
  );
  if (!member) {
    return res.status(404).json({ error: 'Approved member verification failed.' });
  }

  const row = await getOtp(normPhone);
  if (!row || Date.now() > Number(row.expires_at)) {
    return res.status(400).json({ error: 'OTP expired or missing. Please request a new code.' });
  }
  if (Number(row.attempts) >= 5) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (row.code !== code) {
    await incrementOtpAttempts(normPhone);
    return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
  }

  await markOtpVerified(normPhone);

  const [settings, plans, allPayments] = await Promise.all([
    getSettings(),
    getPlans(),
    getAllPayments(),
  ]);
  const plan = plans.find((p) => p.id === member.planId);
  const schedule = generateMemberSchedule(member, plan, settings);
  const verifiedPayments = allPayments
    .filter((p) => p.memberId === member.memberId && p.status === 'verified')
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const verifiedMonths = new Set(verifiedPayments.map((p) => p.month));
  const totalPaid = verifiedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPayable = Number(schedule.totalPayable || 0);
  const totalDue = Math.max(0, totalPayable - totalPaid);
  const paidInstallmentsCount = schedule.items.filter((i) => verifiedMonths.has(i.month)).length;
  const dueInstallmentsCount = Math.max(0, schedule.items.length - paidInstallmentsCount);

  res.json({
    verified: true,
    report: {
      generatedDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      memberId: member.memberId,
      name: member.fullName,
      batch: member.batch,
      subscriptionCategory: schedule.batchRule?.categoryEn || '-',
      membershipType: plan?.nameEn || '-',
      totalPayable,
      totalPaid,
      totalDue,
      paidInstallmentsCount,
      dueInstallmentsCount,
      totalInstallments: schedule.items.length,
      paidPayments: verifiedPayments.map((p, idx) => ({
        no: idx + 1,
        receiptNo: p.id,
        date: p.date,
        month: formatMonthLabel(p.month, 'en'),
        paymentType: p.installmentLabel || 'Installment',
        method: p.method,
        transactionId: p.transactionId || '-',
        amount: Number(p.amount || 0),
      })),
      settings,
    },
  });
});

// Public: Registration OTP Send
app.post('/api/public/otp/send', async (req, res) => {
  const rawPhone = String(req.body?.phone || '').trim();
  const fullName = String(req.body?.fullName || 'Applicant').trim();
  const normPhone = normalizePhone(rawPhone);

  if (normPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid Bangladeshi mobile number.' });
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await saveOtp(normPhone, code, Date.now() + 5 * 60 * 1000);

  const smsResult = await dispatchSms({
    to: rawPhone,
    recipientName: fullName,
    triggerType: 'AUTO_OTP',
    message: `Your Armanitolians Club verification code is ${code}. Valid for 5 minutes. Do not share this code with anyone.`,
  });

  const maskedPhone = rawPhone.length >= 6 ? `${rawPhone.slice(0, 4)}****${rawPhone.slice(-3)}` : rawPhone;
  res.json({
    ok: true,
    smsDelivered: smsResult.ok,
    maskedPhone,
    expiresInSeconds: 300,
    ...(smsResult.ok ? {} : { warning: smsResult.providerResponse }),
  });
});

// Public: Registration OTP Verify
app.post('/api/public/otp/verify', async (req, res) => {
  const rawPhone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();
  const normPhone = normalizePhone(rawPhone);

  if (!normPhone || code.length !== 6) {
    return res.status(400).json({ error: 'Please enter the 6-digit verification code.' });
  }

  const row = await getOtp(normPhone);
  if (!row) {
    return res.status(400).json({ error: 'No verification code found. Please request a new code.' });
  }
  if (Date.now() > Number(row.expires_at)) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }
  if (Number(row.attempts) >= 5) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (row.code !== code) {
    await incrementOtpAttempts(normPhone);
    return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  await markOtpVerified(normPhone);
  const otpToken = createToken({ phone: normPhone, purpose: 'register_otp' });
  res.json({ verified: true, otpToken });
});

// Public Member Registration
app.post('/api/public/register', async (req, res) => {
  const body = req.body || {};
  if (!body.fullName || !body.batch || !body.phone) {
    return res.status(400).json({ error: 'Full name, batch, and phone number are required.' });
  }

  const auth = req.headers.authorization || '';
  const isAdminReq = auth.startsWith('Bearer ') && Boolean(verifyToken(auth.slice(7)));
  if (!isAdminReq) {
    const decodedOtp = verifyToken(body.otpToken || '');
    if (
      !decodedOtp ||
      decodedOtp.purpose !== 'register_otp' ||
      decodedOtp.phone !== normalizePhone(body.phone)
    ) {
      return res.status(400).json({ error: 'Phone number OTP verification is required before submitting.' });
    }
  }

  const plans = await getPlans();
  const chosenPlan = plans.find((p) => p.id === body.planId);
  if (!chosenPlan || chosenPlan.enabled === false) {
    return res.status(400).json({ error: 'Selected subscription plan is currently unavailable.' });
  }

  const existing = await getAllMembers();
  const seq = String(1001 + existing.length).padStart(4, '0');
  const appId = `APP-2026-${seq}`;

  const newMember = {
    ...body,
    id: appId,
    memberId: null,
    status: 'pending',
    submittedAt: new Date().toISOString().slice(0, 10),
    approvedAt: null,
    remarks: '',
    renewalDate: null,
    paymentMode: chosenPlan.allowInstallment ? body.paymentMode || 'installment' : 'full',
  };

  await upsertMember(newMember);
  await addAuditLog(
    'APPLICATION_SUBMITTED',
    `New public registration ${appId} by ${newMember.fullName} (SSC ${newMember.batch})`,
    'Public Applicant'
  );

  dispatchSms({
    to: newMember.phone,
    recipientName: newMember.fullName,
    triggerType: 'AUTO_REGISTER',
    message: `Dear ${newMember.fullName}, your Armanitolians Club membership application has been received. Tracking ID: ${appId}. You will be notified once reviewed.`,
  }).catch(() => {});

  res.status(201).json({ member: newMember });
});

// Public Application Tracker
app.post('/api/public/track', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Please enter your Application ID or Phone Number.' });
  }

  const [members, plans] = await Promise.all([getAllMembers(), getPlans()]);
  const normQ = normalizePhone(query);

  const match = members.find(
    (m) =>
      m.id.toLowerCase() === query.toLowerCase() ||
      (m.memberId && m.memberId.toLowerCase() === query.toLowerCase()) ||
      (normQ.length >= 8 && normalizePhone(m.phone) === normQ)
  );

  if (!match) {
    return res.status(404).json({ error: 'No registration found with that Tracking ID or Phone Number.' });
  }

  const plan = plans.find((p) => p.id === match.planId);
  res.json({
    application: {
      id: match.id,
      memberId: match.memberId,
      fullName: match.fullName,
      batch: match.batch,
      phoneMasked: match.phone ? `${match.phone.slice(0, 4)}****${match.phone.slice(-3)}` : '',
      status: match.status,
      submittedAt: match.submittedAt,
      approvedAt: match.approvedAt,
      remarks: match.remarks,
      planNameEn: plan?.nameEn || '',
      planNameBn: plan?.nameBn || '',
      photo: match.photo,
    },
  });
});

// Public Revision OTP Send
app.post('/api/public/revision/send-otp', async (req, res) => {
  const trackingId = String(req.body?.trackingId || '').trim();
  const members = await getAllMembers();
  const member = members.find(
    (m) => m.id.toLowerCase() === trackingId.toLowerCase() && m.status === 'revision'
  );
  if (!member) {
    return res.status(404).json({ error: 'Application not found or not marked for revision.' });
  }
  const normPhone = normalizePhone(member.phone);
  const code = String(crypto.randomInt(100000, 1000000));
  await saveOtp(normPhone, code, Date.now() + 5 * 60 * 1000);

  const smsResult = await dispatchSms({
    to: member.phone,
    recipientName: member.fullName,
    triggerType: 'AUTO_REVISION_OTP',
    message: `Your Armanitolians Club revision verification code is ${code}. Valid for 5 minutes. Do not share this code.`,
  });

  const maskedPhone =
    member.phone.length >= 6 ? `${member.phone.slice(0, 4)}****${member.phone.slice(-3)}` : member.phone;
  res.json({ ok: true, maskedPhone, smsDelivered: smsResult.ok });
});

// Public Revision OTP Verify
app.post('/api/public/revision/verify-otp', async (req, res) => {
  const trackingId = String(req.body?.trackingId || '').trim();
  const code = String(req.body?.code || '').trim();
  const members = await getAllMembers();
  const member = members.find(
    (m) => m.id.toLowerCase() === trackingId.toLowerCase() && m.status === 'revision'
  );
  if (!member) {
    return res.status(404).json({ error: 'Application not found or not eligible for revision.' });
  }
  const normPhone = normalizePhone(member.phone);
  const row = await getOtp(normPhone);

  if (!row || Date.now() > Number(row.expires_at)) {
    return res.status(400).json({ error: 'Verification code expired or missing. Please request a new code.' });
  }
  if (Number(row.attempts) >= 5) {
    return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
  }
  if (row.code !== code) {
    await incrementOtpAttempts(normPhone);
    return res.status(400).json({ error: 'Invalid verification code.' });
  }

  await markOtpVerified(normPhone);
  const revisionToken = createToken({ id: member.id, phone: normPhone, purpose: 'revision_edit' });
  res.json({ verified: true, revisionToken, member });
});

// Public Revision Resubmit
app.put('/api/public/revision/resubmit', async (req, res) => {
  const { revisionToken, updates } = req.body || {};
  const decoded = verifyToken(revisionToken || '');
  if (!decoded || decoded.purpose !== 'revision_edit') {
    return res.status(403).json({ error: 'OTP verification is required to resubmit this application.' });
  }

  const members = await getAllMembers();
  const existing = members.find((m) => m.id === decoded.id);
  if (!existing || existing.status !== 'revision') {
    return res.status(404).json({ error: 'Revision application not found.' });
  }

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    memberId: existing.memberId,
    status: 'pending',
    submittedAt: new Date().toISOString().slice(0, 10),
    remarks: `Resubmitted after revision (Previous note: ${existing.remarks || 'N/A'})`,
  };

  await upsertMember(updated);
  await addAuditLog(
    'APPLICATION_RESUBMITTED',
    `Applicant ${updated.fullName} (${updated.id}) resubmitted revised application`,
    'Public Applicant'
  );

  if (updated.phone) {
    dispatchSms({
      to: updated.phone,
      recipientName: updated.fullName,
      triggerType: 'AUTO_RESUBMIT',
      message: `Dear ${updated.fullName}, your revised Armanitolians Club application (${updated.id}) has been resubmitted for committee review. Thank you.`,
    }).catch(() => {});
  }

  res.json({ member: updated });
});

// Public Approved Member Payments Lookup
app.post('/api/public/member-payments', async (req, res) => {
  const clubId = String(req.body?.clubId || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!clubId || !phone) {
    return res.status(400).json({ error: 'Both Club Member ID and Phone Number are required.' });
  }

  const normPhone = normalizePhone(phone);
  const [members, plans, allPayments, settings] = await Promise.all([
    getAllMembers(),
    getPlans(),
    getAllPayments(),
    getSettings(),
  ]);

  const member = members.find(
    (m) =>
      m.status === 'approved' &&
      m.memberId &&
      m.memberId.toLowerCase() === clubId.toLowerCase() &&
      normalizePhone(m.phone) === normPhone
  );

  if (!member) {
    return res.status(404).json({
      error: 'No approved member found matching both Club ID and Phone Number.',
    });
  }

  const plan = plans.find((p) => p.id === member.planId);
  const memberPayments = allPayments.filter((p) => p.memberId === member.memberId);

  res.json({
    member: {
      id: member.id,
      memberId: member.memberId,
      fullName: member.fullName,
      batch: member.batch,
      phone: member.phone,
      email: member.email,
      presentAddress: member.presentAddress,
      bloodGroup: member.bloodGroup,
      planId: member.planId,
      paymentMode: member.paymentMode,
      photo: member.photo,
    },
    plan,
    payments: memberPayments,
    settings,
  });
});

// ==========================================
// SHURJOPAY PAYMENT GATEWAY ENDPOINTS
// ==========================================

app.post('/api/shurjopay/initiate', async (req, res) => {
  const { clubId, phone, month, amount, paymentType, installmentLabel } = req.body || {};
  if (!clubId || !phone || !month || !amount) {
    return res.status(400).json({ error: 'Missing required payment details.' });
  }

  const normPhone = normalizePhone(phone);
  const members = await getAllMembers();
  const member = members.find(
    (m) =>
      m.status === 'approved' &&
      m.memberId &&
      m.memberId.toLowerCase() === String(clubId).trim().toLowerCase() &&
      normalizePhone(m.phone) === normPhone
  );

  if (!member) {
    return res.status(403).json({ error: 'Member verification failed.' });
  }

  const { apiUrl } = getBaseUrls(req);
  const orderId = `AC-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const returnUrl = `${apiUrl}/api/shurjopay/callback`;
  const cancelUrl = `${apiUrl}/api/shurjopay/cancel`;

  await createPaymentOrder({
    orderId,
    memberId: member.memberId,
    memberName: member.fullName,
    batch: member.batch,
    month,
    paymentType: paymentType || 'installment',
    installmentLabel: installmentLabel || 'Monthly Installment',
    amount: Number(amount),
  });

  try {
    const sp = await initiateShurjoPayCheckout({
      orderId,
      amount: Number(amount),
      customerName: member.fullName,
      customerPhone: member.phone,
      customerEmail: member.email,
      customerAddress: member.presentAddress,
      returnUrl,
      cancelUrl,
      clientIp: req.ip || '127.0.0.1',
    });

    await updatePaymentOrderSpId(orderId, sp.spOrderId);

    return res.json({
      checkoutUrl: sp.checkoutUrl,
      orderId,
      spOrderId: sp.spOrderId,
      mode: sp.mode,
      simulated: false,
    });
  } catch (err) {
    return res.json({
      checkoutUrl: null,
      orderId,
      mode: 'sandbox-simulator',
      simulated: true,
      warning: err.message,
    });
  }
});

app.all('/api/shurjopay/cancel', (req, res) => {
  const { appUrl } = getBaseUrls(req);
  return res.redirect(`${appUrl}/#portal?payment=cancelled`);
});

app.all('/api/shurjopay/callback', async (req, res) => {
  const { appUrl } = getBaseUrls(req);
  const spOrderId = String(
    req.query.order_id || req.body?.order_id || req.query.sp_order_id || req.body?.sp_order_id || ''
  ).trim();
  if (!spOrderId) {
    return res.redirect(`${appUrl}/#portal?payment=failed`);
  }

  const order = await getPaymentOrder(spOrderId);
  if (!order) {
    return res.redirect(`${appUrl}/#portal?payment=failed`);
  }

  if (order.status === 'completed') {
    return res.redirect(
      `${appUrl}/#portal?payment=success&clubId=${encodeURIComponent(order.member_id)}&amount=${encodeURIComponent(order.amount)}&label=${encodeURIComponent(order.installment_label)}&month=${encodeURIComponent(order.month)}`
    );
  }

  const members = await getAllMembers();
  const memberObj = members.find((m) => m.memberId === order.member_id);

  try {
    const verification = await verifyShurjoPayOrder(spOrderId);
    if (verification.success) {
      const receiptId = `RCP-SP-${Date.now().toString().slice(-6)}`;
      const trxId = verification.record?.bank_trx_id || spOrderId;
      const paymentRecord = {
        id: receiptId,
        memberId: order.member_id,
        memberName: order.member_name,
        batch: order.batch,
        month: order.month,
        paymentType: order.payment_type,
        installmentLabel: order.installment_label,
        amount: Number(order.amount),
        method: `ShurjoPay (${verification.record?.method || verification.mode})`,
        transactionId: trxId,
        date: new Date().toISOString().slice(0, 10),
        status: 'verified',
        notes: `Paid online via ShurjoPay (${verification.mode}) · Order ${order.order_id}`,
      };
      await upsertPayment(paymentRecord);
      await updatePaymentOrderStatus(order.order_id, 'completed');
      await addAuditLog(
        'SHURJOPAY_VERIFIED',
        `Online ShurjoPay payment ${receiptId} (৳${order.amount}) verified for ${order.member_name} (${order.installment_label})`,
        'ShurjoPay Gateway'
      );

      if (memberObj?.phone) {
        dispatchSms({
          to: memberObj.phone,
          recipientName: order.member_name,
          triggerType: 'AUTO_PAYMENT_SUCCESS',
          message: `Dear ${order.member_name}, your Armanitolians Club payment of BDT ${Number(order.amount).toLocaleString()} for ${order.installment_label} (${order.month}) is SUCCESSFUL. Receipt: ${receiptId}. TrxID: ${trxId}. Thank you.`,
        }).catch(() => {});
      }

      return res.redirect(
        `${appUrl}/#portal?payment=success&receipt=${encodeURIComponent(receiptId)}&clubId=${encodeURIComponent(order.member_id)}&amount=${encodeURIComponent(order.amount)}&label=${encodeURIComponent(order.installment_label)}&month=${encodeURIComponent(order.month)}&trxId=${encodeURIComponent(trxId)}`
      );
    }
  } catch (err) {
    console.error('ShurjoPay callback verification error:', err.message);
  }

  await updatePaymentOrderStatus(order.order_id, 'failed');

  if (memberObj?.phone) {
    dispatchSms({
      to: memberObj.phone,
      recipientName: order.member_name,
      triggerType: 'AUTO_PAYMENT_FAILED',
      message: `Dear ${order.member_name}, your Armanitolians Club payment of BDT ${Number(order.amount).toLocaleString()} for ${order.installment_label} (${order.month}) could not be completed (Order: ${order.order_id}). Please try again or contact the club office.`,
    }).catch(() => {});
  }

  return res.redirect(
    `${appUrl}/#portal?payment=failed&orderId=${encodeURIComponent(order.order_id)}&amount=${encodeURIComponent(order.amount)}&label=${encodeURIComponent(order.installment_label)}&month=${encodeURIComponent(order.month)}`
  );
});

app.post('/api/shurjopay/simulate-complete', async (req, res) => {
  if ((process.env.SHURJOPAY_MODE || 'sandbox').toLowerCase() === 'live') {
    return res.status(403).json({ error: 'Simulator disabled in live mode.' });
  }
  const { orderId, channel = 'bKash (Sandbox)' } = req.body || {};
  const order = await getPaymentOrder(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const receiptId = `RCP-SP-${Date.now().toString().slice(-6)}`;
  const paymentRecord = {
    id: receiptId,
    memberId: order.member_id,
    memberName: order.member_name,
    batch: order.batch,
    month: order.month,
    paymentType: order.payment_type,
    installmentLabel: order.installment_label,
    amount: Number(order.amount),
    method: `ShurjoPay · ${channel}`,
    transactionId: `SP-SBX-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().slice(0, 10),
    status: 'verified',
    notes: `Paid online via ShurjoPay Sandbox · Order ${order.order_id}`,
  };
  await upsertPayment(paymentRecord);
  await updatePaymentOrderStatus(order.order_id, 'completed');
  await addAuditLog(
    'SHURJOPAY_VERIFIED',
    `ShurjoPay Sandbox payment ${receiptId} (৳${order.amount}) verified for ${order.member_name}`,
    'ShurjoPay Sandbox'
  );

  const members = await getAllMembers();
  const memberObj = members.find((m) => m.memberId === order.member_id);
  if (memberObj?.phone) {
    dispatchSms({
      to: memberObj.phone,
      recipientName: order.member_name,
      triggerType: 'AUTO_PAYMENT_SUCCESS',
      message: `Dear ${order.member_name}, your Armanitolians Club payment of BDT ${Number(order.amount).toLocaleString()} for ${order.installment_label} (${order.month}) is SUCCESSFUL. Receipt: ${receiptId}. Thank you.`,
    }).catch(() => {});
  }

  res.json({ payment: paymentRecord });
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await getAdminByUsername(String(username || '').trim());
  if (!admin || !verifyPassword(String(password || ''), admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = createToken({ id: admin.id, username: admin.username, role: admin.role });
  await addAuditLog('ADMIN_LOGIN', `Admin "${admin.username}" signed in to dashboard`, admin.username);
  res.json({
    token,
    admin: { username: admin.username, role: admin.role },
  });
});

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ admin: { username: req.admin.username, role: req.admin.role } });
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const admin = await getAdminByUsername(req.admin.username);
  if (!admin || !verifyPassword(String(currentPassword || ''), admin.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  await updateAdminPassword(admin.id, hashPassword(String(newPassword)));
  await addAuditLog('ADMIN_PASSWORD_CHANGED', `Admin "${admin.username}" updated password`, admin.username);
  res.json({ ok: true });
});

// ==========================================
// ADMIN PROTECTED ENDPOINTS
// ==========================================

app.get('/api/admin/bootstrap', requireAdmin, async (_req, res) => {
  const [members, payments, plans, settings, auditLogs, smsLogs, notices] = await Promise.all([
    getAllMembers(),
    getAllPayments(),
    getPlans(),
    getSettings(),
    getAuditLogs(),
    getSmsLogs(),
    getAllNotices(),
  ]);
  res.json({
    members,
    payments,
    plans,
    settings,
    auditLogs,
    smsLogs,
    notices,
    database: isPostgres ? 'postgresql' : 'sqlite',
    shurjopayMode: (process.env.SHURJOPAY_MODE || 'sandbox').toLowerCase(),
    smsSenderId: process.env.GREENWEB_SENDER_ID || '8809617621831',
  });
});

// Admin Notices
app.post('/api/admin/notices', requireAdmin, async (req, res) => {
  const { date, title, description, attachmentName, attachmentType, attachmentData } = req.body || {};
  if (!title || !description) {
    return res.status(400).json({ error: 'Notice title and description are required.' });
  }
  const notice = {
    id: `NTC-${Date.now().toString().slice(-6)}`,
    date: date || new Date().toISOString().slice(0, 10),
    title: String(title).trim(),
    description: String(description).trim(),
    attachmentName: attachmentName || null,
    attachmentType: attachmentType || null,
    attachmentData: attachmentData || null,
  };
  await insertNotice(notice);
  await addAuditLog('NOTICE_PUBLISHED', `Published notice: "${notice.title}"`, req.admin.username);
  res.status(201).json({ notice, notices: await getAllNotices() });
});

app.delete('/api/admin/notices/:id', requireAdmin, async (req, res) => {
  await deleteNoticeById(req.params.id);
  await addAuditLog('NOTICE_DELETED', `Deleted notice ${req.params.id}`, req.admin.username);
  res.json({ ok: true, notices: await getAllNotices() });
});

// Due Reminder Engine
function buildDueReminderBanglaMessage(amount) {
  return `প্রিয় সদস্য, আমাদের রেকর্ড অনুযায়ী আপনার মাসিক চাঁদা এখনো বকেয়া রয়েছে। অনুগ্রহ করে বকেয়া পেমেন্টঃ ${Number(amount).toLocaleString()} টাকা পরিশোধ করুন। উল্লেখ্য, প্রতি মাসের ১০ তারিখের মধ্যে মাসিক পেমেন্ট/ইনস্টলমেন্ট পরিশোধ করার অনুরোধ রইল।\nধন্যবাদান্তে,\nআরমানিটোলিয়ান্স ক্লাব`;
}

async function computeOverdueMembers(targetMonth) {
  const [settings, plans, allMembersRaw, allPaymentsRaw] = await Promise.all([
    getSettings(),
    getPlans(),
    getAllMembers(),
    getAllPayments(),
  ]);
  const allMembers = allMembersRaw.filter((m) => m.status === 'approved');
  const allPayments = allPaymentsRaw.filter((p) => p.status === 'verified');
  const overdue = [];

  for (const m of allMembers) {
    const plan = plans.find((p) => p.id === m.planId);
    if (!plan || Number(plan.fee) === 0) continue;
    const sched = generateMemberSchedule(m, plan, settings);
    const paidMonths = new Set(allPayments.filter((p) => p.memberId === m.memberId).map((p) => p.month));
    const missed = sched.items.filter((item) => item.month <= targetMonth && !paidMonths.has(item.month));
    if (missed.length > 0) {
      const dueAmount = missed.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      overdue.push({
        memberId: m.memberId,
        name: m.fullName,
        batch: m.batch,
        phone: m.phone,
        missedCount: missed.length,
        dueAmount,
        message: buildDueReminderBanglaMessage(dueAmount),
      });
    }
  }
  return overdue;
}

app.get('/api/admin/dues/preview', requireAdmin, async (req, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  const overdue = await computeOverdueMembers(month);
  res.json({ month, overdue, totalOverdueAmount: overdue.reduce((s, x) => s + x.dueAmount, 0) });
});

app.post('/api/admin/dues/send-reminders', requireAdmin, async (req, res) => {
  const month = String(req.body?.month || new Date().toISOString().slice(0, 7));
  const overdue = await computeOverdueMembers(month);
  if (overdue.length === 0) {
    return res.json({ ok: true, sentCount: 0, totalCount: 0, smsLogs: await getSmsLogs() });
  }

  let sentCount = 0;
  for (const item of overdue) {
    if (!item.phone) continue;
    const result = await dispatchSms({
      to: item.phone,
      recipientName: item.name,
      triggerType: 'DUE_REMINDER_SMS',
      message: item.message,
    });
    if (result.ok) sentCount++;
  }

  await addAuditLog(
    'DUE_REMINDERS_SENT',
    `Sent Due Reminder SMS for ${month} to ${overdue.length} overdue members (${sentCount} delivered)`,
    req.admin.username
  );

  res.json({ ok: true, sentCount, totalCount: overdue.length, smsLogs: await getSmsLogs() });
});

app.get('/api/cron/due-reminders', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized cron invocation' });
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const overdue = await computeOverdueMembers(currentMonth);
  let sentCount = 0;
  for (const item of overdue) {
    if (!item.phone) continue;
    const result = await dispatchSms({
      to: item.phone,
      recipientName: item.name,
      triggerType: 'CRON_DUE_REMINDER',
      message: item.message,
    });
    if (result.ok) sentCount++;
  }
  await addAuditLog(
    'CRON_DUE_REMINDER',
    `Automated 7th-day 4PM Due Reminder dispatched for ${currentMonth}: ${sentCount}/${overdue.length} delivered`,
    'System Cron'
  );
  res.json({ ok: true, month: currentMonth, sentCount, totalCount: overdue.length });
});

// Admin SMS Send
app.post('/api/admin/sms/send', requireAdmin, async (req, res) => {
  const { recipients, message } = req.body || {};
  if (!Array.isArray(recipients) || recipients.length === 0 || !String(message || '').trim()) {
    return res.status(400).json({ error: 'Recipients and message text are required.' });
  }

  const rawMsg = String(message).trim();
  const isPersonalized = rawMsg.includes('{Name}');

  if (isPersonalized && recipients.length > 1) {
    let okCount = 0;
    let lastProviderResp = '';
    for (const r of recipients) {
      if (!r.phone) continue;
      const personalMsg = rawMsg.replaceAll('{Name}', r.name || 'Member');
      const result = await dispatchSms({
        to: r.phone,
        recipientName: r.name || r.phone,
        triggerType: 'ADMIN_NOTIFICATION',
        message: personalMsg,
      });
      if (result.ok) okCount++;
      lastProviderResp = result.providerResponse;
    }
    await addAuditLog(
      'SMS_SENT',
      `Admin sent personalized notification SMS to ${recipients.length} members (${okCount} delivered)`,
      req.admin.username
    );
    return res.json({
      ok: okCount > 0,
      deliveredCount: okCount,
      totalCount: recipients.length,
      providerResponse: lastProviderResp,
      smsLogs: await getSmsLogs(),
    });
  }

  const phones = recipients.map((r) => r.phone).filter(Boolean);
  const names =
    recipients.length === 1
      ? recipients[0].name || recipients[0].phone
      : `${recipients.length} Members`;
  const finalMsg =
    recipients.length === 1
      ? rawMsg.replaceAll('{Name}', recipients[0].name || 'Member')
      : rawMsg;

  const result = await dispatchSms({
    to: phones,
    recipientName: names,
    triggerType: recipients.length > 1 ? 'ADMIN_BULK' : 'ADMIN_MANUAL',
    message: finalMsg,
  });

  await addAuditLog(
    'SMS_SENT',
    `Admin sent SMS to ${names} (${result.ok ? 'Delivered' : 'Failed'})`,
    req.admin.username
  );

  res.json({ ok: result.ok, providerResponse: result.providerResponse, smsLogs: await getSmsLogs() });
});

// Admin Edit Member
app.put('/api/admin/members/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const members = await getAllMembers();
  const existing = members.find((m) => m.id === id);
  if (!existing) return res.status(404).json({ error: 'Member not found.' });

  const updated = { ...existing, ...req.body, id: existing.id };
  await upsertMember(updated);
  await addAuditLog(
    'MEMBER_UPDATED',
    `Admin updated profile/data for ${updated.fullName} (${updated.memberId || updated.id})`,
    req.admin.username
  );
  res.json({ member: updated });
});

// Admin Review Application
app.post('/api/admin/members/:id/review', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { decision, remarks = '' } = req.body || {};
  const [all, plans] = await Promise.all([getAllMembers(), getPlans()]);
  const target = all.find((m) => m.id === id);
  if (!target) return res.status(404).json({ error: 'Application not found.' });

  let updated;
  if (decision === 'approved') {
    const approvedCount = all.filter((x) => x.status === 'approved').length + 1;
    const generatedMemberId =
      target.memberId || `AC-${target.batch || '2026'}-${String(approvedCount).padStart(4, '0')}`;
    const plan = plans.find((p) => p.id === target.planId);
    updated = {
      ...target,
      status: 'approved',
      memberId: generatedMemberId,
      approvedAt: new Date().toISOString().slice(0, 10),
      renewalDate: plan && !plan.allowInstallment ? 'Lifetime' : 'Jan 2030',
      remarks: remarks || target.remarks,
    };
  } else {
    updated = { ...target, status: decision, remarks };
  }

  await upsertMember(updated);
  await addAuditLog(
    `APPLICATION_${String(decision).toUpperCase()}`,
    `${String(decision).toUpperCase()} application ${id} (${target.fullName})${remarks ? ` — ${remarks}` : ''}`,
    req.admin.username
  );

  let smsText = '';
  let triggerType = 'AUTO_REVIEW';
  if (decision === 'approved') {
    triggerType = 'AUTO_APPROVED';
    smsText = `Congratulations ${updated.fullName}! Your Armanitolians Club membership is APPROVED. Official Club ID: ${updated.memberId}. Use your Club ID & Phone to view/pay subscriptions.`;
  } else if (decision === 'revision') {
    triggerType = 'AUTO_REVISION';
    smsText = `Dear ${updated.fullName}, your Armanitolians Club application (${updated.id}) requires revision.${remarks ? ` Remarks: ${remarks}` : ''} Please track your application and edit via OTP.`;
  } else if (decision === 'rejected') {
    triggerType = 'AUTO_REJECTED';
    smsText = `Dear ${updated.fullName}, we regret to inform you that your Armanitolians Club application (${updated.id}) was not approved.${remarks ? ` Reason: ${remarks}` : ''}`;
  }

  if (smsText && updated.phone) {
    dispatchSms({
      to: updated.phone,
      recipientName: updated.fullName,
      triggerType,
      message: smsText,
    }).catch(() => {});
  }

  res.json({ member: updated });
});

// Admin Record Payment
app.post('/api/admin/payments', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const [settings, existing] = await Promise.all([getSettings(), getAllPayments()]);
  const seq = 8801 + existing.length;
  const isAutoVerified = body.method === 'Cash' && settings.autoApproveCash;

  const newPayment = {
    ...body,
    id: `RCP-2027-${seq}`,
    date: new Date().toISOString().slice(0, 10),
    status: body.status || (isAutoVerified ? 'verified' : 'pending'),
  };
  await upsertPayment(newPayment);
  await addAuditLog(
    'PAYMENT_RECORDED',
    `Recorded ৳${newPayment.amount} (${newPayment.method}) for ${newPayment.memberName} (${newPayment.month})`,
    req.admin.username
  );
  res.status(201).json({ payment: newPayment });
});

// Admin Verify Payment
app.post('/api/admin/payments/:id/verify', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const [allPayments, members] = await Promise.all([getAllPayments(), getAllMembers()]);
  const target = allPayments.find((p) => p.id === id);
  if (!target) return res.status(404).json({ error: 'Payment not found.' });

  const updated = { ...target, status: 'verified' };
  await upsertPayment(updated);
  await addAuditLog(
    'PAYMENT_VERIFIED',
    `Verified receipt ${id} (৳${updated.amount}) for ${updated.memberName}`,
    req.admin.username
  );

  const memberObj = members.find((m) => m.memberId === updated.memberId);
  if (memberObj?.phone) {
    dispatchSms({
      to: memberObj.phone,
      recipientName: updated.memberName,
      triggerType: 'AUTO_PAYMENT_SUCCESS',
      message: `Dear ${updated.memberName}, your Armanitolians Club payment of BDT ${Number(updated.amount).toLocaleString()} (${updated.installmentLabel || updated.month}) has been VERIFIED. Receipt: ${id}. Thank you.`,
    }).catch(() => {});
  }

  res.json({ payment: updated });
});

// Admin Update Plans
app.put('/api/admin/plans', requireAdmin, async (req, res) => {
  const plans = req.body?.plans;
  if (!Array.isArray(plans)) return res.status(400).json({ error: 'Invalid plans array.' });
  await savePlans(plans);
  await addAuditLog('PLANS_UPDATED', 'Admin updated subscription plans / availability', req.admin.username);
  res.json({ plans });
});

// Admin Update Settings
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings payload.' });
  }
  await saveSettings(settings);
  await addAuditLog('SETTINGS_UPDATED', 'Admin updated club configuration & settings', req.admin.username);
  res.json({ settings });
});

// ==========================================
// ADMIN REPORT GENERATION (ENCRYPTED ACCESS CODE)
// ==========================================

function matchesBatchFilter(batchStr, filterMode, singleBatch, multiBatchInput) {
  const y = Number(batchStr);
  if (!filterMode || filterMode === 'all') return true;
  if (filterMode === 'rising_star_all') return y >= 2009;
  if (filterMode === 'rising_star_young') return y >= 2015;
  if (filterMode === 'rising_star_senior') return y >= 2009 && y <= 2014;
  if (filterMode === 'classic') return y >= 1980 && y <= 2008;
  if (filterMode === 'legacy') return y >= 1958 && y <= 1979;
  if (filterMode === 'single') return String(batchStr) === String(singleBatch || '').trim();
  if (filterMode === 'multiple') {
    const tokens = String(multiBatchInput || '')
      .split(/[,;/\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return true;
    for (const tok of tokens) {
      if (tok.includes('-')) {
        const [a, b] = tok.split('-').map(Number);
        if (!Number.isNaN(a) && !Number.isNaN(b) && y >= Math.min(a, b) && y <= Math.max(a, b)) {
          return true;
        }
      } else if (Number(tok) === y) {
        return true;
      }
    }
    return false;
  }
  return true;
}

function getBatchFilterLabel(filterMode, singleBatch, multiBatchInput) {
  switch (filterMode) {
    case 'rising_star_all':
      return 'Rising Star (2009-2024)';
    case 'rising_star_young':
      return 'Rising Star (2015-2024)';
    case 'rising_star_senior':
      return 'Rising Star (2009-2014)';
    case 'classic':
      return 'Classic (1980-2008)';
    case 'legacy':
      return 'Legacy / Legendary (1958-1979)';
    case 'single':
      return singleBatch ? `SSC ${singleBatch}` : 'All';
    case 'multiple':
      return multiBatchInput ? String(multiBatchInput).trim() : 'All';
    default:
      return 'All';
  }
}

app.post('/api/admin/reports/verify-code', requireAdmin, async (req, res) => {
  const code = String(req.body?.accessCode || '').trim();
  const check = await verifyReportAccessCode(code);
  if (!check.valid) {
    await addAuditLog('REPORT_ACCESS_DENIED', 'Invalid report access code entered', req.admin.username);
    return res.status(403).json({ error: 'Invalid Access Code. Report generation denied.' });
  }

  const reportToken = createToken({
    admin: req.admin.username,
    purpose: 'report_generation',
    codeLabel: check.label,
  });
  await addAuditLog('REPORT_ACCESS_GRANTED', `Report access granted (${check.label})`, req.admin.username);
  res.json({ valid: true, reportToken, codeLabel: check.label });
});

app.post('/api/admin/reports/generate', requireAdmin, async (req, res) => {
  const {
    reportToken,
    reportType = 'monthly_payment',
    month = '2027-01',
    batchFilter = 'all',
    singleBatch = '',
    multiBatchInput = '',
    memberType = 'all',
  } = req.body || {};

  const decoded = verifyToken(reportToken || '');
  if (!decoded || decoded.purpose !== 'report_generation') {
    return res.status(403).json({ error: 'Valid Report Access Code verification is required.' });
  }

  const [settings, plans, allMembers, allPayments] = await Promise.all([
    getSettings(),
    getPlans(),
    getAllMembers(),
    getAllPayments(),
  ]);

  const approvedMembers = allMembers.filter(
    (m) =>
      m.status === 'approved' &&
      matchesBatchFilter(m.batch, batchFilter, singleBatch, multiBatchInput)
  );

  const batchLabel = getBatchFilterLabel(batchFilter, singleBatch, multiBatchInput);

  if (reportType === 'member_list') {
    const filtered = approvedMembers
      .filter((m) => memberType === 'all' || m.planId === memberType)
      .sort((a, b) => Number(a.batch) - Number(b.batch) || a.fullName.localeCompare(b.fullName));

    const planObj = plans.find((p) => p.id === memberType);
    const memberTypeLabel = memberType === 'all' ? 'All Member Types' : planObj?.nameEn || memberType;

    const rows = filtered.map((m, idx) => {
      const p = plans.find((x) => x.id === m.planId);
      const cat = getBatchRule(m.batch, settings.batchRules);
      return {
        no: idx + 1,
        memberId: m.memberId || m.id,
        name: m.fullName,
        batch: m.batch,
        category: cat.groupEn,
        memberType: p?.nameEn || '-',
        phone: m.phone || '-',
        bloodGroup: m.bloodGroup || '-',
      };
    });

    await addAuditLog(
      'REPORT_GENERATED',
      `Generated Member List Report (${batchLabel} · ${memberTypeLabel} · ${rows.length} members)`,
      req.admin.username
    );

    return res.json({
      reportType: 'member_list',
      generatedDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      batchLabel,
      memberTypeLabel,
      totalMembers: rows.length,
      rows,
      settings,
    });
  }

  const memberById = new Map(approvedMembers.map((m) => [m.memberId, m]));
  const receivedInMonth = allPayments.filter(
    (p) =>
      p.status === 'verified' &&
      String(p.date || '').slice(0, 7) === month &&
      memberById.has(p.memberId)
  );

  const paidGrouped = new Map();
  for (const p of receivedInMonth) {
    const m = memberById.get(p.memberId);
    const shortMonth = formatMonthLabel(p.month, 'en').replace(' 20', "' ");
    const typeLine =
      p.paymentType === 'full'
        ? 'Full Payment'
        : p.paymentType === 'first_month'
        ? 'First Month Payment'
        : `${p.installmentLabel || 'Installment'} (${shortMonth})`;
    const cleanMethod = String(p.method || '').toLowerCase().includes('cash') ? 'Cash' : 'Online';

    if (!paidGrouped.has(p.memberId)) {
      paidGrouped.set(p.memberId, {
        name: m?.fullName || p.memberName,
        batch: m?.batch || p.batch,
        types: [typeLine],
        amount: Number(p.amount || 0),
        method: cleanMethod,
      });
    } else {
      const entry = paidGrouped.get(p.memberId);
      entry.types.push(typeLine);
      entry.amount += Number(p.amount || 0);
      if (entry.method !== cleanMethod) entry.method = 'Mixed';
    }
  }

  const paidList = Array.from(paidGrouped.values()).map((item, idx) => ({
    no: idx + 1,
    name: item.name,
    batch: item.batch,
    paymentType: item.types.join('\n'),
    amount: item.amount,
    method: item.method,
  }));

  const totalPaid = paidList.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const dueList = [];
  for (const m of approvedMembers) {
    const plan = plans.find((p) => p.id === m.planId);
    if (!plan || Number(plan.fee) === 0) continue;
    const sched = generateMemberSchedule(m, plan, settings);
    const verifiedMonths = new Set(
      allPayments
        .filter((p) => p.memberId === m.memberId && p.status === 'verified')
        .map((p) => p.month)
    );

    const unpaidUpToMonth = sched.items.filter(
      (item) => item.month <= month && !verifiedMonths.has(item.month)
    );
    if (unpaidUpToMonth.length > 0) {
      const lines = unpaidUpToMonth.map((item) => {
        const shortMonth = formatMonthLabel(item.month, 'en').replace(' 20', "' ");
        if (item.type === 'full') return 'Full Payment';
        if (item.type === 'first_month') return 'First Month Payment';
        return `${item.labelEn} (${shortMonth})`;
      });
      const dueSum = unpaidUpToMonth.reduce((s, x) => s + Number(x.amount || 0), 0);
      dueList.push({
        no: dueList.length + 1,
        name: m.fullName,
        batch: m.batch,
        paymentType: lines.join('\n'),
        dueAmount: dueSum,
      });
    }
  }

  const totalDue = dueList.reduce((sum, r) => sum + Number(r.dueAmount || 0), 0);

  const [yStr, mStr] = month.split('-');
  const monthDate = new Date(Number(yStr) || 2027, (Number(mStr) || 1) - 1, 1);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  await addAuditLog(
    'REPORT_GENERATED',
    `Generated Monthly Payment Report (${monthLabel} · ${batchLabel} · Paid ৳${totalPaid}, Due ৳${totalDue})`,
    req.admin.username
  );

  res.json({
    reportType: 'monthly_payment',
    generatedDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    month,
    monthLabel,
    batchLabel,
    totalPaid,
    totalDue,
    paidList,
    dueList,
    settings,
  });
});

// Admin Reset Demo
app.post('/api/admin/reset-demo', requireAdmin, async (req, res) => {
  await seedIfEmpty(true);
  await addAuditLog('DEMO_RESET', 'Admin reset database to initial demo records', req.admin.username);
  const [members, payments, plans, settings, auditLogs, notices] = await Promise.all([
    getAllMembers(),
    getAllPayments(),
    getPlans(),
    getSettings(),
    getAuditLogs(),
    getAllNotices(),
  ]);
  res.json({ members, payments, plans, settings, auditLogs, notices });
});

// Non-Vercel Node production server
if (!process.env.VERCEL) {
  const DIST_DIR = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  ensureDbReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `The Armanitolian's Club API (${isPostgres ? 'PostgreSQL' : 'SQLite'}) listening on http://localhost:${PORT}`
        );
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

export default app;
