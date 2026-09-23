import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, toQuery } from '../src/links.js';
import worker from '../src/index.js';
import mock from '../src/providers/mock.js';
import payplus from '../src/providers/payplus.js';
import paypal from '../src/providers/paypal.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const ORIGIN = 'https://redcrowninteractive.com';
const future = () => Math.floor(Date.now() / 1000) + 3600;

const kv = () => {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, map: m };
};
const envFor = (extra = {}) => ({
  PAY_LINK_SECRET: SECRET, PROVIDER: 'mock', ENVIRONMENT: 'test', MOCK_WEBHOOK_SECRET: 'hook-secret',
  ALLOWED_ORIGIN: ORIGIN, SITE_URL: ORIGIN, PAYMENTS: kv(), ...extra,
});
const linkParams = async (over = {}) => {
  const s = await sign({ invoice: 'RC-2026-014', amountMinor: 125000, currency: 'USD', expires: future(), ...over }, SECRET);
  return Object.fromEntries(new URLSearchParams(toQuery(s)));
};
const post = (path, body, headers = {}) => new Request('https://pay-api.test' + path, {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
});
const checkout = async (env, body) => worker.fetch(post('/checkout', body), env);
const hook = async (env, event, sig) => {
  const raw = JSON.stringify(event);
  return worker.fetch(post('/webhook/mock', raw, { 'x-mock-signature': sig ?? await mock.hmacHex('hook-secret', raw) }), env);
};

test('links: round trip, tampering, wrong secret, expiry', async () => {
  const p = await linkParams();
  assert.equal((await verify(p, SECRET)).amountMinor, 125000);
  assert.equal(await verify({ ...p, a: '100' }, SECRET), null);
  assert.equal(await verify({ ...p, c: 'EUR' }, SECRET), null);
  assert.equal(await verify({ ...p, i: 'RC-2026-015' }, SECRET), null);
  assert.equal(await verify(p, SECRET.replace('t', 'T')), null);
  assert.equal(await verify({ ...p, s: 'x' }, SECRET), null);
  const old = await linkParams({ expires: 1000 });
  assert.equal((await verify(old, SECRET)).expired, true);
  await assert.rejects(sign({ invoice: 'RC-1', amountMinor: 100, currency: 'USD', expires: future() }, 'short'));
  await assert.rejects(sign({ invoice: 'RC-2026-014', amountMinor: 1.5, currency: 'USD', expires: future() }, SECRET));
});

test('checkout: rejects other origins, bad and expired links, bad methods', async () => {
  const env = envFor();
  const link = await linkParams();
  const foreign = await worker.fetch(post('/checkout', { link, method: 'card' }, { Origin: 'https://evil.test' }), env);
  assert.equal(foreign.status, 403);
  assert.equal((await checkout(env, { link: { ...link, a: '1' }, method: 'card' })).status, 400);
  assert.equal((await checkout(env, { link: await linkParams({ expires: 1000 }), method: 'card' })).status, 410);
  assert.equal((await checkout(env, { link, method: 'bitcoin' })).status, 400);
  assert.equal((await checkout(env, '{not json')).status, 400);
  assert.equal((await checkout(env, 'null')).status, 400);
});

test('full flow: checkout, forged and mismatched webhooks ignored, paid once', async () => {
  const env = envFor();
  const link = await linkParams();
  const res = await checkout(env, { link, method: 'googlepay', email: 'a@acme.com', name: 'Dana' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const { url, ref } = await res.json();
  assert.equal(new URL(url).hostname, 'checkout.mock.test');

  const statusOf = async () => (await (await worker.fetch(new Request('https://pay-api.test/status?ref=' + ref), env)).json()).status;
  assert.equal(await statusOf(), 'pending');

  const paid = { ref, status: 'paid', amountMinor: 125000, currency: 'USD', transactionId: 't1' };
  assert.equal((await hook(env, paid, 'forged')).status, 401);
  await hook(env, { ...paid, amountMinor: 100 });
  await hook(env, { ...paid, currency: 'ILS' });
  assert.equal(await statusOf(), 'pending');

  assert.equal((await hook(env, paid)).status, 200);
  assert.equal(await statusOf(), 'paid');
  await hook(env, { ...paid, transactionId: 't2' });   // retry / duplicate
  assert.equal(JSON.parse(env.PAYMENTS.map.get('paid:RC-2026-014')).transactionId, 't1');

  assert.equal((await checkout(env, { link, method: 'card' })).status, 409);
});

test('mock provider is refused in production', async () => {
  const env = envFor({ ENVIRONMENT: 'production' });
  const res = await checkout(env, { link: await linkParams(), method: 'card' });
  assert.equal(res.status, 500);
});

test('payplus: webhook signature check and amount parsing', async () => {
  const env = { PAYPLUS_SECRET_KEY: 'pp-secret' };
  const raw = JSON.stringify({ transaction: { more_info: 'r', status_code: '000', amount: '1250.5', currency: 'usd', uid: 'u1' } });
  const signed = new Request('https://x.test', { method: 'POST', headers: { hash: await payplus.hmacBase64('pp-secret', raw) } });
  assert.deepEqual(await payplus.verifyWebhook(signed, raw, env), { ref: 'r', status: 'paid', amountMinor: 125050, currency: 'USD', transactionId: 'u1' });
  const forged = new Request('https://x.test', { method: 'POST', headers: { hash: 'AAAA' } });
  assert.equal(await payplus.verifyWebhook(forged, raw, env), null);
});

test('return route: captures with the matching order id only', async () => {
  const env = envFor();
  const res = await checkout(env, { link: await linkParams(), method: 'paypal' });
  const { url, ref } = await res.json();
  const order = new URL(url).searchParams.get('token');
  const statusOf = async () => (await (await worker.fetch(new Request('https://pay-api.test/status?ref=' + ref), env)).json()).status;

  const wrong = await worker.fetch(new Request(`https://pay-api.test/return/mock?ref=${ref}&token=ORDER-forged`), env);
  assert.equal(wrong.status, 303);
  assert.equal(await statusOf(), 'pending');

  const back = await worker.fetch(new Request(`https://pay-api.test/return/mock?ref=${ref}&token=${order}`), env);
  assert.equal(back.status, 303);
  assert.equal(back.headers.get('Location'), `${ORIGIN}/pay/success/?ref=${ref}`);
  assert.equal(await statusOf(), 'paid');
});

test('paypal: order creation, capture and webhook verification', async () => {
  const env = { PAYPAL_API_URL: 'https://api-m.sandbox.paypal.com', PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_WEBHOOK_ID: 'wh' };
  const calls = [];
  const realFetch = globalThis.fetch;
  let verifyStatus = 'SUCCESS';
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body && init.body !== 'grant_type=client_credentials' ? JSON.parse(init.body) : null;
    calls.push({ path, body, headers: init.headers });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (path === '/v1/oauth2/token') return reply({ access_token: 'tok' });
    if (path === '/v2/checkout/orders') return reply({ id: 'ORD1', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1' }] }, 201);
    if (path === '/v2/checkout/orders/ORD1/capture') return reply({ purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', custom_id: 'r1', amount: { currency_code: 'USD', value: '1250.50' } }] } }] }, 201);
    if (path === '/v1/notifications/verify-webhook-signature') return reply({ verification_status: verifyStatus });
    return reply({}, 404);
  };
  try {
    const out = await paypal.createCheckout({ ref: 'r1', invoice: 'RC-2026-014', amountMinor: 125050, currency: 'USD', method: 'card', returnUrl: 'https://w/return', cancelUrl: 'https://s/pay/' }, env);
    assert.deepEqual(out, { url: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1', providerRef: 'ORD1' });
    const order = calls.find(c => c.path === '/v2/checkout/orders').body;
    assert.equal(order.purchase_units[0].amount.value, '1250.50');
    assert.equal(order.purchase_units[0].custom_id, 'r1');
    assert.equal(order.payment_source.paypal.experience_context.landing_page, 'GUEST_CHECKOUT');
    assert.deepEqual(paypal.checkoutHosts(env), ['www.sandbox.paypal.com']);

    assert.deepEqual(await paypal.capture({ providerRef: 'ORD1' }, env),
      { ref: 'r1', status: 'paid', amountMinor: 125050, currency: 'USD', transactionId: 'CAP1' });

    const raw = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP1', status: 'COMPLETED', custom_id: 'r1', amount: { currency_code: 'USD', value: '1250.50' } } });
    const req = new Request('https://x.test', { method: 'POST', headers: { 'paypal-transmission-sig': 'sig', 'paypal-transmission-id': 't', 'paypal-transmission-time': 'now', 'paypal-cert-url': 'https://api.paypal.com/cert', 'paypal-auth-algo': 'SHA256withRSA' } });
    assert.equal((await paypal.verifyWebhook(req, raw, env)).status, 'paid');
    verifyStatus = 'FAILURE';
    assert.equal(await paypal.verifyWebhook(req, raw, env), null);
    assert.equal(await paypal.verifyWebhook(new Request('https://x.test', { method: 'POST' }), raw, env), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
