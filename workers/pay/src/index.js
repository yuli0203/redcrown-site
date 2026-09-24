// Red Crown payment API (Cloudflare Worker).
//
//   POST /checkout          signed link + method + consent -> the provider's checkout URL
//   GET  /return/<name>     the provider sends the client back; confirm the
//                           payment, record it, redirect to the success page
//   POST /webhook/<name>    the provider's payment notification
//   GET  /status?ref=...    paid / duplicate / already_paid / pending
//   GET  /request?<link>    the payment request's details, for the pay page
//   GET  /request.pdf?<link> the payment request PDF (stored when it was issued)
//   /admin...               your document generator (admin.js)
//
// Trust rules:
// - The amount charged is the amount of a payment request in the ledger, via a
//   link we signed (links.js), never a number the browser chose.
// - An invoice counts as paid only when the provider says so server-to-server
//   (our capture or status call, or a verified webhook) and amount and
//   currency match.
// - One payment per request. PayPal: before capturing, the checkout claims the
//   request in the ledger (a Durable Object, so claims cannot race), and a
//   second checkout for a paid request is never captured. Grow charges on its
//   own page, so a second payment cannot be held back: it is recorded as a
//   duplicate and you are alerted to refund it.
// - Receipts: issued here (PayPal), or by the provider itself (Grow), never both.
// - Secrets come from Worker secrets (wrangler secret put). None are in this
//   public repository.
import { verify } from './links.js';
import { providers } from './providers/index.js';
import { ledger } from './business.js';
import { issueReceipt, duplicateAlert, receiptFailedAlert, paymentNotice, today } from './receipts.js';
import { admin } from './admin.js';
import { json, baseHeaders, cors, readBody } from './http.js';

const REF_RE = /^[0-9a-f-]{36}$/;
export const CONSENT_TEXT = 'I agree to the terms and privacy policy, and to receive my receipt and other tax documents from Red Crown Interactive digitally, by email.';

export const methodsOf = (p, env) => (p.methods ? p.methods(env) : ['card', 'paypal']);

// The configured provider's settings, for the admin page (never throws).
export const providerInfo = env => providers[env.PROVIDER] || {};

const provider = env => {
  const p = providers[env.PROVIDER];
  if (!p) throw new Error('PROVIDER is not configured');
  if (p.testOnly && env.ENVIRONMENT === 'production') throw new Error('test provider in production');
  return p;
};

const linkQuery = l => new URLSearchParams({ i: l.i, a: l.a, c: l.c, x: l.x, s: l.s }).toString();
// Checkout sessions live in the ledger (strongly consistent), not in KV.
const getSession = (env, ref) => ledger(env).getSession(ref);
const putSession = (env, ref, session) => ledger(env).putSession(ref, session);

const rateLimited = async (request, env, scope) => {
  if (!env.RATE_LIMITER) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return !(await env.RATE_LIMITER.limit({ key: `${scope}:${ip}` })).success;
};

// A signed link from the query string -> its payment request, or an error
// status. The link must match the request's amount and currency exactly.
async function requestForLink(env, params) {
  const link = await verify(params, env.PAY_LINK_SECRET);
  if (!link) return { error: 'invalid link', status: 400 };
  const pr = await ledger(env).getRequest(link.invoice);
  if (!pr || pr.amountMinor !== link.amountMinor || pr.currency !== link.currency) return { error: 'invalid link', status: 400 };
  return { link, pr };
}

// What the pay page shows about a request: only what the client already has
// on the request itself (no address, tax ID or email, in case a link is
// forwarded).
async function requestDetails(request, env) {
  const headers = cors(request, env);
  if (!headers) return json({ error: 'forbidden' }, 403);
  if (await rateLimited(request, env, 'request')) return json({ error: 'too many requests' }, 429, headers);
  const { link, pr, error, status } = await requestForLink(env, Object.fromEntries(new URL(request.url).searchParams));
  if (error) return json({ error }, status, headers);
  const state = pr.status === 'paid' ? 'paid'
    : pr.status !== 'open' ? pr.status
    : link.expired ? 'expired' : 'open';
  return json({
    number: pr.number,
    created: pr.created,
    expires: link.expires,
    status: state,
    client: { name: pr.client.name, company: pr.client.company || '' },
    items: pr.items.map(it => ({ description: it.description, quantity: it.quantity, unitMinor: it.unitMinor, totalMinor: it.totalMinor ?? Math.round(it.unitMinor * it.quantity) })),
    notes: pr.notes || '',
    amountMinor: pr.amountMinor,
    currency: pr.currency,
    pdf: pr.hasPdf,
  }, 200, headers);
}

// The request PDF, as issued. Opened from a link on the pay page, so it is a
// plain navigation (no CORS); the signed link is the only key.
async function requestPdf(request, env) {
  if (await rateLimited(request, env, 'request')) return json({ error: 'too many requests' }, 429);
  const { pr, error, status } = await requestForLink(env, Object.fromEntries(new URL(request.url).searchParams));
  if (error) return json({ error }, status);
  const pdf = await ledger(env).requestPdf(pr.number);
  if (!pdf) return json({ error: 'not found' }, 404);
  return new Response(pdf, { headers: { ...baseHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="payment-request-${pr.number}.pdf"` } });
}

async function checkout(request, env) {
  const headers = cors(request, env);
  if (!headers) return json({ error: 'forbidden' }, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({ error: 'expected JSON' }, 415, headers);

  if (await rateLimited(request, env, 'checkout')) return json({ error: 'too many requests' }, 429, headers);

  let body;
  try { body = JSON.parse(await readBody(request)); } catch { return json({ error: 'bad request' }, 400, headers); }
  if (!body || typeof body !== 'object') return json({ error: 'bad request' }, 400, headers);

  const link = await verify(body.link ?? {}, env.PAY_LINK_SECRET);
  if (!link) return json({ error: 'invalid link' }, 400, headers);
  if (link.expired) return json({ error: 'link expired' }, 410, headers);

  const p = provider(env);
  const method = body.method;
  if (!methodsOf(p, env).includes(method)) return json({ error: 'invalid method' }, 400, headers);

  // The link must match a payment request we issued, still open.
  const l = ledger(env);
  const pr = await l.getRequest(link.invoice);
  if (!pr || pr.amountMinor !== link.amountMinor || pr.currency !== link.currency) return json({ error: 'invalid link' }, 400, headers);
  if (pr.status === 'paid' || await l.invoiceHolder(link.invoice)) return json({ error: 'already paid' }, 409, headers);
  if (pr.status !== 'open') return json({ error: 'link expired' }, 410, headers);
  if (p.currencies && !p.currencies.includes(pr.currency)) return json({ error: 'currency not supported' }, 422, headers);

  // Receipts are emailed as signed computerized documents, which needs the
  // client's agreement (סעיף 18ב); the pay page requires the checkbox.
  if (body.consent !== true) return json({ error: 'consent required' }, 422, headers);
  const consent = { given: true, at: new Date().toISOString(), via: 'checkbox on the payment page', text: CONSENT_TEXT };

  const ref = crypto.randomUUID();
  const session = { invoice: link.invoice, amountMinor: link.amountMinor, currency: link.currency, method, consent, created: Date.now() };
  await putSession(env, ref, session);

  const workerOrigin = new URL(request.url).origin;
  let url, providerRef, providerToken, pageCode;
  try {
    const result = await p.createCheckout({
      ...session, ref, email: pr.client.email || '', name: pr.client.name, client: pr.client,
      items: pr.items, description: receiptDescription(pr),
      successUrl: `${env.SITE_URL}/pay/success/?ref=${ref}`,
      returnUrl: `${workerOrigin}/return/${env.PROVIDER}?ref=${ref}`,
      // Cancelling returns the client to the same payment link.
      cancelUrl: `${env.SITE_URL}/pay/?${linkQuery(body.link)}`,
      callbackUrl: `${workerOrigin}/webhook/${env.PROVIDER}?ref=${ref}`,
    }, env);
    ({ url, providerRef, providerToken, pageCode } = typeof result === 'string' ? { url: result } : result);
  } catch (e) {
    console.error('createCheckout failed', e.message);
    return json({ error: 'provider error' }, 502, headers);
  }
  if (providerRef) await putSession(env, ref, { ...session, providerRef, providerToken, pageCode });
  // Only ever send the browser to the provider's own pages.
  let target;
  try { target = new URL(url); } catch { return json({ error: 'provider error' }, 502, headers); }
  if (target.protocol !== 'https:' || !p.checkoutHosts(env).includes(target.hostname)) {
    console.error('unexpected checkout host', target.hostname);
    return json({ error: 'provider error' }, 502, headers);
  }
  return json({ url: target.href, ref }, 200, headers);
}

// Records a provider-confirmed payment and, the first time, issues the receipt.
async function markPaid(env, event, defer) {
  if (!event || !REF_RE.test(event.ref || '') || event.status !== 'paid') return null;
  const session = await getSession(env, event.ref);
  if (!session) return null;
  if (event.amountMinor !== session.amountMinor || event.currency !== session.currency) {
    console.error('amount mismatch', event.ref, event.amountMinor, event.currency);
    return null;
  }
  const l = ledger(env);
  const p = provider(env);
  const payment = {
    amountMinor: event.amountMinor, currency: event.currency, transactionId: event.transactionId,
    payerName: event.payerName, payerEmail: event.payerEmail, feeMinor: event.feeMinor, netMinor: event.netMinor,
    asmachta: event.asmachta, cardSuffix: event.cardSuffix, document: session.document,
    method: event.paidWith || session.method, provider: env.PROVIDER, consent: session.consent, paidOn: today(),
  };
  const { status, first } = await l.recordPayment(session.invoice, event.ref, payment);
  if (!first) return status;
  if (status === 'duplicate') {
    defer(duplicateAlert(env, session.invoice, event.ref, payment, p.label));
    return status;
  }
  // The provider issues the receipt (Grow): tell the owner the money arrived.
  if (p.issuesReceipts) {
    defer(paymentNotice(env, session.invoice, payment, p.label));
    return status;
  }
  // The receipt is built and emailed after the response, so the client is not
  // kept waiting on PDF generation.
  defer(receiptFor(env, session.invoice, payment));
  return status;
}

// What the payment was for (מהות התקבול): the request and its line items.
export function receiptDescription(pr) {
  const head = pr.lang === 'he' ? `תשלום עבור חשבון עסקה ${pr.number}` : `Payment for payment request ${pr.number}`;
  const what = pr.items.map(it => it.description).join('; ');
  const text = `${head}: ${what}`;
  return text.length > 300 ? text.slice(0, 299) + '…' : text;
}

// Issues the receipt for an online payment. Also used by the admin page to
// retry when it failed (for example before the business details were set).
export async function receiptFor(env, invoice, payment) {
  const l = ledger(env);
  try {
    const pr = await l.getRequest(invoice);
    return await issueReceipt(env, {
      requestNumber: pr.number, lang: pr.lang, client: pr.client,
      description: receiptDescription(pr),
      currency: pr.currency, amountMinor: pr.amountMinor, paidOn: payment.paidOn || today(),
      method: payment.method === 'card' ? 'card' : 'paypal',
      methodDetails: { transactionId: payment.transactionId, payerEmail: payment.payerEmail },
      consent: payment.consent, payment,
    });
  } catch (e) {
    console.error('receipt failed', invoice, e.message);
    await receiptFailedAlert(env, invoice, e.message);
    return null;
  }
}

async function webhook(request, env, name, defer) {
  if (name !== env.PROVIDER) return json({ error: 'not found' }, 404);
  const p = provider(env);
  let raw;
  try { raw = await readBody(request); } catch { return json({ error: 'bad request' }, 400); }
  // Unsigned notifications (Grow) name their checkout in the URL we gave the
  // provider, and are then confirmed with the provider directly.
  const ref = new URL(request.url).searchParams.get('ref') || '';
  const session = p.chargesOnPage && REF_RE.test(ref) ? await getSession(env, ref) : null;
  let event;
  try {
    event = await p.verifyWebhook(request, raw, env, session);
  } catch (e) {
    console.error('webhook check failed', e.message);
    return json({ error: 'try again' }, 503);
  }
  if (!event) return json({ error: 'invalid signature' }, 401);
  if (session) event = { ...event, ref };
  // The provider's receipt for this payment (Grow's invoiceNotifyUrl).
  if (event.status === 'document') {
    await putSession(env, ref, { ...session, document: event.document });
    await ledger(env).attachPaymentDocument(ref, event.document);
    return json({ ok: true });
  }
  return json({ ok: true, recorded: await markPaid(env, event, defer) });
}

// The provider sends the client here after paying (Grow) or approving
// (PayPal). Grow: ask Grow whether it was paid and record it. PayPal: claim the
// request, capture with our own credentials, record the payment and issue the
// receipt. Then on to the success page, which reads /status.
async function providerReturn(request, env, name, defer) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref') || '';
  const done = Response.redirect(`${env.SITE_URL}/pay/success/?ref=${REF_RE.test(ref) ? ref : ''}`, 303);
  if (name !== env.PROVIDER || !REF_RE.test(ref)) return done;
  const p = provider(env);
  if (!p.capture) return done;
  const session = await getSession(env, ref);
  if (p.chargesOnPage) {
    if (!session?.providerRef || await ledger(env).paymentStatus(ref)) return done;
    try {
      const event = await p.capture(session, env);
      if (event?.status === 'paid') await markPaid(env, { ...event, ref }, defer);
    } catch (e) {
      console.error('payment check failed', e.message);   // the server update will record it
    }
    return done;
  }
  // The provider's order id comes back in the URL; it must be the one we created.
  const returned = url.searchParams.get('token') || url.searchParams.get('order_id') || '';
  if (!session || !session.providerRef || returned !== session.providerRef || session.status) return done;

  const l = ledger(env);
  if (await l.paymentStatus(ref)) return done;          // already recorded (refresh)
  const claim = await l.claim(session.invoice, ref);
  if (!claim.ok) {
    // Paid through another checkout, or cancelled: never capture, so the
    // approved order is not collected and the client is not charged.
    await putSession(env, ref, { ...session, status: 'not_captured' });
    return done;
  }
  let event = null;
  try {
    event = await p.capture(session, env);
  } catch (e) {
    console.error('capture failed', e.message);
  }
  // If the provider echoes our reference, it must be this checkout's.
  if (event && event.status === 'paid' && (!event.ref || event.ref === ref)) {
    await markPaid(env, { ...event, ref }, defer);
  } else {
    await l.release(session.invoice, ref);
  }
  return done;
}

async function status(request, env) {
  const headers = cors(request, env) || {};
  const ref = new URL(request.url).searchParams.get('ref') || '';
  if (!REF_RE.test(ref)) return json({ status: 'unknown' }, 400, headers);
  const session = await getSession(env, ref);
  if (!session) return json({ status: 'unknown' }, 404, headers);
  let state = await ledger(env).paymentStatus(ref);
  if (!state) state = session.status === 'not_captured' ? 'already_paid' : 'pending';
  return json({ status: state, invoice: session.invoice, amountMinor: session.amountMinor, currency: session.currency }, 200, headers);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Work that runs after the response (receipts, emails).
    const defer = promise => (ctx?.waitUntil ? ctx.waitUntil(promise) : promise);
    try {
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return await admin(request, env, ctx);
      if (request.method === 'OPTIONS') {
        const headers = cors(request, env);
        if (!headers) return new Response(null, { status: 403, headers: baseHeaders });
        return new Response(null, { status: 204, headers: { ...baseHeaders, ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      }
      if (url.pathname === '/checkout' && request.method === 'POST') return await checkout(request, env);
      if (url.pathname === '/status' && request.method === 'GET') return await status(request, env);
      if (url.pathname === '/request' && request.method === 'GET') return await requestDetails(request, env);
      if (url.pathname === '/request.pdf' && request.method === 'GET') return await requestPdf(request, env);
      const back = url.pathname.match(/^\/return\/([a-z]+)$/);
      if (back && request.method === 'GET') return await providerReturn(request, env, back[1], defer);
      const hook = url.pathname.match(/^\/webhook\/([a-z]+)$/);
      if (hook && request.method === 'POST') return await webhook(request, env, hook[1], defer);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error('unhandled', e.message);
      return json({ error: 'server error' }, 500);
    }
  },
};
