// Small HTTP helpers shared by the payment API and the admin API.
export const MAX_BODY = 64 * 1024;

export const baseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json', ...extra } });

export const cors = (request, env) => {
  const origin = request.headers.get('Origin');
  return origin && origin === env.ALLOWED_ORIGIN
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : null;
};

// Payment API bodies are tiny; admin bodies (line items) are larger.
export const readBody = async (request, max = 4096) => {
  const text = await request.text();
  if (text.length > max) throw new Error('body too large');
  return text;
};
