// Red Crown payment API (Cloudflare Worker).
//
//   POST /checkout          signed link + method -> provider checkout URL
//   GET  /return/<name>     provider sends the client back; capture, then
//                           redirect to the success page (providers that need it)
//   POST /webhook/<name>    provider's signed payment notification
//   GET  /status?ref=...    paid / pending, for the success page
//
// Trust rules:
// - The amount charged is the amount in a link we signed (links.js), never a
//   number the browser chose.
// - An invoice counts as paid only when the provider says so server-to-server
//   (a signed webhook, or a capture call made with our credentials) and the
//   amount and currency match the checkout we created. A redirect proves nothing.
// - Secrets come from Worker secrets (wrangler secret put). None are in this
//   public repository.
import { verify } from './links.js';
import { providers } from './providers/index.js';

const METHODS = ['card', 'paypal', 'googlepay', 'applepay'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REF_RE = /^[0-9a-f-]{36}$/;
const MAX_BODY = 4096;
const SESSION_TTL = 60 * 60 * 24 * 7;  // a checkout reference lives a week

const baseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json', ...extra } });

const cors = (request, env) => {
  const origin = request.headers.get('Origin');
  return origin && origin === env.ALLOWED_ORIGIN
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : null;
};

const readBody = async request => {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('body too large');
  return text;
};

const provider = env => {
  const p = providers[env.PROVIDER];
  if (!p) throw new Error('PROVIDER is not configured');
  if (p.testOnly && env.ENVIRONMENT === 'production') throw new Error('test provider in production');
  return p;
};

const linkQuery = l => new URLSearchParams({ i: l.i, a: l.a, c: l.c, x: l.x, s: l.s }).toString();

async function checkout(request, env) {
  const headers = cors(request, env);
  if (!headers) return json({ error: 'forbidden' }, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({ error: 'expected JSON' }, 415, headers);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: 'checkout:' + ip });
    if (!success) return json({ error: 'too many requests' }, 429, headers);
  }

  let body;
  try { body = JSON.parse(await readBody(request)); } catch { return json({ error: 'bad request' }, 400, headers); }
  if (!body || typeof body !== 'object') return json({ error: 'bad request' }, 400, headers);

  const link = await verify(body.link ?? {}, env.PAY_LINK_SECRET);
  if (!link) return json({ error: 'invalid link' }, 400, headers);
  if (link.expired) return json({ error: 'link expired' }, 410, headers);

  const method = body.method;
  if (!METHODS.includes(method)) return json({ error: 'invalid method' }, 400, headers);
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (email && !EMAIL_RE.test(email)) return json({ error: 'invalid email' }, 400, headers);

  if (await env.PAYMENTS.get('paid:' + link.invoice)) return json({ error: 'already paid' }, 409, headers);

  const ref = crypto.randomUUID();
  const session = { invoice: link.invoice, amountMinor: link.amountMinor, currency: link.currency, method, created: Date.now() };
  await env.PAYMENTS.put('session:' + ref, JSON.stringify(session), { expirationTtl: SESSION_TTL });

  const p = provider(env);
  const workerOrigin = new URL(request.url).origin;
  let url, providerRef;
  try {
    const result = await p.createCheckout({
      ...session, ref, email, name,
      successUrl: `${env.SITE_URL}/pay/success/?ref=${ref}`,
      returnUrl: `${workerOrigin}/return/${env.PROVIDER}?ref=${ref}`,
      // Cancelling returns the client to the same payment link.
      cancelUrl: `${env.SITE_URL}/pay/?${linkQuery(body.link)}`,
      callbackUrl: `${workerOrigin}/webhook/${env.PROVIDER}`,
    }, env);
    ({ url, providerRef } = typeof result === 'string' ? { url: result } : result);
  } catch (e) {
    console.error('createCheckout failed', e.message);
    return json({ error: 'provider error' }, 502, headers);
  }
  if (providerRef) {
    await env.PAYMENTS.put('session:' + ref, JSON.stringify({ ...session, providerRef }), { expirationTtl: SESSION_TTL });
  }
  // Only ever send the browser to the provider's own pages.
  let target;
  try { target = new URL(url); } catch { return json({ error: 'provider error' }, 502, headers); }
  if (target.protocol !== 'https:' || !p.checkoutHosts(env).includes(target.hostname)) {
    console.error('unexpected checkout host', target.hostname);
    return json({ error: 'provider error' }, 502, headers);
  }
  return json({ url: target.href, ref }, 200, headers);
}

const getSession = async (env, ref) => JSON.parse(await env.PAYMENTS.get('session:' + ref) || 'null');

// Records a provider-confirmed payment. Returns true if the invoice is paid.
// Idempotent: providers retry, and a repeat must change nothing.
async function markPaid(env, event) {
  if (!event || !REF_RE.test(event.ref || '') || event.status !== 'paid') return false;
  const session = await getSession(env, event.ref);
  if (!session) return false;
  if (event.amountMinor !== session.amountMinor || event.currency !== session.currency) {
    console.error('amount mismatch', event.ref, event.amountMinor, event.currency);
    return false;
  }
  const existing = JSON.parse(await env.PAYMENTS.get('paid:' + session.invoice) || 'null');
  if (!existing) {
    const record = { ...session, ref: event.ref, transactionId: event.transactionId, paidAt: Date.now() };
    await env.PAYMENTS.put('paid:' + session.invoice, JSON.stringify(record));
  }
  await env.PAYMENTS.put('session:' + event.ref, JSON.stringify({ ...session, status: 'paid' }), { expirationTtl: SESSION_TTL });
  return true;
}

async function webhook(request, env, name) {
  if (name !== env.PROVIDER) return json({ error: 'not found' }, 404);
  const p = provider(env);
  let raw;
  try { raw = await readBody(request); } catch { return json({ error: 'bad request' }, 400); }

  const event = await p.verifyWebhook(request, raw, env);
  if (!event) return json({ error: 'invalid signature' }, 401);
  return json({ ok: true, recorded: await markPaid(env, event) });
}

// The provider sends the client here after they approve. We capture with our
// own credentials, then send them to the success page, which reads /status.
async function providerReturn(request, env, name) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref') || '';
  const done = Response.redirect(`${env.SITE_URL}/pay/success/?ref=${REF_RE.test(ref) ? ref : ''}`, 303);
  if (name !== env.PROVIDER || !REF_RE.test(ref)) return done;
  const p = provider(env);
  if (!p.capture) return done;
  const session = await getSession(env, ref);
  // The provider's order id comes back in the URL; it must be the one we created.
  const returned = url.searchParams.get('token') || url.searchParams.get('order_id') || '';
  if (!session || !session.providerRef || returned !== session.providerRef || session.status === 'paid') return done;
  try {
    const event = await p.capture(session, env);
    // If the provider echoes our reference, it must be this checkout's.
    if (event && (!event.ref || event.ref === ref)) await markPaid(env, { ...event, ref });
  } catch (e) {
    console.error('capture failed', e.message);
  }
  return done;
}

async function status(request, env) {
  const headers = cors(request, env) || {};
  const ref = new URL(request.url).searchParams.get('ref') || '';
  if (!REF_RE.test(ref)) return json({ status: 'unknown' }, 400, headers);
  const session = await getSession(env, ref);
  if (!session) return json({ status: 'unknown' }, 404, headers);
  const paid = session.status === 'paid' || !!(await env.PAYMENTS.get('paid:' + session.invoice));
  return json({ status: paid ? 'paid' : 'pending', invoice: session.invoice, amountMinor: session.amountMinor, currency: session.currency }, 200, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        const headers = cors(request, env);
        if (!headers) return new Response(null, { status: 403, headers: baseHeaders });
        return new Response(null, { status: 204, headers: { ...baseHeaders, ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      }
      if (url.pathname === '/checkout' && request.method === 'POST') return await checkout(request, env);
      if (url.pathname === '/status' && request.method === 'GET') return await status(request, env);
      const back = url.pathname.match(/^\/return\/([a-z]+)$/);
      if (back && request.method === 'GET') return await providerReturn(request, env, back[1]);
      const hook = url.pathname.match(/^\/webhook\/([a-z]+)$/);
      if (hook && request.method === 'POST') return await webhook(request, env, hook[1]);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error('unhandled', e.message);
      return json({ error: 'server error' }, 500);
    }
  },
};

