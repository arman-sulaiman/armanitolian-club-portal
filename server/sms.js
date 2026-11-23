/**
 * GreenWeb BD Bulk SMS Integration (https://api.bdbulksms.net/api.php)
 */

const DEFAULT_TOKEN = '103040932011795404721030febb56d86657212560efcc977b285';
const DEFAULT_SENDER_ID = '8809617621831';

export function formatSmsPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('01')) return `+88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `+880${digits}`;
  return digits ? `+88${digits}` : '';
}

export async function sendGreenWebSms({ to, message }) {
  const token = process.env.GREENWEB_SMS_TOKEN || DEFAULT_TOKEN;
  const senderId = process.env.GREENWEB_SENDER_ID || DEFAULT_SENDER_ID;
  const enabled = String(process.env.GREENWEB_SMS_ENABLED || 'true').toLowerCase() !== 'false';

  const recipients = (Array.isArray(to) ? to : [to])
    .map(formatSmsPhone)
    .filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, providerResponse: 'No valid recipient phone number', recipients: [] };
  }

  if (!token || !enabled) {
    return {
      ok: false,
      providerResponse: 'GreenWeb SMS disabled or token missing',
      recipients,
    };
  }

  const params = new URLSearchParams();
  params.append('token', token);
  params.append('to', recipients.join(','));
  params.append('message', String(message || '').trim());
  if (senderId) {
    params.append('senderid', senderId);
  }

  try {
    const res = await fetch('https://api.bdbulksms.net/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    const ok = res.ok && !text.toLowerCase().includes('error') && !text.toLowerCase().includes('invalid');
    return {
      ok,
      status: res.status,
      providerResponse: text.trim(),
      recipients,
    };
  } catch (err) {
    return {
      ok: false,
      providerResponse: err.message || 'Network error contacting GreenWeb SMS',
      recipients,
    };
  }
}
