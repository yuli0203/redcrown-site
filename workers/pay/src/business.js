// Shared helpers: business identity, the ledger client, validation, payment links.
import { sign, toQuery, CURRENCIES, INVOICE_RE, MIN_MINOR, MAX_MINOR } from './links.js';

// The issuer printed on every document. OWNER_NAME and BUSINESS_ID (your
// עוסק פטור number) are Worker secrets, never in this public repository.
export function business(env) {
  const b = {
    tradingName: env.TRADING_NAME || 'Red Crown Interactive',
    ownerName: env.OWNER_NAME || '',
    businessId: env.BUSINESS_ID || '',
    address: env.BUSINESS_ADDRESS || '',
    email: env.BUSINESS_EMAIL || '',
    phone: env.BUSINESS_PHONE || '',
    website: (env.SITE_URL || 'https://redcrowninteractive.com').replace(/^https?:\/\//, ''),
  };
  const missing = ['ownerName', 'businessId', 'address', 'email'].filter(k => !b[k]);
  if (missing.length) throw Object.assign(new Error('business details not configured: ' + missing.join(', ')), { status: 503 });
  return b;
}

// Ledger client. In the Worker it calls the single Ledger Durable Object; tests
// pass an in-process LedgerCore as env.LEDGER_CORE.
export function ledger(env) {
  if (env.LEDGER_CORE) {
    return new Proxy({}, { get: (_, m) => async (...args) => env.LEDGER_CORE[m](...args) });
  }
  const stub = env.LEDGER.get(env.LEDGER.idFromName('main'));
  return new Proxy({}, { get: (_, m) => (...args) => stub.call(m, args) });
}

export const bytes = v => (v == null ? null : v instanceof Uint8Array ? v : new Uint8Array(v));

// Pay link for a payment request: the signature binds number, amount, currency and expiry.
export async function payUrl(env, request) {
  const signed = await sign({ invoice: request.number, amountMinor: request.amountMinor, currency: request.currency, expires: request.expires }, env.PAY_LINK_SECRET);
  return `${env.SITE_URL}/pay/?${toQuery(signed)}`;
}

// ---- Validation of admin input. Throws { status: 400 } with a readable message.
const bad = msg => Object.assign(new Error(msg), { status: 400 });
const str = (v, max, name, required = false) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} is too long (max ${max})`);
  return s;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function client(c = {}, { requireEmail = false } = {}) {
  const out = {
    name: str(c.name, 120, 'Client name', true),
    company: str(c.company, 160, 'Company'),
    taxId: str(c.taxId, 40, 'Tax ID'),
    address: str(c.address, 240, 'Client address', true),
    email: str(c.email, 254, 'Client email', requireEmail),
  };
  if (out.email && !EMAIL_RE.test(out.email)) throw bad('Client email is not valid');
  return out;
}

export function currency(c) {
  const cur = String(c || '').toUpperCase();
  if (!CURRENCIES.includes(cur)) throw bad('Currency must be one of ' + CURRENCIES.join(', '));
  return cur;
}

// "1250", "1250.5", "1,250.50" -> minor units, without float rounding.
export function toMinor(value, name = 'Amount') {
  const m = String(value ?? '').replace(/,/g, '').trim().match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!m) throw bad(`${name} must be a number like 1250 or 1250.50`);
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
}

export function items(list) {
  if (!Array.isArray(list) || !list.length || list.length > 30) throw bad('Add between 1 and 30 line items');
  return list.map((it, i) => {
    const quantity = Number(it.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || Math.round(quantity * 100) !== quantity * 100) {
      throw bad(`Line ${i + 1}: quantity must be positive, up to 2 decimals`);
    }
    const unitMinor = toMinor(it.unitPrice, `Line ${i + 1} price`);
    return { description: str(it.description, 300, `Line ${i + 1} description`, true), quantity, unitMinor, totalMinor: Math.round(unitMinor * quantity) };
  });
}

export function total(minor) {
  if (!Number.isSafeInteger(minor) || minor < MIN_MINOR || minor > MAX_MINOR) throw bad('Total must be between 1.00 and 1,000,000.00');
  return minor;
}

export const lang = l => (l === 'he' ? 'he' : 'en');
export { str, bad, INVOICE_RE };
