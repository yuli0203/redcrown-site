# Red Crown Calendar service

This service adds durable settings, encrypted calendar connections and real booking endpoints to the existing static calendar UI. The local scheduling flow is tested. Live provider credentials and acceptance testing remain required before enabling public bookings.

## Local development

Requires Node 24. In this directory:

1. `npm ci`
2. `npm test`
3. `npm run dev`
4. Open `http://127.0.0.1:8769/calendar/`. Stop any static preview server already using port 8769 before starting this service.

Use this Node server for calendar development, not Python http.server: it serves both the frontend and authenticated API. It also listens on port 8770 for the registered Google OAuth callback and returns to port 8769, preserving the existing Firebase session and browser drafts. Override PORT and CALLBACK_PORT only when the matching OAuth redirect is registered. Check `/calendar/api/health` on port 8769 to confirm the backend is connected.

The server stores local data in ignored `calendar.sqlite` files and generates an ignored `.dev.vars` encryption key on first start. Add provider values from `.dev.vars.example` to that file without replacing the generated key. Do not commit secrets. The server verifies real Firebase ID tokens. There is no development authentication bypass in `dev.js` or production code.

An isolated test-only browser fixture is available with `node test/browser-fixture.js` at port 8771. It uses sample data, an in-memory database and fake provider responses. No emails or real calendar writes occur there. Never expose this fixture publicly.

## Production setup remaining

Keep Porkbun DNS and the existing GitHub Pages website. This service is a separate Worker using D1 at `https://red-crown-calendar-api.yuli0203.workers.dev`. No nameserver change is needed. The root website README describes an earlier Pages plan; live DNS points to GitHub Pages.

1. Cloudflare CLI authorization completed on 2026-09-19. Use `npx wrangler whoami` to verify the current session.
2. D1 database `red-crown-calendar` was created in the account specified in `wrangler.jsonc`; its binding is configured.
3. Migrations 0001, 0002 and 0003 were applied remotely and verified with `npx wrangler d1 migrations list red-crown-calendar --remote` (no pending migrations).
4. Keep `PUBLIC_ORIGIN` exactly `https://redcrowninteractive.com` and `API_ORIGIN` set to the separate Worker origin. After live acceptance, add public `apiOrigin` to `calendar/auth-config.json`. The API allows only the configured website origin through CORS; authenticated calls use Firebase bearer tokens. Calendar OAuth starts with a top-level form POST so its HttpOnly cookie is first-party, including in browsers that block third-party cookies.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET` through Cloudflare secrets/configuration. Use `wrangler secret put NAME` for secrets. Never paste secrets into chat or public files.
6. In the Google OAuth web client, register `https://red-crown-calendar-api.yuli0203.workers.dev/calendar/api/oauth/google/callback` (and `http://127.0.0.1:8770/calendar/api/oauth/google/callback` for local testing). The server requests calendar event access to read names and create/cancel bookings, plus the calendar list and identity. Refresh access is requested using the authorization-code flow. Google verification and production scope approval still need review.
7. Register a Microsoft application supporting the intended personal and organization accounts, with delegated `User.Read`, `Calendars.ReadWrite` and `offline_access` permissions. Register the analogous `/oauth/microsoft/callback` URLs. Firebase Microsoft sign-in is a separate provider configuration and remains to be activated.
8. Configure a Turnstile widget for the production domain. The production booking endpoint refuses bookings without configured protection. Local-only bypass requires both the configured origin and request origin to be localhost.
9. Build-check with `npm run check`. Deploy the API independently; do not connect the public frontend until provider consent, secrets, Turnstile and acceptance testing are ready.
10. Perform a live acceptance test with dedicated test calendars: connect two accounts, select sub-calendars, reload, create a meeting, publish, book as a guest, verify the calendar invitation, reschedule, cancel, revoke calendar access and verify bookings fail closed.

The user chose to retain Porkbun DNS and GitHub Pages. Worker deployment is independent of both. No domain transfer, nameserver change or website replacement is required. Google and Microsoft provider secrets remain outstanding. The Worker, encryption secret and managed Turnstile widget for redcrowninteractive.com were configured on 2026-09-19. The public frontend is deliberately not switched to this backend until live acceptance passes.

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
- Cancellation uses an unguessable management token. The host can manage bookings from their account. Calendar invitations come from Google/Microsoft; optional email reminders use the separate sender configuration below. SMS is not implemented.
- Microsoft integrations, OAuth consent, invitation delivery, Turnstile and encrypted refresh-token rotation require live credential testing before launch.
- No iCloud/CalDAV/ICS subscription connector, team scheduling, payments, conferencing provisioning or CRM integration is claimed.

## Review evidence

Automated suites cover scheduling/DST, buffers, overrides, ownership, public data minimization, conflicting bookings, pending-write retries, cancellation, rescheduling, version conflicts, encryption, Google busy errors, all-day time zones and Microsoft pagination origin restrictions. Existing browser connector tests remain in `../tools`.

Browser QA with the isolated provider fixture completed: meeting creation, saved availability, public booking, rescheduling and cancellation. Google/Microsoft live writes have not been exercised in this pass. The review is intentionally not labeled production-complete until the live acceptance gate passes.

References: [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Microsoft calendar view](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview), [Hebcal API](https://www.hebcal.com/home/195/jewish-calendar-rest-api).


## Release gate and rollback

Before enabling `apiOrigin` on the website: apply all migrations; configure provider secrets and callback URLs; verify consent, reload persistence, selected calendars, booking, invitation delivery, cancellation and rescheduling with dedicated test accounts; configure Turnstile for the website hostname; verify Worker CPU and subrequest limits with real calendars. Revert the frontend configuration if authorization or booking fails. Do not roll back database migrations or delete pending reservations to recover provider failures. The existing website remains independent of the API deployment.

## Optional meeting reminders

Meeting types save a lead time and private recipient email, initially filled from the signed-in account. Existing types default to no reminder. Settings apply to new bookings; rescheduling creates a new snapshot. Public meeting pages never expose reminder recipients.

Apply migration 0004 before deploying the Worker. Configure RESEND_API_KEY as a Worker secret and REMINDER_FROM as a verified sender address. The one-minute cron sends due reminders for confirmed, upcoming bookings only. The popup reports delivery as unavailable until both values are configured. Local Node development does not run the Worker cron.

Retries use a stable booking idempotency key and stop after 23 hours to stay within the provider deduplication window. Cancellations and replacements are rechecked before sending; a cancellation racing an already submitted email cannot recall it. Test delivery with a dedicated mailbox before enabling for users. See [Resend idempotency documentation](https://resend.com/changelog/idempotency-keys).

## Core availability acceptance - required on every scheduling release

A UI or fixture-only pass does not complete the review loop. Verify a real connected calendar, explicitly saved subcalendar choices, returned busy periods, visible free/busy day labels and day agenda, month navigation, reload and service-restart persistence. Verify that the scheduling engine excludes every real busy interval including configured buffers. Calendar errors must block booking availability rather than imply free time. Verify booking, cancellation and rescheduling against provider events separately before claiming the whole scheduling flow is ready.

Local live evidence, 2026-09-19: Google authorization completed; the primary calendar was selected and saved. September returned 17 authoritative busy intervals and 29 event details. The UI showed 20 busy days and 10 free days, and October loaded all 31 days. Reload retained selection and populated the preview. A read-only scheduling check using 30-minute meetings, 15-minute buffers and all-day test hours excluded 956 of 2,820 candidate starts, with zero buffered overlaps among returned slots. These are test-rule counts, not the user's published availability. No real invitation was sent by this check. Public deployment and full live booking acceptance remain pending.


## Host booking notifications from connected accounts

Apply migration 0008 before deploying. Confirmed bookings send a plain-text notification from the connected booking destination account to itself. No Resend configuration is needed for these notifications. Google/Microsoft calendar invitations to guests remain separate.

Enable Gmail API in the Google OAuth project and include gmail.send in its consent configuration and sensitive-scope verification. Microsoft connections request delegated Mail.Send. Existing hosts must reconnect and explicitly approve sending permission. Organization policy can require administrator approval. Mail permission never authorizes inbox reads. ICS-only connections cannot send mail.

The recipient is derived exclusively from the authenticated calendar connection, never guest input. A database claim prevents concurrent duplicate submissions. Accepted means provider acceptance, not verified inbox delivery. Rate limits and pre-submission token failures retry on the minute cron. Ambiguous submissions (network errors, server failures or interrupted sends) are marked uncertain and are not automatically resent, because these APIs offer no idempotency key. Rejected permissions require reconnection. Cancelled, pending and past bookings are excluded. Previously unnotified upcoming bookings become eligible after reconnecting.

Provider mailbox quotas still apply. No paid email service is enabled. Existing optional timed reminders remain a separate Resend-based feature. Validate actual receipt with each provider before claiming end-to-end delivery.
