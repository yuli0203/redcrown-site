// Your document generator: /admin on the payment Worker.
//
//   GET  /admin                           the page (admin-ui.js)
//   GET  /admin/api/list                  requests, receipts, duplicates
//   POST /admin/api/requests[?preview=1]  create (and email) a payment request
//   POST /admin/api/requests/<n>/cancel|resend|receipt
//   GET  /admin/api/requests/<n>/pdf
//   POST /admin/api/receipts[?preview=1]  record a payment you received directly
//   GET  /admin/api/receipts/<n>/pdf[?mark=true_copy]
//   POST /admin/api/receipts/<n>/resend   email a true copy to the client
//   GET  /admin/api/export.csv            every receipt, for your accountant
//   POST /admin/api/settings              { receiptStart } before the first receipt
//
// Every API call needs "Authorization: Bearer <ADMIN_TOKEN>" (a Worker secret,
// 32+ characters). Putting Cloudflare Access in front of /admin adds a login.
import { ledger, business, bytes, client as vClient, currency as vCurrency, items as vItems, total as vTotal, toMinor, lang as vLang, str, bad } from './business.js';
import { buildRequestPdf, buildReceiptPdf, METHODS, date } from './documents.js';
import { issueReceipt, requestDocument, requestEmail, today } from './receipts.js';
import { send } from './mail.js';
import { loadSigner, signPdf } from './sign.js';
import { json, baseHeaders, readBody, MAX_BODY } from './http.js';
import { receiptFor } from './index.js';
import { PAGE, SCRIPT, STYLE } from './admin-ui.js';

const enc = new TextEncoder();
const digest = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function authorized(request, env) {
  const token = env.ADMIN_TOKEN || '';
  if (token.length < 32) return false;
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const [a, b] = await Promise.all([digest(given), digest(token)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const pageHeaders = type => ({
  ...baseHeaders,
  'Content-Type': type,
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-src blob:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
});

const pdfResponse = (pdf, filename) => new Response(bytes(pdf), {
  headers: { ...baseHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` },
});

const DAY = 86400;

// ---- Payment requests.
async function createRequest(env, body, preview) {
  const b = business(env);
  const lang = vLang(body.lang);
  const cl = vClient(body.client, { requireEmail: body.send !== false && !preview });
  const cur = vCurrency(body.currency);
  const its = vItems(body.items);
  const amountMinor = vTotal(its.reduce((a, it) => a + it.totalMinor, 0));
  const days = Math.min(Math.max(Number(body.validDays) || 30, 1), 365);
  const expires = Math.floor(Date.now() / 1000) + days * DAY;
  const notes = str(body.notes, 1000, 'Notes');
  const draft = { number: 'PR-PREVIEW', created: Date.now(), lang, client: cl, items: its, notes, currency: cur, amountMinor, expires };
  if (preview) return { pdf: await buildRequestPdf({ business: b, request: draft, payUrl: `${env.SITE_URL}/pay/?preview` }) };

  const l = ledger(env);
  const request = await l.createRequest({ lang, client: cl, items: its, notes, currency: cur, amountMinor, expires });
  const { url, pdf } = await requestDocument(env, request);
  await l.attachRequestPdf(request.number, pdf);
  let emailed = false;
  if (body.send !== false && cl.email) emailed = await send(env, requestEmail(env, b, request, url, pdf));
  return { number: request.number, payUrl: url, emailed };
}

// ---- Receipts for payments received directly (bank transfer, cheque, cash).
function manualReceiptInput(body) {
  const method = Object.hasOwn(METHODS, body.method) ? body.method : null;
  if (!method) throw bad('Choose a payment method');
  const d = body.methodDetails || {};
  const detail = k => str(d[k], 80, k);
  const methodDetails = {
    bank: detail('bank'), branch: detail('branch'), account: detail('account'), reference: detail('reference'),
    chequeNumber: detail('chequeNumber'), dueDate: detail('dueDate'), transactionId: detail('transactionId'),
  };
  const paidOn = str(body.paidOn, 10, 'Payment date', true);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(paidOn)) throw bad('Payment date must look like 23/09/2026');
  const lang = vLang(body.lang);
  return {
    requestNumber: body.requestNumber ? str(body.requestNumber, 20, 'Payment request') : null,
    lang, client: vClient(body.client), description: str(body.description, 300, 'Description', true),
    currency: vCurrency(body.currency), amountMinor: vTotal(toMinor(body.amount)), paidOn, method, methodDetails,
    consent: body.consent === true
      ? { given: true, at: new Date().toISOString(), via: str(body.consentVia, 200, 'Consent source') || 'confirmed by the business owner', text: 'Agreed to receive tax documents digitally by email.' }
      : { given: false },
  };
}

async function createReceipt(env, body, preview) {
  const input = manualReceiptInput(body);
  const b = business(env);                 // fail before touching the ledger
  const l = ledger(env);
  if (preview) {
    const receipt = { ...input, number: 'PREVIEW', created: Date.now(), ils: null };
    return { pdf: await buildReceiptPdf({ business: b, receipt, mark: 'original' }) };
  }
  if (input.requestNumber) {
    const pr = await l.getRequest(input.requestNumber);
    if (!pr) throw bad('No such payment request');
    if (pr.receiptNumber) throw bad(`Payment request ${pr.number} already has receipt ${pr.receiptNumber}`);
    if (pr.paidRef) throw bad(`Payment request ${pr.number} was paid online; use "Issue receipt" on it instead`);
    if (pr.status === 'cancelled') throw bad(`Payment request ${pr.number} is cancelled`);
    if (pr.amountMinor !== input.amountMinor || pr.currency !== input.currency) throw bad('Amount or currency differs from the payment request');
    // Blocks any online payment from now on, including one already on PayPal's page.
    const claim = await l.claim(pr.number, 'manual:' + crypto.randomUUID());
    if (!claim.ok) throw bad(`Payment request ${pr.number} is being paid online right now`);
  }
  return issueReceipt(env, input);
}

// A reprint is a true copy (העתק נאמן למקור), never a second original.
async function receiptPdf(env, number, mark) {
  const l = ledger(env);
  if (mark !== 'true_copy') return bytes(await l.receiptPdf(number));
  const receipt = await l.getReceipt(number);
  if (!receipt) return null;
  const b = business(env);
  const signer = await loadSigner(env);
  if (!signer) return buildReceiptPdf({ business: b, receipt, mark: 'true_copy' });
  return signPdf(await buildReceiptPdf({ business: b, receipt, mark: 'true_copy', signature: { name: b.ownerName, reason: 'קבלה / Receipt', location: 'Israel', contactInfo: b.email } }), signer);
}

const csvCell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function exportCsv(env) {
  const rows = await ledger(env).exportReceipts();
  const head = ['number', 'issued', 'paid_on', 'client', 'company', 'tax_id', 'description', 'currency', 'amount', 'ils_amount', 'ils_rate', 'method', 'transaction_or_reference', 'paypal_fee', 'net', 'payment_request', 'digitally_signed'];
  const lines = rows.map(r => [
    r.number, date(r.created), r.paidOn, r.client.name, r.client.company, r.client.taxId, r.description, r.currency,
    (r.amountMinor / 100).toFixed(2), r.ils ? (r.ils.amountMinor / 100).toFixed(2) : '', r.ils?.rate ?? '',
    r.method, r.methodDetails?.transactionId || r.methodDetails?.reference || r.methodDetails?.chequeNumber || '',
    r.payment?.feeMinor != null ? (r.payment.feeMinor / 100).toFixed(2) : '', r.payment?.netMinor != null ? (r.payment.netMinor / 100).toFixed(2) : '',
    r.requestNumber || '', r.signed ? 'yes' : 'no',
  ].map(csvCell).join(','));
  // BOM so Excel opens Hebrew correctly.
  return new Response('\uFEFF' + [head.join(','), ...lines].join('\r\n'), {
    headers: { ...baseHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="receipts-${today().replace(/\//g, '-')}.csv"` },
  });
}

export async function admin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'GET' && (path === '/admin' || path === '/admin/')) return new Response(PAGE, { headers: pageHeaders('text/html; charset=utf-8') });
  if (request.method === 'GET' && path === '/admin/app.js') return new Response(SCRIPT, { headers: pageHeaders('text/javascript; charset=utf-8') });
  if (request.method === 'GET' && path === '/admin/app.css') return new Response(STYLE, { headers: pageHeaders('text/css; charset=utf-8') });
  if (!path.startsWith('/admin/api/')) return json({ error: 'not found' }, 404);

  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  // Admin writes come only from the admin page itself.
  if (request.method === 'POST' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'forbidden' }, 403);

  const l = ledger(env);
  const body = async () => {
    try { return JSON.parse(await readBody(request, MAX_BODY) || '{}'); } catch { throw bad('Invalid request body'); }
  };
  const preview = url.searchParams.get('preview') === '1';
  let m;
  try {
    if (request.method === 'GET' && path === '/admin/api/list') {
      const list = await l.list();
      let configured = true, configError = '';
      try { business(env); } catch (e) { configured = false; configError = e.message; }
      return json({ ...list, configured, configError, signing: !!(await loadSigner(env)), email: !!env.RESEND_API_KEY, methods: METHODS, receiptStart: Number(env.RECEIPT_START) || 1 });
    }
    if (request.method === 'GET' && path === '/admin/api/export.csv') return await exportCsv(env);
    if (request.method === 'POST' && path === '/admin/api/requests') {
      const out = await createRequest(env, await body(), preview);
      return out.pdf ? pdfResponse(out.pdf, 'preview.pdf') : json(out);
    }
    if (request.method === 'POST' && path === '/admin/api/receipts') {
      const out = await createReceipt(env, await body(), preview);
      return out.pdf ? pdfResponse(out.pdf, 'preview.pdf') : json(out);
    }
    if (request.method === 'POST' && path === '/admin/api/settings') {
      const b = await body();
      return json(await l.setReceiptStart(Number(b.receiptStart)));
    }
    if ((m = path.match(/^\/admin\/api\/requests\/(PR-\d{4,})\/(pdf|cancel|resend|receipt)$/))) {
      const [, number, action] = m;
      const pr = await l.getRequest(number);
      if (!pr) return json({ error: 'not found' }, 404);
      if (action === 'pdf' && request.method === 'GET') return pdfResponse(await l.requestPdf(number), `payment-request-${number}.pdf`);
      if (request.method !== 'POST') return json({ error: 'not found' }, 404);
      if (action === 'cancel') return json(await l.cancelRequest(number));
      if (action === 'resend') {
        if (pr.status !== 'open') throw bad(`Payment request is ${pr.status}`);
        if (!pr.client.email) throw bad('The client has no email address');
        const { url: link, pdf } = await requestDocument(env, pr);
        return json({ emailed: await send(env, requestEmail(env, business(env), pr, link, pdf)) });
      }
      if (action === 'receipt') {
        if (pr.receiptNumber) throw bad(`Already has receipt ${pr.receiptNumber}`);
        const payment = pr.paidRef && await l.payment(pr.paidRef);
        if (!payment) throw bad('No online payment is recorded for this request; use "Record a payment"');
        const out = await receiptFor(env, number, payment);
        if (!out) throw Object.assign(new Error('Issuing the receipt failed; check the business details and try again'), { status: 500 });
        return json(out);
      }
    }
    if ((m = path.match(/^\/admin\/api\/receipts\/(\d+)\/(pdf|resend)$/))) {
      const number = Number(m[1]);
      const receipt = await l.getReceipt(number);
      if (!receipt) return json({ error: 'not found' }, 404);
      if (m[2] === 'pdf' && request.method === 'GET') {
        const mark = url.searchParams.get('mark') === 'true_copy' ? 'true_copy' : 'copy';
        return pdfResponse(await receiptPdf(env, number, mark), `receipt-${number}${mark === 'true_copy' ? '-true-copy' : '-copy'}.pdf`);
      }
      if (m[2] === 'resend' && request.method === 'POST') {
        if (!receipt.client.email) throw bad('The client has no email address');
        if (!receipt.consent?.given) throw bad('The client has not agreed to digital documents; deliver it on paper');
        const signer = await loadSigner(env);
        if (!signer) throw bad('No signing certificate is configured; an unsigned receipt is not a legal emailed receipt');
        const pdf = await receiptPdf(env, number, 'true_copy');
        const b = business(env);
        const heb = receipt.lang === 'he';
        return json({ emailed: await send(env, {
          to: [receipt.client.email], dir: heb ? 'rtl' : 'ltr',
          subject: heb ? `העתק קבלה מס׳ ${number} מ-${b.tradingName}` : `Copy of receipt ${number} from ${b.tradingName}`,
          text: heb ? `שלום ${receipt.client.name},\n\nמצורף העתק נאמן למקור של קבלה מס׳ ${number}.\n\n${b.tradingName}` : `Hello ${receipt.client.name},\n\nAttached is a true copy of receipt no. ${number}.\n\n${b.tradingName}`,
          attachments: [{ filename: `receipt-${number}-true-copy.pdf`, content: pdf }],
        }) });
      }
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    const status = e.status || (/already|numbering is fixed|in progress|request is/.test(e.message) ? 400 : 500);
    if (status >= 500) console.error('admin error', e.message);
    return json({ error: e.message }, status);
  }
}
