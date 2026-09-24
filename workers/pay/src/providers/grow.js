// Grow (formerly Meshulam) connector: Grow's hosted payment page, and Grow's
// own receipts. Written from Grow's Light API reference
// (https://developers.grow.business); check each step in Grow's sandbox before
// asking Grow for production identifiers.
//
//   createCheckout  createPaymentProcess -> Grow's payment page URL. Each payment
//                   method has its own page code (card, Bit, Apple Pay, Google
//                   Pay); only the methods with a page code are offered.
//   verifyWebhook   Grow's server update (notifyUrl) is not signed, so it is only
//                   a trigger: the payment is confirmed by asking Grow directly
//                   (getPaymentProcessInfo, with the process token only we and
//                   Grow know), then acknowledged with approveTransaction.
//   capture         the same confirmation when the client returns (successUrl).
//
// Grow charges the card on its own page, so there is no separate capture step
// to hold back, and Grow issues the receipt (issuesReceipts): our system then
// records the payment but issues no receipt of its own. Grow charges in shekels
// only.
//
// Secrets (wrangler secret put): GROW_USER_ID, GROW_PAGE_CODE (card), and
// optionally GROW_PAGE_CODE_BIT, GROW_PAGE_CODE_APPLEPAY, GROW_PAGE_CODE_GOOGLEPAY.
// Var: GROW_API_URL (sandbox https://sandbox.meshulam.co.il/api/light/server/1.0,
// live https://secure.meshulam.co.il/api/light/server/1.0).

const PAGE_CODES = { card: 'GROW_PAGE_CODE', bit: 'GROW_PAGE_CODE_BIT', applepay: 'GROW_PAGE_CODE_APPLEPAY', googlepay: 'GROW_PAGE_CODE_GOOGLEPAY' };
// Grow's transactionTypeId -> our method names.
const TYPES = { 1: 'card', 6: 'bit', 13: 'applepay', 14: 'googlepay', 15: 'bank' };
const PAID = '2';

// Grow asks for no "special characters" in any field: keep letters (Hebrew
// included), digits, spaces and plain punctuation.
export const clean = (s, max = 120) => String(s ?? '').replace(/[^\p{L}\p{N} .,:()\/-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Decimal string ("1250.5") -> minor units, without float rounding.
const toMinor = value => {
  const m = String(value ?? '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : NaN;
};
const decimal = minor => (minor / 100).toFixed(2);

// Israeli mobile number in Grow's format (0501234567), or '' if it is not one.
export const israeliMobile = phone => {
  const d = String(phone ?? '').replace(/[\s().-]/g, '').replace(/^\+?972/, '0');
  return /^05\d{8}$/.test(d) ? d : '';
};

const api = async (env, method, fields) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') form.append(k, String(v));
  const res = await fetch(`${env.GROW_API_URL}/${method}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || String(data.status) !== '1') {
    throw new Error(`Grow ${method} failed (${res.status}${data?.err?.id ? `, error ${data.err.id}` : ''})`);
  }
  return data.data;
};

// Grow's server update arrives as form fields (data[transactionId]=...), or as
// JSON in some examples; either way -> a flat object.
async function readNotification(request, raw) {
  const type = request.headers.get('Content-Type') || '';
  let entries;
  if (type.includes('json')) {
    try {
      const body = JSON.parse(raw);
      const data = Array.isArray(body) ? body[0] : body?.data && typeof body.data === 'object' ? body.data : body;
      entries = Object.entries(data || {});
    } catch { return {}; }
  } else if (type.includes('multipart/form-data')) {
    entries = [...(await new Response(raw, { headers: { 'Content-Type': type } }).formData()).entries()];
  } else {
    entries = [...new URLSearchParams(raw).entries()];
  }
  return Object.fromEntries(entries.map(([k, v]) => [k.replace(/^data\[(.+)\]$/, '$1'), typeof v === 'string' ? v : String(v)]));
}

// Asks Grow for the process's paid transaction -> our event shape, or null.
async function confirm(session, env) {
  const info = await api(env, 'getPaymentProcessInfo', { pageCode: session.pageCode, processId: session.providerRef, processToken: session.providerToken });
  const tx = (info?.transactions || []).find(t => String(t.statusCode) === PAID);
  if (!tx) return null;
  const optional = { payerName: tx.fullName, payerEmail: tx.payerEmail, cardSuffix: tx.cardSuffix, asmachta: tx.asmachta };
  return {
    status: 'paid',
    amountMinor: toMinor(tx.sum),
    currency: 'ILS',
    transactionId: String(tx.transactionId || ''),
    paidWith: TYPES[tx.transactionTypeId] || 'other',
    ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v)),
    tx,
  };
}

// Tells Grow we received the server update: all the fields it sent, as it
// sent them, plus the page code.
async function approve(session, env, tx) {
  const fields = ['transactionId', 'transactionToken', 'transactionTypeId', 'paymentType', 'sum', 'firstPaymentSum',
    'periodicalPaymentSum', 'paymentsNum', 'allPaymentsNum', 'paymentDate', 'asmachta', 'description', 'fullName',
    'payerPhone', 'payerEmail', 'cardSuffix', 'cardType', 'cardTypeCode', 'cardBrand', 'cardBrandCode', 'cardExp',
    'processId', 'processToken'];
  await api(env, 'approveTransaction', {
    pageCode: session.pageCode,
    ...Object.fromEntries(fields.map(k => [k, tx[k]]).filter(([, v]) => v != null)),
  });
}

export default {
  issuesReceipts: true,
  chargesOnPage: true,
  currencies: ['ILS'],
  label: 'Grow',
  methods: env => Object.keys(PAGE_CODES).filter(m => env[PAGE_CODES[m]]),
  checkoutHosts: env => (String(env.GROW_API_URL).includes('sandbox') ? ['sandbox.meshulam.co.il'] : ['secure.meshulam.co.il', 'meshulam.co.il']),

  async createCheckout(s, env) {
    const pageCode = env[PAGE_CODES[s.method]];
    if (!pageCode || !env.GROW_USER_ID) throw new Error(`Grow page code for ${s.method} is not configured`);
    const c = s.client || {};
    const name = clean(c.name, 60);
    const fields = {
      pageCode,
      userId: env.GROW_USER_ID,
      chargeType: 1,
      sum: decimal(s.amountMinor),
      description: clean(s.description, 100) || `Payment request ${s.invoice}`,
      successUrl: s.returnUrl,
      cancelUrl: s.cancelUrl,
      notifyUrl: s.callbackUrl,
      invoiceNotifyUrl: s.callbackUrl + '&document=1',
      // Grow's page asks for anything missing; a name must have two words.
      'pageField[fullName]': name.includes(' ') ? name : '',
      'pageField[phone]': israeliMobile(c.phone),
      'pageField[email]': c.email || '',
      'pageField[invoiceName]': clean(c.company || c.name, 100),
      'pageField[invoiceLicenseNumber]': clean(c.taxId, 20),
      cField1: s.ref,
    };
    // Receipt lines: each line item as one unit at its line total, so the lines
    // add up to the sum exactly (Grow rejects a mismatch).
    (s.items || []).forEach((it, i) => {
      const qty = Number(it.quantity) === 1 ? '' : ` (${it.quantity} x ${decimal(it.unitMinor)})`;
      fields[`productData[${i}][itemDescription]`] = clean(it.description, 90 - qty.length) + qty;
      fields[`productData[${i}][quantity]`] = 1;
      fields[`productData[${i}][price]`] = decimal(it.totalMinor ?? Math.round(it.unitMinor * it.quantity));
    });
    const data = await api(env, 'createPaymentProcess', fields);
    if (!data?.url || !data.processId || !data.processToken) throw new Error('Grow createPaymentProcess: no payment page URL');
    return { url: data.url, providerRef: String(data.processId), providerToken: String(data.processToken), pageCode };
  },

  // The client is back from Grow's page: ask Grow whether it was paid.
  async capture(session, env) {
    return confirm(session, env);
  },

  // Grow's server update (or, with ?document=1, its receipt notice). `session`
  // is the checkout named in the notify URL; nothing in the body is trusted.
  async verifyWebhook(request, raw, env, session) {
    if (!session?.providerRef || !session.providerToken) return null;
    const url = new URL(request.url);
    const body = await readNotification(request, raw);
    if (body.processId && String(body.processId) !== session.providerRef) return null;
    if (url.searchParams.get('document') === '1') {
      const number = clean(body.invoiceNumber, 30);
      const link = /^https:\/\/([a-z0-9-]+\.)*meshulam\.co\.il\//.test(body.invoiceUrl || '') ? body.invoiceUrl : '';
      return number ? { status: 'document', document: { number, url: link } } : { status: 'ignored' };
    }
    const event = await confirm(session, env);
    if (!event) return { status: 'ignored' };
    try {
      await approve(session, env, { ...event.tx, processId: session.providerRef, processToken: session.providerToken });
    } catch (e) {
      console.error('Grow approveTransaction failed', e.message);   // Grow resends the update; the payment stands
    }
    return event;
  },

  toMinor,
};
