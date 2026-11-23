/**
 * ShurjoPay v2 Payment Gateway Integration (Sandbox & Live)
 * Docs: https://shurjopay.com.bd
 */

function getConfig() {
  const mode = (process.env.SHURJOPAY_MODE || 'sandbox').toLowerCase();
  const baseUrl =
    mode === 'live'
      ? process.env.SHURJOPAY_LIVE_URL || 'https://engine.shurjopayment.com'
      : process.env.SHURJOPAY_SANDBOX_URL || 'https://sandbox.shurjopayment.com';

  return {
    mode,
    baseUrl: baseUrl.replace(/\/$/, ''),
    username: process.env.SHURJOPAY_USERNAME || 'sp_sandbox',
    password: process.env.SHURJOPAY_PASSWORD || 'pyyk97hu&6u6',
    prefix: process.env.SHURJOPAY_PREFIX || 'NOK',
  };
}

export async function getShurjoPayToken() {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}/api/get_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: cfg.username,
      password: cfg.password,
    }),
  });

  if (!res.ok) {
    throw new Error(`ShurjoPay token request failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.token) {
    throw new Error(data?.message || 'ShurjoPay did not return an auth token');
  }
  return { ...data, cfg };
}

function formatBdPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return `0${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 10) return `0${digits}`;
  return '01700000000';
}

function formatIpv4(ip = '') {
  const cleaned = String(ip).replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) return cleaned;
  return '127.0.0.1';
}

export async function initiateShurjoPayCheckout({
  orderId,
  amount,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  returnUrl,
  cancelUrl,
  clientIp = '127.0.0.1',
}) {
  const tokenData = await getShurjoPayToken();
  const { cfg } = tokenData;

  const payload = {
    prefix: cfg.prefix,
    token: tokenData.token,
    store_id: tokenData.store_id,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    amount: Number(amount),
    order_id: orderId,
    currency: 'BDT',
    customer_name: customerName || 'Armanitollian Member',
    customer_address: customerAddress || 'Armanitola, Dhaka',
    customer_email: customerEmail || 'member@armanitollianclub.org',
    customer_phone: formatBdPhone(customerPhone),
    customer_city: 'Dhaka',
    customer_post_code: '1100',
    client_ip: formatIpv4(clientIp),
    value1: orderId,
  };

  const executeUrl = tokenData.execute_url || `${cfg.baseUrl}/api/secret-pay`;
  const res = await fetch(executeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data?.checkout_url) {
    throw new Error(data?.message || 'ShurjoPay checkout initiation failed');
  }

  return {
    checkoutUrl: data.checkout_url,
    spOrderId: data.sp_order_id,
    mode: cfg.mode,
  };
}

export async function verifyShurjoPayOrder(spOrderId) {
  const tokenData = await getShurjoPayToken();
  const { cfg } = tokenData;

  const res = await fetch(`${cfg.baseUrl}/api/verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
    },
    body: JSON.stringify({ order_id: spOrderId }),
  });

  const data = await res.json();
  const record = Array.isArray(data) ? data[0] : data;
  const success =
    record &&
    (String(record.sp_code) === '1000' ||
      String(record.bank_status || '').toLowerCase() === 'success');

  return {
    success: Boolean(success),
    record,
    mode: cfg.mode,
  };
}
