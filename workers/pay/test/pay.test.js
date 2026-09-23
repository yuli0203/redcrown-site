import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, toQuery } from '../src/links.js';
import worker from '../src/index.js';
import mock from '../src/providers/mock.js';
import payplus from '../src/providers/payplus.js';

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
