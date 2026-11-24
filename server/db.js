import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  initialPlans,
  initialSettings,
  initialMembers,
  initialPayments,
} from '../src/data/seedData.js';

const DATA_DIR = process.env.VERCEL
  ? '/tmp/armanitolian_data'
  : path.resolve(process.cwd(), 'server', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'armanitollian.db');
export const db = new DatabaseSync(DB_PATH);

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

export function initDatabase() {
  db.exec(`
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

  seedIfEmpty();
}

export function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function seedIfEmpty(forceReset = false) {
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Armanitola@1904';
    db.prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)').run(
      username,
      hashPassword(password),
      'Super Admin'
    );
  }

  const plansRow = db.prepare("SELECT value FROM kv_store WHERE key = 'plans'").get();
  if (!plansRow || forceReset) {
    const enrichedPlans = initialPlans.map((p) => ({ ...p, enabled: true }));
    db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(
      'plans',
      JSON.stringify(enrichedPlans)
    );
  }

  const settingsRow = db.prepare("SELECT value FROM kv_store WHERE key = 'settings'").get();
  if (!settingsRow || forceReset) {
    db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(
      'settings',
      JSON.stringify(initialSettings)
    );
  } else {
    // Ensure updated club name & clubWebpage exist on existing databases
    const cur = JSON.parse(settingsRow.value);
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
    if (dirty) {
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(
        'settings',
        JSON.stringify(cur)
      );
    }
  }

  // Seed encrypted Report Access Codes if empty
  const codeCount = db.prepare('SELECT COUNT(*) as c FROM report_access_codes').get().c;
  if (codeCount === 0) {
    const insertCode = db.prepare('INSERT INTO report_access_codes (label, code_hash) VALUES (?, ?)');
    insertCode.run('Primary Executive Code', hashPassword('19042026'));
    insertCode.run('Finance Committee Code', hashPassword('19000212'));
    insertCode.run('Secretariat Code', hashPassword('20202026'));
  }

  // Seed initial welcome notice if empty
  const noticeCount = db.prepare('SELECT COUNT(*) as c FROM notices').get().c;
  if (noticeCount === 0) {
    db.prepare(
      `INSERT INTO notices (id, date, title, description, attachment_name, attachment_type, attachment_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'NTC-2026-001',
      '2026-11-24',
      "Welcome to The Armanitolian's Club Official Member Services Portal",
      "Alumni of Armanitola Govt. High School can now submit membership applications online, track approval status, pay monthly installments via ShurjoPay starting January 2027, and download verified fee progress reports.",
      null,
      null,
      null
    );
  }

  const memberCount = db.prepare('SELECT COUNT(*) as c FROM members').get().c;
  if (memberCount === 0 || forceReset) {
    if (forceReset) {
      db.exec('DELETE FROM members; DELETE FROM payments; DELETE FROM audit_logs; DELETE FROM payment_orders;');
    }
    const insertMember = db.prepare(
      'INSERT OR REPLACE INTO members (id, member_id, status, phone_normalized, data) VALUES (?, ?, ?, ?, ?)'
    );
    for (const m of initialMembers) {
      insertMember.run(m.id, m.memberId || null, m.status, normalizePhone(m.phone), JSON.stringify(m));
    }

    const insertPayment = db.prepare(
      'INSERT OR REPLACE INTO payments (id, member_id, month, status, data) VALUES (?, ?, ?, ?, ?)'
    );
    for (const p of initialPayments) {
      insertPayment.run(p.id, p.memberId, p.month, p.status, JSON.stringify(p));
    }

    const insertLog = db.prepare(
      'INSERT OR REPLACE INTO audit_logs (id, time, action, actor, details) VALUES (?, ?, ?, ?, ?)'
    );
    insertLog.run(
      'LOG-1001',
      '2027-01-02 10:15',
      'MEMBER_APPROVED',
      'General Secretary',
      'Approved Dr. Debashish Roy (AC-1976-0005) as Lifetime Member'
    );
    insertLog.run(
      'LOG-1002',
      '2027-01-04 14:40',
      'PAYMENT_VERIFIED',
      'Treasurer',
      'Verified First-Month Payment RCP-2027-8801 (৳5,000) for Mahmudul Hasan Chowdhury'
    );
  }
}

export function getPlans() {
  const row = db.prepare("SELECT value FROM kv_store WHERE key = 'plans'").get();
  return row ? JSON.parse(row.value) : initialPlans.map((p) => ({ ...p, enabled: true }));
}

export function savePlans(plans) {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(
    'plans',
    JSON.stringify(plans)
  );
}

export function getSettings() {
  const row = db.prepare("SELECT value FROM kv_store WHERE key = 'settings'").get();
  return row ? JSON.parse(row.value) : initialSettings;
}

export function saveSettings(settings) {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(
    'settings',
    JSON.stringify(settings)
  );
}

export function getAllMembers() {
  const rows = db.prepare('SELECT data FROM members ORDER BY created_at DESC, id DESC').all();
  return rows.map((r) => JSON.parse(r.data));
}

export function upsertMember(member) {
  db.prepare(
    'INSERT OR REPLACE INTO members (id, member_id, status, phone_normalized, data) VALUES (?, ?, ?, ?, ?)'
  ).run(
    member.id,
    member.memberId || null,
    member.status,
    normalizePhone(member.phone),
    JSON.stringify(member)
  );
}

export function getAllPayments() {
  const rows = db.prepare('SELECT data FROM payments ORDER BY created_at DESC, id DESC').all();
  return rows.map((r) => JSON.parse(r.data));
}

export function upsertPayment(payment) {
  db.prepare(
    'INSERT OR REPLACE INTO payments (id, member_id, month, status, data) VALUES (?, ?, ?, ?, ?)'
  ).run(payment.id, payment.memberId, payment.month, payment.status, JSON.stringify(payment));
}

export function addAuditLog(action, details, actor = 'Club Admin') {
  const id = `LOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
  db.prepare('INSERT INTO audit_logs (id, time, action, actor, details) VALUES (?, ?, ?, ?, ?)').run(
    id,
    time,
    action,
    actor,
    details
  );
}

export function getAuditLogs() {
  return db.prepare('SELECT * FROM audit_logs ORDER BY time DESC, id DESC LIMIT 150').all();
}

export function addSmsLog({ recipientName, recipientPhone, triggerType, message, status, providerResponse }) {
  const id = `SMS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  const time = new Date().toISOString().replace('T', ' ').slice(0, 16);
  db.prepare(
    `INSERT INTO sms_logs (id, time, recipient_name, recipient_phone, trigger_type, message, status, provider_response)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    time,
    recipientName || '',
    recipientPhone || '',
    triggerType || 'MANUAL',
    message || '',
    status || 'sent',
    String(providerResponse || '').slice(0, 300)
  );
  return id;
}

export function getSmsLogs() {
  return db.prepare('SELECT * FROM sms_logs ORDER BY time DESC, id DESC LIMIT 150').all();
}

export function verifyReportAccessCode(plainCode) {
  const rows = db.prepare('SELECT id, label, code_hash FROM report_access_codes').all();
  for (const row of rows) {
    if (verifyPassword(String(plainCode || '').trim(), row.code_hash)) {
      return { valid: true, label: row.label };
    }
  }
  return { valid: false, label: null };
}

export function getAllNotices() {
  return db.prepare('SELECT * FROM notices ORDER BY rowid DESC').all();
}

export function insertNotice(notice) {
  db.prepare(
    `INSERT INTO notices (id, date, title, description, attachment_name, attachment_type, attachment_data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    notice.id,
    notice.date,
    notice.title,
    notice.description,
    notice.attachmentName || null,
    notice.attachmentType || null,
    notice.attachmentData || null
  );
}

export function deleteNoticeById(id) {
  db.prepare('DELETE FROM notices WHERE id = ?').run(id);
}
