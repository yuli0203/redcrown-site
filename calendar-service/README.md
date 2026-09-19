# Red Crown Calendar service

This service adds durable settings, encrypted calendar connections and real booking endpoints to the existing static calendar UI. It is implemented and tested locally. It is not deployed or connected to real provider credentials yet.

## Local development

Requires Node 24. In this directory:

1. `npm ci`
2. `npm test`
3. `npm run dev`
4. Open `http://127.0.0.1:8770/calendar/`.

The server stores local data in ignored `calendar.sqlite` files and generates an ignored `.dev.vars` encryption key on first start. Add provider values from `.dev.vars.example` to that file without replacing the generated key. Do not commit secrets. The server verifies real Firebase ID tokens. There is no development authentication bypass in `dev.js` or production code.

An isolated test-only browser fixture is available with `node test/browser-fixture.js` at port 8771. It uses sample data, an in-memory database and fake provider responses. No emails or real calendar writes occur there. Never expose this fixture publicly.

## Production setup remaining

The existing website README specifies Cloudflare Pages. This service is a separate Worker using D1; route `/calendar/api/*` on the same domain to it. Keep the existing Pages site for other paths.

1. Sign in using `npx wrangler login`. This machine currently has no Cloudflare CLI session.
2. Create a D1 database named `red-crown-calendar`; copy its ID into `wrangler.jsonc`.
3. Apply the migrations with `npx wrangler d1 migrations apply red-crown-calendar --remote`.
4. Add a Worker route for `redcrowninteractive.com/calendar/api/*` in the correct zone. Keep `PUBLIC_ORIGIN` exactly `https://redcrowninteractive.com`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET` through Cloudflare secrets/configuration. Use `wrangler secret put NAME` for secrets. Never paste secrets into chat or public files.
6. In the Google OAuth web client, register `https://redcrowninteractive.com/calendar/api/oauth/google/callback` (and `http://127.0.0.1:8770/calendar/api/oauth/google/callback` for local testing). The server requests calendar event access to read names and create/cancel bookings, plus the calendar list and identity. Refresh access is requested using the authorization-code flow. Google verification and production scope approval still need review.
7. Register a Microsoft application supporting the intended personal and organization accounts, with delegated `User.Read`, `Calendars.ReadWrite` and `offline_access` permissions. Register the analogous `/oauth/microsoft/callback` URLs. Firebase Microsoft sign-in is a separate provider configuration and remains to be activated.
8. Configure a Turnstile widget for the production domain. The production booking endpoint refuses bookings without configured protection. Local-only bypass requires both the configured origin and request origin to be localhost.
9. Build-check with `npm run check`. Deploy only after secrets, route, provider consent and database configuration are ready.
10. Perform a live acceptance test with dedicated test calendars: connect two accounts, select sub-calendars, reload, create a meeting, publish, book as a guest, verify the calendar invitation, reschedule, cancel, revoke calendar access and verify bookings fail closed.

Cloudflare's free tier is a starting point, not unlimited infrastructure. Measure Worker CPU and D1 usage on live provider traffic before public launch. Free-tier requests can fail after quota exhaustion. Multi-account providers can also exceed Worker subrequest quotas; load testing and batching/caching are required before scaling beyond small workspaces.

The static site's `.cfignore` excludes this service, tests and dependency folders from Pages uploads. Secrets and databases are additionally Git-ignored. Do not serve this repository wholesale with a generic public file server.

## Current behavior

- Private requests verify Firebase signatures, issuer, audience and ownership. Publishing requires verified email.
- Google and Microsoft refresh tokens are encrypted using AES-GCM. They never reach the browser. Token revocation still requires the owner to reconnect.
- Settings use version checks to avoid overwriting another tab's updates. Names and profile assets appear on permanent public links.
- Weekly hours support multiple windows; date overrides can close a day or replace its hours. The UI can import major Jewish holiday closures for Israel or the diaspora using Hebcal. Holiday eve/sunset rules and other national holiday catalogs are not implemented.
- Duration, start interval, before/after buffers, minimum notice, booking horizon and daily limits are checked server-side. DST gaps and ambiguous local start times are excluded.
- Public endpoints return slots, not event names, calendar identities, refresh tokens or other guests' details.
- Busy calendars are rechecked on booking. A single atomic SQL operation reserves the buffered interval across all meeting types. External calendar applications can still change events after that check; no provider offers a transaction spanning its calendar and our database.
- Deterministic provider request IDs support retries. Failed/uncertain provider writes retain a pending reservation; the host can retry from Upcoming bookings. No automatic release risks double-booking an event that might already exist.
- Rescheduling reserves the replacement, writes it, cancels the old event, then confirms the change. While a failure is pending, both times stay reserved. Overlapping moves into the existing meeting's own busy time are currently excluded; choose another available slot.
- Cancellation uses an unguessable management token. The host can manage bookings from their account. Calendar invitations come from Google/Microsoft; standalone reminder emails/SMS are not implemented.
- Microsoft integrations, OAuth consent, invitation delivery, Turnstile and encrypted refresh-token rotation require live credential testing before launch.
- No iCloud/CalDAV/ICS subscription connector, team scheduling, payments, conferencing provisioning or CRM integration is claimed.

## Review evidence

Automated suites cover scheduling/DST, buffers, overrides, ownership, public data minimization, conflicting bookings, pending-write retries, cancellation, rescheduling, version conflicts, encryption, Google busy errors, all-day time zones and Microsoft pagination origin restrictions. Existing browser connector tests remain in `../tools`.

Browser QA with the isolated provider fixture completed: meeting creation, saved availability, public booking, rescheduling and cancellation. Google/Microsoft live writes have not been exercised in this pass. The review is intentionally not labeled production-complete until the live acceptance gate passes.

References: [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Microsoft calendar view](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview), [Hebcal API](https://www.hebcal.com/home/195/jewish-calendar-rest-api).
