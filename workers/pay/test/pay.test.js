import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import forge from 'node-forge';
import { sign, verify, toQuery } from '../src/links.js';
import worker from '../src/index.js';
import { LedgerCore } from '../src/ledger.js';
import { visual } from '../src/bidi.js';
import mock from '../src/providers/mock.js';
import payplus from '../src/providers/payplus.js';
import paypal from '../src/providers/paypal.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const ADMIN = 'admin-token-that-is-at-least-32-characters';
const ORIGIN = 'https://redcrowninteractive.com';
const API = 'https://pay-api.test';
const future = () => Math.floor(Date.now() / 1000) + 3600;

// ---- Test doubles: SQLite ledger, KV, Resend, waitUntil.
const sqliteLedger = () => {
  const db = new DatabaseSync(':memory:');
  return new LedgerCore({
    all: (sql, ...p) => db.prepare(sql).all(...p),
    run: (sql, ...p) => { db.prepare(sql).run(...p); },
  });
};
const kv = () => {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, map: m };
};
const envFor = (extra = {}) => ({
  PAY_LINK_SECRET: SECRET, ADMIN_TOKEN: ADMIN, PROVIDER: 'mock', ENVIRONMENT: 'test', MOCK_WEBHOOK_SECRET: 'hook-secret',
  ALLOWED_ORIGIN: ORIGIN, SITE_URL: ORIGIN, PAYMENTS: kv(), LEDGER_CORE: sqliteLedger(),
  OWNER_NAME: 'Julia Pavlov / יוליה פבלוב', BUSINESS_ID: '000000018', BUSINESS_ADDRESS: 'Gutwirth Science Park, Haifa',
  BUSINESS_EMAIL: 'hello@redcrowninteractive.com', TRADING_NAME: 'Red Crown Interactive',
  RESEND_API_KEY: 're_test', NOTIFY_FROM: 'Payments <payments@redcrowninteractive.com>', NOTIFY_TO: 'hello@redcrowninteractive.com',
  BOI_RATES: 'off', ...extra,
});

let mailbox = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://api.resend.com/emails') { mailbox.push(JSON.parse(init.body)); return new Response('{"id":"x"}', { status: 200 }); }
  return realFetch(url, init);
};
const pdfOf = attachment => Buffer.from(attachment.content, 'base64');

// Runs a request and waits for its after-response work (receipts, emails).
const call = async (env, request) => {
  const pending = [];
  const res = await worker.fetch(request, env, { waitUntil: p => pending.push(p) });
  await Promise.all(pending);
  return res;
};
const post = (path, body, headers = {}) => new Request(API + path, {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
});
const adminCall = (env, path, body, token = ADMIN) => call(env, new Request(API + '/admin/api/' + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { Authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  body: body === undefined ? undefined : JSON.stringify(body),
}));

const client = { name: 'ד"ר דנה לוי', company: 'Acme Labs', taxId: '514000000', address: 'HaAliya 8, Haifa', email: 'dana@acme.test' };
const newRequest = async (env, over = {}) => {
  const res = await adminCall(env, 'requests', {
    lang: 'he', currency: 'USD', validDays: 30, notes: 'תודה!', send: true, client,
    items: [{ description: 'סימולציית VR, שלב 1', quantity: 1, unitPrice: '1000' }, { description: 'QA hours', quantity: '10', unitPrice: '25' }],
    ...over,
  });
  assert.equal(res.status, 200, await res.clone().text());
  const out = await res.json();
  return { ...out, link: Object.fromEntries(new URL(out.payUrl).searchParams) };
};
const checkout = (env, body, headers) => call(env, post('/checkout', body, headers));
const openCheckout = async (env, link, extra = {}) => {
  const res = await checkout(env, { link, method: 'card', ...extra });
  assert.equal(res.status, 200, await res.clone().text());
  const { url, ref } = await res.json();
  return { ref, token: new URL(url).searchParams.get('token') };
};
const returnFrom = (env, c) => call(env, new Request(`${API}/return/mock?ref=${c.ref}&token=${c.token}`));
const statusOf = async (env, ref) => (await (await call(env, new Request(API + '/status?ref=' + ref))).json()).status;
const hook = async (env, event) => {
  const raw = JSON.stringify(event);
  return call(env, post('/webhook/mock', raw, { 'x-mock-signature': await mock.hmacHex('hook-secret', raw) }));
};

// A self-signed PKCS#12 certificate standing in for the real one.
const testP12 = () => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(); cert.validity.notAfter = new Date(Date.now() + 864e5);
  const attrs = [{ name: 'commonName', value: 'Test Signer' }];
  cert.setSubject(attrs); cert.setIssuer(attrs); cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' })).getBytes();
  return Buffer.from(der, 'binary').toString('base64');
};

// ---------------------------------------------------------------------------

test('links: round trip, tampering, wrong secret, expiry', async () => {
  const s = await sign({ invoice: 'PR-0001', amountMinor: 125000, currency: 'USD', expires: future() }, SECRET);
  const p = Object.fromEntries(new URLSearchParams(toQuery(s)));
  assert.equal((await verify(p, SECRET)).amountMinor, 125000);
  assert.equal(await verify({ ...p, a: '100' }, SECRET), null);
  assert.equal(await verify({ ...p, c: 'EUR' }, SECRET), null);
  assert.equal(await verify({ ...p, i: 'PR-0002' }, SECRET), null);
  assert.equal(await verify(p, SECRET.replace('t', 'T')), null);
  const old = await sign({ invoice: 'PR-0001', amountMinor: 125000, currency: 'USD', expires: 1000 }, SECRET);
  assert.equal((await verify(Object.fromEntries(new URLSearchParams(toQuery(old))), SECRET)).expired, true);
  await assert.rejects(sign({ invoice: 'PR-1', amountMinor: 100, currency: 'USD', expires: future() }, 'short'));
});

test('full flow: request emailed, client pays by card, receipt issued, client and owner emailed', async () => {
  mailbox = [];
  const env = envFor();
  const pr = await newRequest(env);
  assert.equal(pr.number, 'PR-0001');
  assert.equal(pr.link.a, '125000');

  // The client got the payment request with the PDF and the pay link; you got a copy.
  assert.equal(mailbox.length, 1);
  assert.deepEqual(mailbox[0].to, ['dana@acme.test']);
  assert.deepEqual(mailbox[0].bcc, ['hello@redcrowninteractive.com']);
  assert.match(mailbox[0].subject, /חשבון עסקה PR-0001/);
  assert.ok(mailbox[0].text.includes(pr.payUrl));
  assert.equal(pdfOf(mailbox[0].attachments[0]).subarray(0, 5).toString(), '%PDF-');

  mailbox = [];
  const c = await openCheckout(env, pr.link, { consent: true });
  assert.equal(await statusOf(env, c.ref), 'pending');
  assert.equal((await returnFrom(env, c)).headers.get('Location'), `${ORIGIN}/pay/success/?ref=${c.ref}`);
  assert.equal(await statusOf(env, c.ref), 'paid');

  const r = env.LEDGER_CORE.getReceipt(1);
  assert.equal(r.requestNumber, 'PR-0001');
  assert.equal(r.amountMinor, 125000);
  assert.equal(r.method, 'card');
  assert.equal(r.consent.given, true);
  assert.equal(env.LEDGER_CORE.getRequest('PR-0001').status, 'paid');
  assert.equal(env.LEDGER_CORE.getRequest('PR-0001').receiptNumber, 1);

  // No certificate yet: the client gets a payment confirmation, you get the
  // original (to print and sign) and the copy.
  const toClient = mailbox.find(m => m.to[0] === 'dana@acme.test');
  const toOwner = mailbox.find(m => m.to[0] === 'hello@redcrowninteractive.com');
  assert.match(toClient.subject, /אישור תשלום/);
  assert.equal(toClient.attachments.length, 0);
  assert.match(toOwner.subject, /^ACTION: Payment received: receipt 1/);
  assert.deepEqual(toOwner.attachments.map(a => a.filename), ['receipt-1.pdf', 'receipt-1-copy.pdf']);
  assert.match(toOwner.text, /no signing certificate/);

  // A second payment of the same request is refused.
  assert.equal((await checkout(env, { link: pr.link, method: 'paypal' })).status, 409);
});

test('with a signing certificate and consent, the client receives the signed receipt', async () => {
  mailbox = [];
  const env = envFor({ SIGNING_P12_PASSWORD: 'pw' });
  await env.PAYMENTS.put('signing:p12', testP12());
  const pr = await newRequest(env, { lang: 'en' });
  mailbox = [];
  await returnFrom(env, await openCheckout(env, pr.link, { consent: true }));

  const toClient = mailbox.find(m => m.to[0] === 'dana@acme.test');
  assert.match(toClient.subject, /^Receipt 1 from Red Crown Interactive/);
  const pdf = pdfOf(toClient.attachments[0]);
  assert.ok(pdf.includes('/ByteRange') && pdf.includes('/adbe.pkcs7.detached'), 'digitally signed');
  const toOwner = mailbox.find(m => m.to[0] === 'hello@redcrowninteractive.com');
  assert.match(toOwner.subject, /^Payment received: receipt 1/);
  assert.deepEqual(toOwner.attachments.map(a => a.filename), ['receipt-1-copy.pdf']);
  assert.equal(env.LEDGER_CORE.getReceipt(1).signed, true);

  // Without consent the same setup sends a confirmation instead.
  mailbox = [];
  const pr2 = await newRequest(env, { lang: 'en' });
  mailbox = [];
  await returnFrom(env, await openCheckout(env, pr2.link));
  assert.match(mailbox.find(m => m.to[0] === 'dana@acme.test').subject, /^Payment confirmation/);
  assert.match(mailbox.find(m => m.to[0] === 'hello@redcrowninteractive.com').text, /has not agreed to digital documents/);
});

test('second tab: a paid request is not captured again, client not charged', async () => {
  const env = envFor();
  let captures = 0;
  const realCapture = mock.capture;
  mock.capture = async s => { captures++; return realCapture(s); };
  try {
    const { link } = await newRequest(env);
    const tab1 = await openCheckout(env, link);
    const tab2 = await openCheckout(env, link);   // opened before tab 1 paid
    await returnFrom(env, tab1);
    await returnFrom(env, tab2);
    await returnFrom(env, tab2);                  // refresh
    assert.equal(captures, 1);
    assert.equal(await statusOf(env, tab1.ref), 'paid');
    assert.equal(await statusOf(env, tab2.ref), 'already_paid');
    assert.equal(env.LEDGER_CORE.list().receipts.length, 1);
  } finally {
    mock.capture = realCapture;
  }
});

test('webhook and return for the same payment issue one receipt; forged or mismatched webhooks are ignored', async () => {
  mailbox = [];
  const env = envFor();
  const { link } = await newRequest(env);
  const c = await openCheckout(env, link);
  const paid = { ref: c.ref, status: 'paid', amountMinor: 125000, currency: 'USD', transactionId: 't1' };
  const forged = await call(env, post('/webhook/mock', JSON.stringify(paid), { 'x-mock-signature': 'forged' }));
  assert.equal(forged.status, 401);
  await hook(env, { ...paid, amountMinor: 100 });
  assert.equal(await statusOf(env, c.ref), 'pending');
  await hook(env, paid);
  await hook(env, paid);                           // provider retry
  await returnFrom(env, c);                        // client returns afterwards
  assert.equal(await statusOf(env, c.ref), 'paid');
  assert.equal(env.LEDGER_CORE.list().receipts.length, 1);
  assert.equal(mailbox.filter(m => /Payment received/.test(m.subject)).length, 1);
});

test('safety net: a payment confirmed for a request held by another checkout is a duplicate and alerted', async () => {
  mailbox = [];
  const env = envFor();
  const { link } = await newRequest(env);
  const a = await openCheckout(env, link);
  const b = await openCheckout(env, link);
  await returnFrom(env, a);
  mailbox = [];
  await hook(env, { ref: b.ref, status: 'paid', amountMinor: 125000, currency: 'USD', transactionId: 'tx-b' });
  assert.equal(await statusOf(env, b.ref), 'duplicate');
  assert.equal(env.LEDGER_CORE.list().duplicates.length, 1);
  assert.equal(env.LEDGER_CORE.list().receipts.length, 1);
  assert.match(mailbox[0].subject, /ACTION: duplicate payment for PR-0001/);
});

test('receipt numbers: start from your series, gap-free and unique under concurrency, fixed once used', async () => {
  const env = envFor();
  assert.equal((await adminCall(env, 'settings', { receiptStart: 1001 })).status, 200);
  const manual = i => adminCall(env, 'receipts', {
    lang: 'en', client: { ...client, email: '' }, description: 'Workshop ' + i, currency: 'ILS', amount: '500',
    paidOn: '23/09/2026', method: 'bank_transfer', methodDetails: { bank: 'Leumi', branch: '800', account: '12345', reference: 'T' + i },
  });
  const results = await Promise.all([1, 2, 3, 4, 5].map(manual));
  const numbers = (await Promise.all(results.map(r => r.json()))).map(r => r.number).sort();
  assert.deepEqual(numbers, [1001, 1002, 1003, 1004, 1005]);
  const again = await adminCall(env, 'settings', { receiptStart: 1 });
  assert.equal(again.status, 400);
  assert.match((await again.json()).error, /numbering is fixed/);
});

test('a manual receipt for a request blocks paying it online', async () => {
  const env = envFor();
  const pr = await newRequest(env);
  const c = await openCheckout(env, pr.link);    // client opened PayPal already
  const res = await adminCall(env, 'receipts', {
    requestNumber: pr.number, lang: 'he', client, description: 'תשלום עבור ' + pr.number, currency: 'USD', amount: '1,250.00',
    paidOn: '23/09/2026', method: 'bank_transfer', methodDetails: { reference: 'SWIFT123' }, consent: true, consentVia: 'email 20/09/2026',
  });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await checkout(env, { link: pr.link, method: 'card' })).status, 409);
  await returnFrom(env, c);
  assert.equal(await statusOf(env, c.ref), 'already_paid');
  assert.equal(env.LEDGER_CORE.list().receipts.length, 1);
});

test('receipt failure is alerted and can be retried from the admin page', async () => {
  mailbox = [];
  const env = envFor();
  const pr = await newRequest(env);
  delete env.BUSINESS_ID;                          // e.g. secret not set yet
  mailbox = [];
  const c = await openCheckout(env, pr.link, { consent: true });
  await returnFrom(env, c);
  assert.equal(await statusOf(env, c.ref), 'paid');
  assert.equal(env.LEDGER_CORE.list().receipts.length, 0);
  assert.match(mailbox[0].subject, /ACTION: payment received for PR-0001, but the receipt was not issued/);
  env.BUSINESS_ID = '000000018';
  const retry = await adminCall(env, `requests/${pr.number}/receipt`, {});
  assert.equal(retry.status, 200, await retry.clone().text());
  assert.equal(env.LEDGER_CORE.getReceipt(1).consent.given, true);
  assert.equal((await adminCall(env, `requests/${pr.number}/receipt`, {})).status, 400);
});

test('admin: token required, validation, cancel, documents and CSV export', async () => {
  const env = envFor();
  assert.equal((await adminCall(env, 'list', undefined, 'wrong-token-wrong-token-wrong-token')).status, 401);
  assert.equal((await adminCall(envFor({ ADMIN_TOKEN: 'short' }), 'list', undefined, 'short')).status, 401);
  const page = await call(env, new Request(API + '/admin'));
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);

  const noAddress = await adminCall(env, 'requests', { lang: 'en', currency: 'USD', client: { ...client, address: '' }, items: [{ description: 'x', quantity: 1, unitPrice: '10' }] });
  assert.equal(noAddress.status, 400);
  assert.match((await noAddress.json()).error, /address is required/);

  const preview = await adminCall(env, 'requests?preview=1', { lang: 'en', currency: 'EUR', client, items: [{ description: 'x', quantity: 1.5, unitPrice: '99.99' }] });
  assert.equal(preview.headers.get('Content-Type'), 'application/pdf');
  assert.equal(env.LEDGER_CORE.list().requests.length, 0, 'preview creates nothing');

  const pr = await newRequest(env, { send: false });
  assert.equal((await adminCall(env, `requests/${pr.number}/cancel`, {})).status, 200);
  assert.equal((await checkout(env, { link: pr.link, method: 'card' })).status, 410);

  const pr2 = await newRequest(env);
  await returnFrom(env, await openCheckout(env, pr2.link));
  const list = await (await adminCall(env, 'list')).json();
  assert.equal(list.configured, true);
  assert.equal(list.receipts[0].number, 1);
  const copy = await adminCall(env, 'receipts/1/pdf');
  assert.equal(Buffer.from(await copy.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  const trueCopy = await adminCall(env, 'receipts/1/pdf?mark=true_copy');
  assert.equal(trueCopy.status, 200);
  // Raw bytes: Response.text() would strip the byte-order mark Excel needs.
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await (await adminCall(env, 'export.csv')).arrayBuffer());
  assert.ok(csv.startsWith('\uFEFFnumber,issued'));
  assert.match(csv.split('\r\n')[1], /^1,.*,USD,1250\.00,/);
});

test('mock provider is refused in production', async () => {
  const env = envFor({ ENVIRONMENT: 'production' });
  const { link } = await newRequest(env);
  assert.equal((await checkout(env, { link, method: 'card' })).status, 500);
});

test('bidi: Hebrew with numbers and Latin text in visual order', () => {
  assert.equal(visual('שלב 1'), '1 בלש');
  assert.equal(visual('Julia Pavlov / יוליה פבלוב'), 'בולבפ הילוי / Julia Pavlov');
  assert.equal(visual('(3.712 ליום 23/09/2026)'), '(23/09/2026 םויל 3.712)');
  assert.equal(visual('$1,250.00'), '$1,250.00');
  assert.equal(visual('PR-0001: סימולציית VR, שלב 1'), '1 בלש ,VR תייצלומיס :PR-0001');
});

test('payplus: webhook signature check and amount parsing', async () => {
  const env = { PAYPLUS_SECRET_KEY: 'pp-secret' };
  const raw = JSON.stringify({ transaction: { more_info: 'r', status_code: '000', amount: '1250.5', currency: 'usd', uid: 'u1' } });
  const signed = new Request('https://x.test', { method: 'POST', headers: { hash: await payplus.hmacBase64('pp-secret', raw) } });
  assert.deepEqual(await payplus.verifyWebhook(signed, raw, env), { ref: 'r', status: 'paid', amountMinor: 125050, currency: 'USD', transactionId: 'u1' });
  const forged = new Request('https://x.test', { method: 'POST', headers: { hash: 'AAAA' } });
  assert.equal(await payplus.verifyWebhook(forged, raw, env), null);
});

test('paypal: order creation, capture and webhook verification', async () => {
  const env = { PAYPAL_API_URL: 'https://api-m.sandbox.paypal.com', PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' };
  const calls = [];
  const outer = globalThis.fetch;
  let verifyStatus = 'SUCCESS';
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body && init.body !== 'grant_type=client_credentials' ? JSON.parse(init.body) : null;
    calls.push({ path, body, headers: init.headers });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (path === '/v1/oauth2/token') return reply({ access_token: 'tok' });
    if (path === '/v2/checkout/orders') return reply({ id: 'ORD1', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1' }] }, 201);
    if (path === '/v2/checkout/orders/ORD1/capture') return reply({ payer: { name: { given_name: 'Dana', surname: 'Levi' }, email_address: 'dana@acme.com' }, purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', custom_id: 'r1', amount: { currency_code: 'USD', value: '1250.50' }, seller_receivable_breakdown: { paypal_fee: { value: '44.20' }, net_amount: { value: '1206.30' } } }] } }] }, 201);
    if (path === '/v1/notifications/verify-webhook-signature') return reply({ verification_status: verifyStatus });
    return reply({}, 404);
  };
  try {
    const out = await paypal.createCheckout({ ref: 'r1', invoice: 'PR-0001', amountMinor: 125050, currency: 'USD', method: 'card', returnUrl: 'https://w/return', cancelUrl: 'https://s/pay/' }, env);
    assert.deepEqual(out, { url: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1', providerRef: 'ORD1' });
    const order = calls.find(c => c.path === '/v2/checkout/orders').body;
    assert.equal(order.purchase_units[0].amount.value, '1250.50');
    assert.equal(order.purchase_units[0].custom_id, 'r1');
    assert.equal(order.payment_source.paypal.experience_context.landing_page, 'GUEST_CHECKOUT');
    assert.deepEqual(paypal.checkoutHosts(env), ['www.sandbox.paypal.com']);
    assert.deepEqual(await paypal.capture({ providerRef: 'ORD1' }, env),
      { ref: 'r1', status: 'paid', amountMinor: 125050, currency: 'USD', transactionId: 'CAP1',
        payerName: 'Dana Levi', payerEmail: 'dana@acme.com', feeMinor: 4420, netMinor: 120630 });
    assert.equal(calls.find(c => c.path.endsWith('/capture')).headers.Prefer, 'return=representation');
    const raw = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP1', status: 'COMPLETED', custom_id: 'r1', amount: { currency_code: 'USD', value: '1250.50' } } });
    const req = new Request('https://x.test', { method: 'POST', headers: { 'paypal-transmission-sig': 'sig', 'paypal-transmission-id': 't', 'paypal-transmission-time': 'now', 'paypal-cert-url': 'https://api.paypal.com/cert', 'paypal-auth-algo': 'SHA256withRSA' } });
    assert.equal((await paypal.verifyWebhook(req, raw, env)).status, 'paid');
    verifyStatus = 'FAILURE';
    assert.equal(await paypal.verifyWebhook(req, raw, env), null);
  } finally {
    globalThis.fetch = outer;
  }
});
