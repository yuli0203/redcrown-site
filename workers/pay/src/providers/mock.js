// Test-only provider: no network, webhooks signed with MOCK_WEBHOOK_SECRET.
// Refused when ENVIRONMENT is "production".
const enc = new TextEncoder();

const hmacHex = async (secret, body) => {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
};

export default {
  testOnly: true,
  label: 'Test',
  checkoutHosts: () => ['checkout.mock.test'],
  async createCheckout(s) {
    const providerRef = 'ORDER-' + s.ref.slice(0, 8);
    return { url: `https://checkout.mock.test/pay?ref=${s.ref}&method=${s.method}&return=${encodeURIComponent(s.returnUrl)}&token=${providerRef}`, providerRef };
  },
  // Pretends the client approved: a completed capture for the session's amount.
  async capture(session) {
    return { status: 'paid', amountMinor: session.amountMinor, currency: session.currency, transactionId: 'cap-' + session.providerRef };
  },
  async verifyWebhook(request, raw, env) {
    const given = request.headers.get('x-mock-signature') || '';
    if (!env.MOCK_WEBHOOK_SECRET || given !== await hmacHex(env.MOCK_WEBHOOK_SECRET, raw)) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  hmacHex,
};
