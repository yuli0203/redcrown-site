// PayPal connector (Orders API v2), redirect flow: no PayPal script on our page.
//
//   createCheckout  POST /v2/checkout/orders -> PayPal's approval URL. The client
//                   pays there with PayPal or, as a guest, by card
//                   (landing_page GUEST_CHECKOUT shows the card form first).
//   capture         PayPal returns the client to the Worker, which captures the
//                   order server-to-server and reads the result.
//   verifyWebhook   PAYMENT.CAPTURE.COMPLETED, verified by PayPal's
//                   verify-webhook-signature API: a backup if the client closes
//                   the window before returning.
//
// Secrets (wrangler secret put): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET.
// Vars: PAYPAL_API_URL (sandbox https://api-m.sandbox.paypal.com, live
// https://api-m.paypal.com), PAYPAL_WEBHOOK_ID.

// Decimal string ("1250.50") -> minor units, without float rounding.
const toMinor = value => {
  const m = String(value ?? '').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : NaN;
};

const token = async env => {
  const res = await fetch(`${env.PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`PayPal auth failed (${res.status})`);
  return data.access_token;
};

const api = async (env, path, init = {}) => {
  const res = await fetch(`${env.PAYPAL_API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token(env)}`, 'Content-Type': 'application/json', ...init.headers },
  });
  return { res, data: await res.json().catch(() => null) };
};

// A completed capture from an order or capture response -> our event shape.
const fromCapture = (capture, ref) => capture && {
  ref: capture.custom_id || ref,
  status: capture.status === 'COMPLETED' ? 'paid' : String(capture.status || 'unknown').toLowerCase(),
  amountMinor: toMinor(capture.amount?.value),
  currency: String(capture.amount?.currency_code || '').toUpperCase(),
  transactionId: capture.id,
};
const firstCapture = order => order?.purchase_units?.[0]?.payments?.captures?.[0];

export default {
  checkoutHosts: env => (String(env.PAYPAL_API_URL).includes('sandbox') ? ['www.sandbox.paypal.com'] : ['www.paypal.com']),

  async createCheckout(s, env) {
    const value = (s.amountMinor / 100).toFixed(2);
    const { res, data } = await api(env, '/v2/checkout/orders', {
      method: 'POST',
      // Same ref -> same order if this request is retried.
      headers: { 'PayPal-Request-Id': s.ref },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: s.ref,
          custom_id: s.ref,
          description: `Invoice ${s.invoice}`,
          amount: { currency_code: s.currency, value },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'Red Crown Interactive',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              landing_page: s.method === 'card' ? 'GUEST_CHECKOUT' : 'LOGIN',
              return_url: s.returnUrl,
              cancel_url: s.cancelUrl,
            },
            ...(s.email ? { email_address: s.email } : {}),
          },
        },
      }),
    });
    const url = data?.links?.find(l => l.rel === 'payer-action')?.href;
    if (!res.ok || !url || !data.id) throw new Error(`PayPal create order failed (${res.status})`);
    return { url, providerRef: data.id };
  },

  // Called when PayPal sends the client back with ?token=<order id>.
  async capture(session, env) {
    const id = encodeURIComponent(session.providerRef);
    const { res, data } = await api(env, `/v2/checkout/orders/${id}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': 'capture-' + session.providerRef },
      body: '{}',
    });
    if (res.ok) return fromCapture(firstCapture(data), null);
    // Already captured (a refresh, or the webhook got there first): read the order.
    const order = await api(env, `/v2/checkout/orders/${id}`);
    return order.res.ok ? fromCapture(firstCapture(order.data), null) : null;
  },

  async verifyWebhook(request, raw, env) {
    let event;
    try { event = JSON.parse(raw); } catch { return null; }
    const h = name => request.headers.get(name);
    if (!env.PAYPAL_WEBHOOK_ID || !h('paypal-transmission-sig')) return null;
    const { res, data } = await api(env, '/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: h('paypal-auth-algo'),
        cert_url: h('paypal-cert-url'),
        transmission_id: h('paypal-transmission-id'),
        transmission_sig: h('paypal-transmission-sig'),
        transmission_time: h('paypal-transmission-time'),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    });
    if (!res.ok || data?.verification_status !== 'SUCCESS') return null;
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return { ref: null, status: 'ignored' };
    return fromCapture(event.resource, null);
  },

  toMinor,
};
