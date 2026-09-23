// Signed payment links.
//
// A link carries the invoice, the amount in minor units, the currency and an
// expiry, plus an HMAC-SHA256 signature over all four made with PAY_LINK_SECRET.
// Changing any value breaks the signature, so the amount a client pays is the
// amount we signed. The secret lives only in the Worker (as a secret) and on the
// machine that creates links; it is never committed.
//
//   https://redcrowninteractive.com/pay/?i=RC-2026-014&a=125000&c=USD&x=1767225600&s=...
//
// Uses only Web Crypto, so the same file runs in the Worker and in Node.

export const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];
export const INVOICE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
export const MIN_MINOR = 100;          // 1.00
export const MAX_MINOR = 100000000;    // 1,000,000.00

const enc = new TextEncoder();

const b64url = bytes => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = str => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

const key = secret => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('PAY_LINK_SECRET must be at least 32 characters');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
};

const canonical = ({ invoice, amountMinor, currency, expires }) =>
  ['v1', invoice, amountMinor, currency, expires].join('\n');

// Returns the normalized fields, or throws with a reason.
export const validateFields = ({ invoice, amountMinor, currency, expires }) => {
  invoice = String(invoice ?? '').toUpperCase();
  currency = String(currency ?? '').toUpperCase();
  const a = Number(amountMinor), x = Number(expires);
  if (!INVOICE_RE.test(invoice)) throw new Error('invalid invoice');
  if (!Number.isSafeInteger(a) || a < MIN_MINOR || a > MAX_MINOR) throw new Error('invalid amount');
  if (!CURRENCIES.includes(currency)) throw new Error('invalid currency');
  if (!Number.isSafeInteger(x) || x <= 0) throw new Error('invalid expiry');
  return { invoice, amountMinor: a, currency, expires: x };
};

export const sign = async (fields, secret) => {
  const f = validateFields(fields);
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(canonical(f)));
  return { ...f, signature: b64url(sig) };
};

// Link query params (i, a, c, x, s) -> verified fields, or null. Constant-time
// comparison comes from crypto.subtle.verify.
export const verify = async (params, secret, now = Date.now()) => {
  try {
    const f = validateFields({ invoice: params.i, amountMinor: params.a, currency: params.c, expires: params.x });
    if (typeof params.s !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(params.s)) return null;
    const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(params.s), enc.encode(canonical(f)));
    if (!ok) return null;
    if (f.expires * 1000 < now) return { ...f, expired: true };
    return { ...f, expired: false };
  } catch {
    return null;
  }
};

export const toQuery = ({ invoice, amountMinor, currency, expires, signature }) =>
  new URLSearchParams({ i: invoice, a: String(amountMinor), c: currency, x: String(expires), s: signature }).toString();
