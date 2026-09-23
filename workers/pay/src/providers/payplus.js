// PayPlus (Israel) connector: hosted payment page + signed callback.
//
// Written from PayPlus's public API reference, which could not be opened from the
// environment this was built in. Every line marked VERIFY must be checked
// against https://docs.payplus.co.il and exercised in the PayPlus sandbox
// (PAYPLUS_API_URL=https://restapidev.payplus.co.il/api/v1.0) before going live.
//
// Secrets (wrangler secret put): PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY.
// Vars: PAYPLUS_API_URL, PAYPLUS_PAYMENT_PAGE_UID.
const enc = new TextEncoder();

// Our method names -> PayPlus charge_default values. VERIFY names.
const CHARGE_DEFAULT = { card: 'credit-card', googlepay: 'google-pay', applepay: 'apple-pay', paypal: 'paypal' };

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const hmacBase64 = async (secret, body) => {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  let s = '';
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
};

const authHeaders = env => ({
  'Content-Type': 'application/json',
  'api-key': env.PAYPLUS_API_KEY,        // VERIFY header names
  'secret-key': env.PAYPLUS_SECRET_KEY,
});

// Decimal string amount ("1250.50") -> minor units, without float rounding.
const toMinor = value => {
  const m = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : NaN;
};

export default {
  checkoutHosts: () => ['payments.payplus.co.il', 'paymentsdev.payplus.co.il'],  // VERIFY

  async createCheckout(s, env) {
    const res = await fetch(`${env.PAYPLUS_API_URL}/PaymentPages/generateLink`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({
        payment_page_uid: env.PAYPLUS_PAYMENT_PAGE_UID,
        charge_method: 1,                                  // VERIFY: 1 = charge
        amount: (s.amountMinor / 100).toFixed(2),
        currency_code: s.currency,
        charge_default: CHARGE_DEFAULT[s.method],          // VERIFY: opens straight on this method
        more_info: s.ref,                                  // echoed back in the callback
        refURL_success: s.successUrl,
        refURL_failure: s.cancelUrl,
        refURL_cancel: s.cancelUrl,                        // VERIFY
        refURL_callback: s.callbackUrl,
        sendEmailApproval: true,
        sendEmailFailure: false,
        customer: { customer_name: s.name || s.invoice, email: s.email || undefined },
        items: [{ name: `Invoice ${s.invoice}`, quantity: 1, price: (s.amountMinor / 100).toFixed(2) }],
      }),
    });
    const data = await res.json().catch(() => null);
    const link = data?.data?.payment_page_link;           // VERIFY response shape
    if (!res.ok || !link) throw new Error(`PayPlus generateLink failed (${res.status})`);
    return link;
  },

  async verifyWebhook(request, raw, env) {
    // PayPlus signs the raw body: header "hash" = base64(HMAC-SHA256(secret key, body)). VERIFY
    const given = request.headers.get('hash') || '';
    if (!env.PAYPLUS_SECRET_KEY || !timingSafeEqual(given, await hmacBase64(env.PAYPLUS_SECRET_KEY, raw))) return null;
    let body;
    try { body = JSON.parse(raw); } catch { return null; }
    const t = body.transaction || {};                     // VERIFY payload shape
    return {
      ref: t.more_info,
      status: t.status_code === '000' ? 'paid' : 'failed', // VERIFY: 000 = approved
      amountMinor: toMinor(t.amount),
      currency: String(t.currency || '').toUpperCase(),
      transactionId: t.uid,
    };
  },

  hmacBase64,
};
