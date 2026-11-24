import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import {
  initialPlans,
  initialSettings,
  initialMembers,
  initialPayments,
} from '../src/data/seedData.js';

const PG_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.STORAGE_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.STORAGE_POSTGRES_URL ||
  Object.entries(process.env).find(
    ([k, v]) =>
      /postgres|neon|database|storage/i.test(k) && /^postgres(ql)?:\/\//i.test(String(v || ''))
  )?.[1] ||
  '';
export const isPostgres = Boolean(PG_URL);

let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  pgPool = new Pool({
    connectionString: PG_URL,
    ssl: PG_URL.includes('localhost') || PG_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
    max: 5,
  });
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const DATA_DIR = process.env.VERCEL
    ? '/tmp/armanitolian_data'
    : path.resolve(process.cwd(), 'server', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  sqliteDb = new DatabaseSync(path.join(DATA_DIR, 'armanitollian.db'));
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

let initPromise = null;

export function ensureDbReady() {
  if (!initPromise) {
    initPromise = initDatabase().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function initDatabase() {
  if (isPostgres) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'Super Admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        member_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        phone_normalized TEXT,
        data TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        month TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        data TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        seq SERIAL PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        time TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        details TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS payment_orders (
        order_id TEXT PRIMARY KEY,
        sp_order_id TEXT,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        batch TEXT,
        month TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        installment_label TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'initiated',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sms_logs (
        seq SERIAL PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        time TEXT NOT NULL,
        recipient_name TEXT,
        recipient_phone TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_response TEXT
      );
      CREATE TABLE IF NOT EXISTS otp_verifications (
        phone_normalized TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        verified INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS report_access_codes (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notices (
        seq SERIAL PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        attachment_name TEXT,
        attachment_type TEXT,
        attachment_data TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } else {
    sqliteDb.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'Super Admin',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        member_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        phone_normalized TEXT,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        month TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        details TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS payment_orders (
        order_id TEXT PRIMARY KEY,
        sp_order_id TEXT,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        batch TEXT,
        month TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        installment_label TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'initiated',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sms_logs (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        recipient_name TEXT,
        recipient_phone TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_response TEXT
      );
      CREATE TABLE IF NOT EXISTS otp_verifications (
        phone_normalized TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        verified INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS report_access_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        attachment_name TEXT,
        attachment_type TEXT,
        attachment_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  await seedIfEmpty(false);
}

async function getKv(key) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT value FROM kv_store WHERE key = $1', [key]);
    return res.rows[0]?.value ?? null;
  }
  const row = sqliteDb.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  return row?.value ?? null;
}

async function setKv(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (isPostgres) {
    await pgPool.query(
      'INSERT INTO kv_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, str]
    );
  } else {
    sqliteDb.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, str);
  }
}

export async function seedIfEmpty(forceReset = false) {
  // Admin account
  const adminCount = isPostgres
    ? Number((await pgPool.query('SELECT COUNT(*) as c FROM admins')).rows[0].c)
    : sqliteDb.prepare('SELECT COUNT(*) as c FROM admins').get().c;

  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Armanitola@1904';
    const hash = hashPassword(password);
    if (isPostgres) {
      await pgPool.query(
        'INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
        [username, hash, 'Super Admin']
      );
    } else {
      sqliteDb
        .prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)')
        .run(username, hash, 'Super Admin');
    }
  }

  // Plans
  const plansRaw = await getKv('plans');
  if (!plansRaw || forceReset) {
    await setKv(
      'plans',
      initialPlans.map((p) => ({ ...p, enabled: true }))
    );
  }

  // Settings
  const settingsRaw = await getKv('settings');
  if (!settingsRaw || forceReset) {
    await setKv('settings', initialSettings);
  } else {
    const cur = JSON.parse(settingsRaw);
    let dirty = false;
    if (cur.clubNameEn === 'Armanitollian Club') {
      cur.clubNameEn = "The Armanitolian's Club";
      cur.mottoEn = "An initiative of Armanitola Govt. High School's Ex-Students";
      cur.establishedText = 'Estd. 2025';
      dirty = true;
    }
    if (!cur.clubWebpage) {
      cur.clubWebpage = 'armanitolianclub.org';
      dirty = true;
    }
    if (dirty) await setKv('settings', cur);
  }

  // Encrypted Report Access Codes
  const codeCount = isPostgres
    ? Number((await pgPool.query('SELECT COUNT(*) as c FROM report_access_codes')).rows[0].c)
    : sqliteDb.prepare('SELECT COUNT(*) as c FROM report_access_codes').get().c;

  if (codeCount === 0) {
    const codes = [
      ['Primary Executive Code', '19042026'],
      ['Finance Committee Code', '19000212'],
      ['Secretariat Code', '20202026'],
    ];
    for (const [label, plain] of codes) {
      const hash = hashPassword(plain);
      if (isPostgres) {
        await pgPool.query('INSERT INTO report_access_codes (label, code_hash) VALUES ($1, $2)', [
          label,
          hash,
        ]);
      } else {
        sqliteDb
          .prepare('INSERT INTO report_access_codes (label, code_hash) VALUES (?, ?)')
          .run(label, hash);
      }
    }
  }

  // Initial Notice
  const noticeCount = isPostgres
    ? Number((await pgPool.query('SELECT COUNT(*) as c FROM notices')).rows[0].c)
    : sqliteDb.prepare('SELECT COUNT(*) as c FROM notices').get().c;

  if (noticeCount === 0) {
    await insertNotice({
      id: 'NTC-2026-001',
      date: '2026-11-24',
      title: "Welcome to The Armanitolian's Club Official Member Services Portal",
      description:
        'Alumni of Armanitola Govt. High School can now submit membership applications online, track approval status, pay monthly installments via ShurjoPay starting January 2027, and download verified fee progress reports.',
    });
  }

  // Members & Payments (seed only if completely empty or explicit Admin Reset Demo)
  const memberCount = isPostgres
    ? Number((await pgPool.query('SELECT COUNT(*) as c FROM members')).rows[0].c)
    : sqliteDb.prepare('SELECT COUNT(*) as c FROM members').get().c;

  if (memberCount === 0 || forceReset) {
    if (forceReset) {
      if (isPostgres) {
        await pgPool.query('DELETE FROM members; DELETE FROM payments; DELETE FROM audit_logs; DELETE FROM payment_orders;');
      } else {
        sqliteDb.exec('DELETE FROM members; DELETE FROM payments; DELETE FROM audit_logs; DELETE FROM payment_orders;');
      }
    }
    for (const m of initialMembers) {
      await upsertMember(m);
    }
    for (const p of initialPayments) {
      await upsertPayment(p);
    }
    await addAuditLog(
      'MEMBER_APPROVED',
      'Approved Dr. Debashish Roy (AC-1976-0005) as Lifetime Member',
      'General Secretary'
    );
    await addAuditLog(
      'PAYMENT_VERIFIED',
      'Verified First-Month Payment RCP-2027-8801 (৳5,000) for Mahmudul Hasan Chowdhury',
      'Treasurer'
    );
  }
}

// --- Admin Auth ---
export async function getAdminByUsername(username) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM admins WHERE username = $1', [username]);
    return res.rows[0] || null;
  }
  return sqliteDb.prepare('SELECT * FROM admins WHERE username = ?').get(username) || null;
}

export async function updateAdminPassword(id, passwordHash) {
  if (isPostgres) {
    await pgPool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  } else {
    sqliteDb.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  }
}

// --- Plans & Settings ---
export async function getPlans() {
  const raw = await getKv('plans');
  return raw ? JSON.parse(raw) : initialPlans.map((p) => ({ ...p, enabled: true }));
}

export async function savePlans(plans) {
  await setKv('plans', plans);
}

export async function getSettings() {
  const raw = await getKv('settings');
  return raw ? JSON.parse(raw) : initialSettings;
}

export async function saveSettings(settings) {
  await setKv('settings', settings);
}

// --- Members ---
export async function getAllMembers() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT data FROM members ORDER BY created_at DESC, id DESC');
    return res.rows.map((r) => JSON.parse(r.data));
  }
  return sqliteDb
    .prepare('SELECT data FROM members ORDER BY created_at DESC, id DESC')
    .all()
    .map((r) => JSON.parse(r.data));
}

export async function upsertMember(member) {
  const norm = normalizePhone(member.phone);
  const str = JSON.stringify(member);
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO members (id, member_id, status, phone_normalized, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         member_id = EXCLUDED.member_id,
         status = EXCLUDED.status,
         phone_normalized = EXCLUDED.phone_normalized,
         data = EXCLUDED.data`,
      [member.id, member.memberId || null, member.status, norm, str]
    );
  } else {
    sqliteDb
      .prepare(
        'INSERT OR REPLACE INTO members (id, member_id, status, phone_normalized, data) VALUES (?, ?, ?, ?, ?)'
      )
      .run(member.id, member.memberId || null, member.status, norm, str);
  }
}

// --- Payments ---
export async function getAllPayments() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT data FROM payments ORDER BY created_at DESC, id DESC');
    return res.rows.map((r) => JSON.parse(r.data));
  }
  return sqliteDb
    .prepare('SELECT data FROM payments ORDER BY created_at DESC, id DESC')
    .all()
    .map((r) => JSON.parse(r.data));
}

export async function upsertPayment(payment) {
  const str = JSON.stringify(payment);
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO payments (id, member_id, month, status, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         member_id = EXCLUDED.member_id,
         month = EXCLUDED.month,
         status = EXCLUDED.status,
         data = EXCLUDED.data`,
      [payment.id, payment.memberId, payment.month, payment.status, str]
    );
  } else {
    sqliteDb
      .prepare('INSERT OR REPLACE INTO payments (id, member_id, month, status, data) VALUES (?, ?, ?, ?, ?)')
      .run(payment.id, payment.memberId, payment.month, payment.status, str);
  }
}

// --- Payment Orders (ShurjoPay) ---
export async function createPaymentOrder(order) {
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO payment_orders (order_id, member_id, member_name, batch, month, payment_type, installment_label, amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'initiated')`,
      [
        order.orderId,
        order.memberId,
        order.memberName,
        order.batch,
        order.month,
        order.paymentType,
        order.installmentLabel,
        Number(order.amount),
      ]
    );
  } else {
    sqliteDb
      .prepare(
        `INSERT INTO payment_orders (order_id, member_id, member_name, batch, month, payment_type, installment_label, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'initiated')`
      )
      .run(
        order.orderId,
        order.memberId,
        order.memberName,
        order.batch,
        order.month,
        order.paymentType,
        order.installmentLabel,
        Number(order.amount)
      );
  }
}

export async function updatePaymentOrderSpId(orderId, spOrderId) {
  if (isPostgres) {
    await pgPool.query('UPDATE payment_orders SET sp_order_id = $1 WHERE order_id = $2', [
      spOrderId,
      orderId,
    ]);
  } else {
    sqliteDb
      .prepare('UPDATE payment_orders SET sp_order_id = ? WHERE order_id = ?')
      .run(spOrderId, orderId);
  }
}

export async function getPaymentOrder(spOrOrderId) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM payment_orders WHERE sp_order_id = $1 OR order_id = $2 LIMIT 1',
      [spOrOrderId, spOrOrderId]
    );
    return res.rows[0] || null;
  }
  return (
    sqliteDb
      .prepare('SELECT * FROM payment_orders WHERE sp_order_id = ? OR order_id = ?')
      .get(spOrOrderId, spOrOrderId) || null
  );
}

export async function updatePaymentOrderStatus(orderId, status) {
  if (isPostgres) {
    await pgPool.query('UPDATE payment_orders SET status = $1 WHERE order_id = $2', [
      status,
      orderId,
    ]);
  } else {
    sqliteDb.prepare('UPDATE payment_orders SET status = ? WHERE order_id = ?').run(status, orderId);
  }
}

// --- OTP ---
export async function saveOtp(normPhone, code, expiresAt) {
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO otp_verifications (phone_normalized, code, expires_at, verified, attempts)
       VALUES ($1, $2, $3, 0, 0)
       ON CONFLICT (phone_normalized) DO UPDATE SET
         code = EXCLUDED.code,
         expires_at = EXCLUDED.expires_at,
         verified = 0,
         attempts = 0`,
      [normPhone, code, expiresAt]
    );
  } else {
    sqliteDb
      .prepare(
        `INSERT OR REPLACE INTO otp_verifications (phone_normalized, code, expires_at, verified, attempts)
         VALUES (?, ?, ?, 0, 0)`
      )
      .run(normPhone, code, expiresAt);
  }
}

export async function getOtp(normPhone) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM otp_verifications WHERE phone_normalized = $1', [
      normPhone,
    ]);
    return res.rows[0] || null;
  }
  return (
    sqliteDb.prepare('SELECT * FROM otp_verifications WHERE phone_normalized = ?').get(normPhone) ||
    null
  );
}

export async function incrementOtpAttempts(normPhone) {
  if (isPostgres) {
    await pgPool.query(
      'UPDATE otp_verifications SET attempts = attempts + 1 WHERE phone_normalized = $1',
      [normPhone]
    );
  } else {
    sqliteDb
      .prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE phone_normalized = ?')
      .run(normPhone);
  }
}

export async function markOtpVerified(normPhone) {
  if (isPostgres) {
    await pgPool.query('UPDATE otp_verifications SET verified = 1 WHERE phone_normalized = $1', [
      normPhone,
    ]);
  } else {
    sqliteDb
      .prepare('UPDATE otp_verifications SET verified = 1 WHERE phone_normalized = ?')
      .run(normPhone);
  }
}

// --- Audit Logs ---
export async function addAuditLog(action, details, actor = 'Club Admin') {
  const id = `LOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
  if (isPostgres) {
    await pgPool.query(
      'INSERT INTO audit_logs (id, time, action, actor, details) VALUES ($1, $2, $3, $4, $5)',
      [id, time, action, actor, details]
    );
  } else {
    sqliteDb
      .prepare('INSERT INTO audit_logs (id, time, action, actor, details) VALUES (?, ?, ?, ?, ?)')
      .run(id, time, action, actor, details);
  }
}

export async function getAuditLogs() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT id, time, action, actor, details FROM audit_logs ORDER BY seq DESC LIMIT 150');
    return res.rows;
  }
  return sqliteDb.prepare('SELECT * FROM audit_logs ORDER BY rowid DESC LIMIT 150').all();
}

// --- SMS Logs ---
export async function addSmsLog({ recipientName, recipientPhone, triggerType, message, status, providerResponse }) {
  const id = `SMS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const resp = String(providerResponse || '').slice(0, 300);
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO sms_logs (id, time, recipient_name, recipient_phone, trigger_type, message, status, provider_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, time, recipientName || '', recipientPhone || '', triggerType || 'MANUAL', message || '', status || 'sent', resp]
    );
  } else {
    sqliteDb
      .prepare(
        `INSERT INTO sms_logs (id, time, recipient_name, recipient_phone, trigger_type, message, status, provider_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, time, recipientName || '', recipientPhone || '', triggerType || 'MANUAL', message || '', status || 'sent', resp);
  }
  return id;
}

export async function getSmsLogs() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM sms_logs ORDER BY seq DESC LIMIT 150');
    return res.rows;
  }
  return sqliteDb.prepare('SELECT * FROM sms_logs ORDER BY rowid DESC LIMIT 150').all();
}

// --- Report Access Codes ---
export async function verifyReportAccessCode(plainCode) {
  const rows = isPostgres
    ? (await pgPool.query('SELECT id, label, code_hash FROM report_access_codes')).rows
    : sqliteDb.prepare('SELECT id, label, code_hash FROM report_access_codes').all();
  for (const row of rows) {
    if (verifyPassword(String(plainCode || '').trim(), row.code_hash)) {
      return { valid: true, label: row.label };
    }
  }
  return { valid: false, label: null };
}

// --- Notices (Strict LIFO Order) ---
export async function getAllNotices() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM notices ORDER BY seq DESC');
    return res.rows;
  }
  return sqliteDb.prepare('SELECT * FROM notices ORDER BY rowid DESC').all();
}

export async function insertNotice(notice) {
  if (isPostgres) {
    await pgPool.query(
      `INSERT INTO notices (id, date, title, description, attachment_name, attachment_type, attachment_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        notice.id,
        notice.date,
        notice.title,
        notice.description,
        notice.attachmentName || null,
        notice.attachmentType || null,
        notice.attachmentData || null,
      ]
    );
  } else {
    sqliteDb
      .prepare(
        `INSERT INTO notices (id, date, title, description, attachment_name, attachment_type, attachment_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notice.id,
        notice.date,
        notice.title,
        notice.description,
        notice.attachmentName || null,
        notice.attachmentType || null,
        notice.attachmentData || null
      );
  }
}

export async function deleteNoticeById(id) {
  if (isPostgres) {
    await pgPool.query('DELETE FROM notices WHERE id = $1', [id]);
  } else {
    sqliteDb.prepare('DELETE FROM notices WHERE id = ?').run(id);
  }
}
