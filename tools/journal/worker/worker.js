/*
 * The journal API: the only way the dashboard at /seo gets its data.
 *
 * GitHub Pages cannot check who is asking, so the sensitive half of the
 * dashboard - the keyword queue, the competitor analysis, the audit - is not
 * published with the site at all. It lives here, behind the same Firebase
 * sign-in the calendar already uses, and is handed out only to a verified
 * address on the owners list.
 *
 * Two callers, two different credentials:
 *   GET  /seo/api/state   a signed-in owner, with a Firebase ID token
 *   PUT  /seo/api/state   the publish step, with the shared publish key
 *
 * Deploy: see README.md in this directory.
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const MAX_BODY = 2_000_000;

const list = value => String(value || '').split(',').map(entry => entry.trim().toLowerCase()).filter(Boolean);

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = list(env.ALLOWED_ORIGINS);
  // An unlisted origin gets no CORS headers, so a browser on another site
  // cannot read a response even if it somehow holds a token.
  if (!allowed.includes(origin.toLowerCase())) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type, x-journal-key',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

const reply = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });

/* Constant-time comparison: a shared key must not leak through timing. */
function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/* Ask Google whether this ID token is real, rather than verifying the
   signature here. One extra request per dashboard load is a fair price for
   not maintaining JWT and key-rotation code in a single-user tool. */
async function owner(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error: 'Sign in to continue.', status: 401 };

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }) },
  );
  if (!response.ok) return { error: 'Your session expired. Sign in again.', status: 401 };

  const user = (await response.json()).users?.[0];
  if (!user) return { error: 'Your session expired. Sign in again.', status: 401 };
  if (!user.emailVerified) return { error: 'Verify your email address first.', status: 403 };

  const email = String(user.email || '').toLowerCase();
  const owners = list(env.OWNER_EMAILS);
  if (!owners.includes(email)) return { error: 'This account does not have access to the journal.', status: 403 };
  return { email };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request, env);
    const siteId = (env.SITE_ID || 'redcrowninteractive').toLowerCase();

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/seo/api/health') return reply({ ready: true, siteId }, 200, headers);

    /* The content plan: which keyword the engine should write on which day.
       The dashboard writes it as the owner; the publish step reads it with the
       publish key, so a scheduled run knows what was planned for today. */
    if (url.pathname === '/seo/api/plan') {
      const key = `plan:${siteId}`;
      if (request.method === 'GET') {
        const publisher = sameKey(request.headers.get('X-Journal-Key') || '', env.PUBLISH_KEY || '');
        if (!publisher) {
          const who = await owner(request, env);
          if (who.error) return reply({ error: who.error }, who.status, headers);
        }
        return new Response(await env.JOURNAL.get(key) || '{"days":{}}', { status: 200, headers: { ...JSON_HEADERS, ...headers } });
      }
      if (request.method === 'PUT') {
        const who = await owner(request, env);
        if (who.error) return reply({ error: who.error }, who.status, headers);
        const body = await request.text();
        if (body.length > MAX_BODY) return reply({ error: 'Plan too large.' }, 413, headers);
        let plan;
        try {
          plan = JSON.parse(body);
        } catch {
          return reply({ error: 'Plan is not JSON.' }, 400, headers);
        }
        if (!plan || typeof plan.days !== 'object' || Array.isArray(plan.days)) return reply({ error: 'Plan needs a days object.' }, 400, headers);
        // A day maps to one keyword. Anything else is rejected rather than stored.
        for (const [day, keyword] of Object.entries(plan.days)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return reply({ error: `Not a date: ${day}` }, 400, headers);
          if (typeof keyword !== 'string' || keyword.length > 200) return reply({ error: `Not a keyword: ${day}` }, 400, headers);
        }
        await env.JOURNAL.put(key, JSON.stringify({ days: plan.days, updatedAt: new Date().toISOString(), updatedBy: who.email }));
        return reply({ saved: true, days: Object.keys(plan.days).length }, 200, headers);
      }
      return reply({ error: 'Method not allowed.' }, 405, headers);
    }

    if (url.pathname !== '/seo/api/state') return reply({ error: 'Not found.' }, 404, headers);

    if (request.method === 'PUT') {
      if (!sameKey(request.headers.get('X-Journal-Key') || '', env.PUBLISH_KEY || '')) {
        return reply({ error: 'Bad publish key.' }, 403, headers);
      }
      const body = await request.text();
      if (body.length > MAX_BODY) return reply({ error: 'Snapshot too large.' }, 413, headers);
      let snapshot;
      try {
        snapshot = JSON.parse(body);
      } catch {
        return reply({ error: 'Snapshot is not JSON.' }, 400, headers);
      }
      if (!snapshot || !Array.isArray(snapshot.posts)) return reply({ error: 'Snapshot is missing its posts.' }, 400, headers);
      await env.JOURNAL.put(`state:${siteId}`, JSON.stringify({ ...snapshot, storedAt: new Date().toISOString() }));
      return reply({ stored: true, posts: snapshot.posts.length }, 200, headers);
    }

    if (request.method === 'GET') {
      const who = await owner(request, env);
      if (who.error) return reply({ error: who.error }, who.status, headers);
      const stored = await env.JOURNAL.get(`state:${siteId}`);
      if (!stored) return reply({ error: 'Nothing has been published yet.' }, 404, headers);
      return new Response(stored, { status: 200, headers: { ...JSON_HEADERS, ...headers } });
    }

    return reply({ error: 'Method not allowed.' }, 405, headers);
  },
};
