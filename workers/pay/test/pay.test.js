import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import forge from 'node-forge';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createSigningKey } from '../tools/create-signing-key.mjs';
import { sign, verify, toQuery } from '../src/links.js';
import worker from '../src/index.js';
import { LedgerCore } from '../src/ledger.js';
import { visual } from '../src/bidi.js';
import mock from '../src/providers/mock.js';
import payplus from '../src/providers/payplus.js';
import paypal from '../src/providers/paypal.js';
import grow, { clean, israeliMobile } from '../src/providers/grow.js';

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
// The pay page always sends consent (the checkbox is required).
const openCheckout = async (env, link, extra = {}) => {
  const res = await checkout(env, { link, method: 'card', consent: true, ...extra });
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

// A self-signed RSA-2048 certificate standing in for the real one, stored the
// way tools/import-certificate.mjs stores it: SIGNING_KEY (PKCS#8, base64)
// and KV "signing:cert".
const testSigner = (() => {
  let made;
  return () => (made ??= (() => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey; cert.serialNumber = '0a1b';
    cert.validity.notBefore = new Date(); cert.validity.notAfter = new Date(Date.now() + 864e5);
    const attrs = [{ name: 'commonName', value: 'Test Signer' }];
    cert.setSubject(attrs); cert.setIssuer(attrs); cert.sign(keys.privateKey, forge.md.sha256.create());
    const der = x => Buffer.from(forge.asn1.toDer(x).getBytes(), 'binary');
    const certDer = der(forge.pki.certificateToAsn1(cert));
    return {
      key: der(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey))).toString('base64'),
      certJson: JSON.stringify({ alg: 'RSA', certs: [certDer.toString('base64')] }),
      certPem: forge.pki.certificateToPem(cert),
    };
  })());
})();

// Checks a signed PDF with OpenSSL, independently of our own code: the
// ByteRange covers the whole file except the signature, and the CMS signature
// verifies over exactly those bytes with the signer's certificate.
const verifyWithOpenssl = (pdf, certPem = testSigner().certPem) => {
  const text = pdf.toString('latin1');
  const [a, b, c, d] = text.match(/\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\s*\]/).slice(1).map(Number);
  assert.equal(a, 0);
  assert.equal(c + d, pdf.length, 'ByteRange reaches the end of the file');
  assert.equal(text[b], '<'); assert.equal(text[c - 1], '>');
  // The placeholder is zero-padded; take exactly the DER length from its header.
  const padded = Buffer.from(text.slice(b + 1, c - 1), 'hex');
  const lenBytes = padded[1] & 0x80 ? padded[1] & 0x7F : 0;
  const bodyLen = lenBytes ? padded.subarray(2, 2 + lenBytes).reduce((n, x) => n * 256 + x, 0) : padded[1];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sig-'));
  fs.writeFileSync(path.join(dir, 'sig.der'), padded.subarray(0, 2 + lenBytes + bodyLen));
  fs.writeFileSync(path.join(dir, 'content'), Buffer.concat([pdf.subarray(0, b), pdf.subarray(c)]));
  fs.writeFileSync(path.join(dir, 'cert.pem'), certPem);
  execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', path.join(dir, 'sig.der'),
    '-content', path.join(dir, 'content'), '-CAfile', path.join(dir, 'cert.pem'), '-purpose', 'any', '-out', '/dev/null'], { stdio: 'pipe' });
  fs.rmSync(dir, { recursive: true });
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

test('pay page details: only for a valid link, without private details, status follows payment', async () => {
  mailbox = [];
  const env = envFor();
  const pr = await newRequest(env);
  const get = (path, link, origin = ORIGIN) => call(env, new Request(`${API}${path}?${new URLSearchParams(link)}`, { headers: origin ? { Origin: origin } : {} }));

  const res = await get('/request', pr.link);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const d = await res.json();
  assert.equal(d.number, pr.link.i);
  assert.equal(d.status, 'open');
  assert.equal(d.amountMinor, 125000);
  assert.deepEqual(d.client, { name: client.name, company: client.company });
  assert.deepEqual(d.items.map(it => [it.description, it.quantity, it.totalMinor]), [['סימולציית VR, שלב 1', 1, 100000], ['QA hours', 10, 25000]]);
  assert.equal(d.notes, 'תודה!');
  const text = JSON.stringify(d);
  for (const secret of [client.email, client.address, client.taxId]) assert.ok(!text.includes(secret), `does not expose ${secret}`);

  assert.equal((await get('/request', { ...pr.link, a: '100' })).status, 400, 'tampered amount');
  assert.equal((await get('/request', { ...pr.link, s: 'x'.repeat(43) })).status, 400, 'forged signature');
  assert.equal((await get('/request', pr.link, 'https://evil.test')).status, 403, 'other sites');

  const pdf = await get('/request.pdf', pr.link, null);
  assert.equal(pdf.headers.get('Content-Type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await get('/request.pdf', { ...pr.link, a: '100' }, null)).status, 400);

  await returnFrom(env, await openCheckout(env, pr.link));
  assert.equal((await (await get('/request', pr.link)).json()).status, 'paid');
});

test('with a signing certificate and consent, the client receives the signed receipt', async () => {
  mailbox = [];
  const env = envFor({ SIGNING_KEY: testSigner().key });
  await env.PAYMENTS.put('signing:cert', testSigner().certJson);
  const pr = await newRequest(env, { lang: 'en' });
  mailbox = [];
  await returnFrom(env, await openCheckout(env, pr.link, { consent: true }));

  const toClient = mailbox.find(m => m.to[0] === 'dana@acme.test');
  assert.match(toClient.subject, /^Receipt 1 from Red Crown Interactive/);
  const pdf = pdfOf(toClient.attachments[0]);
  assert.ok(pdf.includes('/ByteRange') && pdf.includes('/adbe.pkcs7.detached'), 'digitally signed');
  verifyWithOpenssl(pdf);
  const toOwner = mailbox.find(m => m.to[0] === 'hello@redcrowninteractive.com');
  assert.match(toOwner.subject, /^Payment received: receipt 1/);
  assert.deepEqual(toOwner.attachments.map(a => a.filename), ['receipt-1-copy.pdf']);
  assert.equal(env.LEDGER_CORE.getReceipt(1).signed, true);

  // Without consent there is no online checkout (nothing is charged).
  const pr2 = await newRequest(env, { lang: 'en' });
  const refused = await checkout(env, { link: pr2.link, method: 'card' });
  assert.equal(refused.status, 422);
  assert.equal((await checkout(env, { link: pr2.link, method: 'card', consent: 'yes' })).status, 422);
});

test('own signing key: a key made by tools/create-signing-key.mjs signs receipts that OpenSSL verifies', async () => {
  const own = createSigningKey({ name: 'Test Owner', businessId: '000000018', email: 'owner@example.test', bits: 2048 });
  const cert = new crypto.X509Certificate(Buffer.from(JSON.parse(own.certJson).certs[0], 'base64'));
  assert.match(cert.subject, /CN=Test Owner/);
  assert.match(cert.subject, /serialNumber=000000018/);
  assert.equal(cert.fingerprint256, own.fingerprint);

  mailbox = [];
  const env = envFor({ SIGNING_KEY: own.key });
  await env.PAYMENTS.put('signing:cert', own.certJson);
  const pr = await newRequest(env, { lang: 'en' });
  mailbox = [];
  await returnFrom(env, await openCheckout(env, pr.link));
  const pdf = pdfOf(mailbox.find(m => m.to[0] === 'dana@acme.test').attachments[0]);
  verifyWithOpenssl(pdf, own.certPem);
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
  assert.equal((await checkout(env, { link, method: 'card', consent: true })).status, 500);
});

test('bidi: Hebrew with numbers and Latin text in visual order', () => {
  assert.equal(visual('שלב 1'), '1 בלש');
  assert.equal(visual('Julia Pavlov / יוליה פבלוב'), 'בולבפ הילוי / Julia Pavlov');
  assert.equal(visual('(3.712 ליום 23/09/2026)'), '(23/09/2026 םויל 3.712)');
  assert.equal(visual('$1,250.00'), '$1,250.00');
  assert.equal(visual('PR-0001: סימולציית VR, שלב 1'), '1 בלש ,VR תייצלומיס :PR-0001');
});

// Expected strings are what Chromium displays for the same text in a
// right-to-left paragraph (bilingual sections as <bdi>), read left to right.
test('bidi: numbers stay with Latin words, brackets pair up, each language keeps its punctuation', () => {
  // "3D" stays one word (a number followed by Latin text is left-to-right).
  assert.equal(visual('עיצוב תלת-ממד / 3D design'), '3D design / דממ-תלת בוציע');
  // Both brackets stay with the English they enclose.
  assert.equal(visual('פיתוח אפליקציית VR / VR app development, milestone 2 (Unity, Meta Quest 3)'),
    'VR app development, milestone 2 (Unity, Meta Quest 3) / VR תייצקילפא חותיפ');
  // Each "!" and ":" ends its own language.
  assert.equal(visual('תודה! / Thank you!'), 'Thank you! / !הדות');
  assert.equal(visual('לתשלום מאובטח בכרטיס אשראי או PayPal / Pay securely by card or PayPal:'),
    'Pay securely by card or PayPal: / PayPal וא יארשא סיטרכב חטבואמ םולשתל');
  // Brackets around Hebrew in an English line: left-to-right, not mirrored.
  assert.equal(visual('Order #123 (שלב ב׳) done', 'ltr'), 'Order #123 (׳ב בלש) done');
  // Brackets resolved right-to-left are mirrored.
  assert.equal(visual('(שלום)'), '(םולש)');
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

// ---- Grow: a fake Grow server with the Light API's request and response shapes.
const GROW_API = 'https://sandbox.meshulam.co.il/api/light/server/1.0';
const growServer = () => {
  const state = { calls: [], paid: false, sum: '1250', processes: 0 };
  const handler = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname !== 'sandbox.meshulam.co.il') return null;
    const method = u.pathname.split('/').pop();
    const fields = init.body instanceof FormData ? Object.fromEntries(init.body.entries()) : {};
    state.calls.push({ method, fields });
    const ok = data => new Response(JSON.stringify({ status: 1, err: '', data }), { status: 200 });
    if (method === 'createPaymentProcess') {
      state.processes++;
      return ok({ processId: String(734753 + state.processes), processToken: 'tok' + state.processes, url: `https://sandbox.meshulam.co.il/far?l=p${state.processes}` });
    }
    if (method === 'getPaymentProcessInfo') {
      const tx = { asmachta: '0289199', cardSuffix: '4580', cardType: 'Foreign', cardTypeCode: '2', cardBrand: 'Visa', cardBrandCode: '3', cardExp: '0130',
        firstPaymentSum: '0', periodicalPaymentSum: '0', statusCode: '2', transactionTypeId: '1', paymentType: '2', sum: state.sum, paymentsNum: '0',
        allPaymentsNum: '1', paymentDate: '24/9/26', description: 'x', fullName: 'Dana Levi', payerPhone: '0501234567', payerEmail: 'dana@acme.test',
        transactionId: 'T' + fields.processId, transactionToken: 'tt' + fields.processId };
      const paid = state.paid === true || state.paid === fields.processId;
      return ok({ processId: fields.processId, processToken: fields.processToken, transactions: paid ? [tx] : [] });
    }
    if (method === 'approveTransaction') return ok({});
    return new Response(JSON.stringify({ status: 0, err: { id: 12, message: 'x' }, data: '' }), { status: 200 });
  };
  return { state, handler };
};
const withGrow = async fn => {
  const server = growServer();
  const outer = globalThis.fetch;
  globalThis.fetch = async (url, init) => (await server.handler(url, init)) ?? outer(url, init);
  try { await fn(server.state); } finally { globalThis.fetch = outer; }
};
const growEnv = () => envFor({ PROVIDER: 'grow', GROW_API_URL: GROW_API, GROW_USER_ID: 'user-1', GROW_PAGE_CODE: 'pc-card', GROW_PAGE_CODE_BIT: 'pc-bit' });
// Grow's server update: form fields, as Grow sends them.
const growUpdate = (env, ref, fields = {}) => call(env, new Request(`${API}/webhook/grow?ref=${ref}`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ status: '1', 'data[statusCode]': '2', 'data[sum]': '1250', ...fields }).toString(),
}));
const growCheckout = async (env, link, method = 'card') => {
  const res = await checkout(env, { link, method, consent: true });
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
};

test('grow: shekels only; checkout opens Grow\'s page with the request\'s details', async () => withGrow(async grow => {
  const env = growEnv();
  const usd = await adminCall(env, 'requests', { lang: 'en', currency: 'USD', client, items: [{ description: 'x', quantity: 1, unitPrice: '10' }] });
  assert.equal(usd.status, 400);
  assert.match((await usd.json()).error, /Grow charges only in ILS/);

  const { link } = await newRequest(env, { currency: 'ILS', client: { ...client, phone: '+972 50-123-4567' } });
  assert.equal((await checkout(env, { link, method: 'applepay', consent: true })).status, 400);   // no page code
  assert.equal((await checkout(env, { link, method: 'card' })).status, 422);                       // no consent
  const { url, ref } = await growCheckout(env, link);
  assert.equal(url, 'https://sandbox.meshulam.co.il/far?l=p1');

  const f = grow.calls.find(c => c.method === 'createPaymentProcess').fields;
  assert.equal(f.pageCode, 'pc-card');
  assert.equal(f.userId, 'user-1');
  assert.equal(f.sum, '1250.00');
  assert.equal(f.cField1, ref);
  assert.equal(f.successUrl, `${API}/return/grow?ref=${ref}`);
  assert.equal(f.notifyUrl, `${API}/webhook/grow?ref=${ref}`);
  assert.equal(f.invoiceNotifyUrl, `${API}/webhook/grow?ref=${ref}&document=1`);
  assert.equal(f['pageField[phone]'], '0501234567');
  assert.equal(f['pageField[email]'], 'dana@acme.test');
  assert.equal(f['pageField[invoiceName]'], 'Acme Labs');
  assert.equal(f['pageField[invoiceLicenseNumber]'], '514000000');
  assert.doesNotMatch(f['pageField[fullName]'] + f.description, /["<>&]/);
  // The receipt lines add up to the sum exactly.
  const lines = Object.keys(f).filter(k => /^productData\[\d+\]\[price\]$/.test(k)).map(k => Number(f[k]));
  assert.deepEqual(lines, [1000, 250]);
  assert.match(f['productData[1][itemDescription]'], /QA hours \(10 x 25\.00\)/);

  // Grow's page for Bit uses Bit's page code.
  await growCheckout(env, link, 'bit');
  assert.equal(grow.calls.filter(c => c.method === 'createPaymentProcess')[1].fields.pageCode, 'pc-bit');
}));

test('grow: a payment counts only when Grow confirms it; Grow issues the receipt, not us', async () => withGrow(async grow => {
  mailbox = [];
  const env = growEnv();
  const { link, number } = await newRequest(env, { currency: 'ILS' });
  const { ref } = await growCheckout(env, link);

  // A forged update before anything was paid: Grow says unpaid, nothing recorded.
  assert.equal((await growUpdate(env, ref)).status, 200);
  assert.equal(await statusOf(env, ref), 'pending');
  assert.equal(grow.calls.filter(c => c.method === 'approveTransaction').length, 0);
  // Unknown checkout, or another process's id: refused.
  assert.equal((await growUpdate(env, crypto.randomUUID())).status, 401);
  assert.equal((await growUpdate(env, ref, { 'data[processId]': '1' })).status, 401);
  // Grow reports a different amount: not recorded.
  grow.paid = true; grow.sum = '10';
  await growUpdate(env, ref);
  assert.equal(await statusOf(env, ref), 'pending');

  grow.sum = '1250';
  mailbox = [];
  assert.equal((await growUpdate(env, ref, { 'data[processId]': '734754' })).status, 200);
  assert.equal(await statusOf(env, ref), 'paid');
  // Every update Grow confirms is acknowledged, as Grow asks (the mismatched one too).
  const approve = grow.calls.filter(c => c.method === 'approveTransaction').at(-1);
  assert.equal(approve.fields.pageCode, 'pc-card');
  assert.equal(approve.fields.transactionId, 'T734754');
  assert.equal(approve.fields.processToken, 'tok1');

  // The client comes back and Grow resends the update: still one payment.
  assert.equal((await call(env, new Request(`${API}/return/grow?ref=${ref}&response=success`))).headers.get('Location'), `${ORIGIN}/pay/success/?ref=${ref}`);
  await growUpdate(env, ref);
  assert.equal(env.LEDGER_CORE.getRequest(number).status, 'paid');
  assert.equal(env.LEDGER_CORE.list().receipts.length, 0);          // Grow's receipt, not ours
  assert.equal(mailbox.length, 1);
  assert.deepEqual(mailbox[0].to, ['hello@redcrowninteractive.com']);
  assert.match(mailbox[0].subject, new RegExp(`Payment received: ${number}, ₪1,250.00`));
  assert.match(mailbox[0].text, /Grow issues the receipt/);
  assert.equal(env.LEDGER_CORE.payment(ref).method, 'card');

  // Grow's receipt notice is kept with the request.
  const doc = await call(env, new Request(`${API}/webhook/grow?ref=${ref}&document=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ transactionId: 'T734754', processId: '734754', invoiceNumber: '4111', invoiceUrl: 'https://meshulam.co.il/s/abc' }]),
  }));
  assert.equal(doc.status, 200);
  const list = await (await adminCall(env, 'list')).json();
  assert.deepEqual(list.requests[0].providerReceipt, { number: '4111', url: 'https://meshulam.co.il/s/abc' });
  assert.equal(list.receiptsBy, 'Grow');
  assert.deepEqual(list.currencies, ['ILS']);

  // Receipts are issued in Grow only: one numbered series.
  assert.equal((await adminCall(env, `requests/${number}/receipt`, {})).status, 400);
  const manual = await adminCall(env, 'receipts', { lang: 'he', client, description: 'x', currency: 'ILS', amount: '100', paidOn: '24/09/2026', method: 'bank_transfer' });
  assert.equal(manual.status, 400);
  assert.match((await manual.json()).error, /issued by Grow/);
}));

test('grow: the return alone records the payment; a second payment is a duplicate to refund', async () => withGrow(async grow => {
  mailbox = [];
  const env = growEnv();
  const { link } = await newRequest(env, { currency: 'ILS' });
  const a = await growCheckout(env, link);
  const b = await growCheckout(env, link);            // a second tab
  grow.paid = '734754';                               // tab a paid; the update is late
  await call(env, new Request(`${API}/return/grow?ref=${a.ref}&response=success`));
  assert.equal(await statusOf(env, a.ref), 'paid');
  grow.paid = true;                                   // tab b paid too
  mailbox = [];
  await growUpdate(env, b.ref);
  assert.equal(await statusOf(env, b.ref), 'duplicate');
  assert.match(mailbox[0].subject, /ACTION: duplicate payment/);
  assert.match(mailbox[0].text, /Refund it in Grow's dashboard/);
  assert.equal((await checkout(env, { link, method: 'card', consent: true })).status, 409);
}));

test('grow: field cleaning and phone numbers', () => {
  assert.equal(clean('ד"ר דנה <לוי> & Co.'), 'ד ר דנה לוי Co.');
  assert.equal(israeliMobile('+972 50-123-4567'), '0501234567');
  assert.equal(israeliMobile('054 1234567'), '0541234567');
  assert.equal(israeliMobile('+1 415 555 0100'), '');
  assert.deepEqual(grow.checkoutHosts({ GROW_API_URL: GROW_API }), ['sandbox.meshulam.co.il']);
  assert.deepEqual(grow.methods({ GROW_PAGE_CODE: 'a', GROW_PAGE_CODE_GOOGLEPAY: 'b' }), ['card', 'googlepay']);
});
