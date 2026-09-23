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
  checkoutHosts: () => ['checkout.mock.test'],
  async createCheckout(s) {
    return `https://checkout.mock.test/pay?ref=${s.ref}&method=${s.method}`;
  },
  async verifyWebhook(request, raw, env) {
    const given = request.headers.get('x-mock-signature') || '';
    if (!env.MOCK_WEBHOOK_SECRET || given !== await hmacHex(env.MOCK_WEBHOOK_SECRET, raw)) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  hmacHex,
};
