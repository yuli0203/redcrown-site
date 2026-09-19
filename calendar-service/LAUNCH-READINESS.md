# Public launch readiness

Checked 19 September 2026. Status: public beta, not a completed general-availability sign-off.

## Verified evidence

- Public HTTPS site: https://redcrowninteractive.com/calendar/ with Hebrew page, product-specific legal policy, support and studio attribution.
- Static hosting remains GitHub Pages; domain management was not moved. Release branch `codex/calendar-release` preserves the newer studio site. Never replace main with the divergent development branch.
- Cloudflare Worker and D1 are deployed. Julia's saved profile, two Google connections and booking records were migrated. Refresh tokens are encrypted server-side; browser storage is not the production source of truth.
- Production Google availability returned slots successfully. Provider redirect handling was fixed for Workers and covered by a regression test. Backend suite: 43 passing tests.
- Read-only production checks: unauthenticated workspace 401, untrusted origin 403, booking without challenge 403, static secret-file URL 404. No real booking or invitation was sent during this audit.
- Google branding is verified and published, and the actual requested scopes and justification are declared. This is distinct from calendar-scope approval.
- Microsoft homepage, terms and privacy URLs are saved. Publisher domain is verified as redcrowninteractive.com using the published association file. This is distinct from verified-publisher status.

## Required before broad launch

| Gate | Remaining work / acceptance evidence |
| --- | --- |
| Google permission review | Record the real OAuth and calendar workflow, including consent and scope usage, supply a demo-video URL, submit and obtain approval. Console currently blocks submission for missing video. |
| Microsoft connection | User creates client secret in the open Certificates & secrets panel and stores its Value in ignored .dev.vars as MICROSOFT_CLIENT_SECRET. Configure production secret/client ID and Firebase Microsoft provider, then test organizational and personal accounts. No secret in chat or source control. |
| Microsoft verified publisher | Link an eligible verified Partner Center account. Domain verification alone is insufficient. Some organizations also require administrator consent. |
| Booking delivery | Controlled production test of booking, attendee invitation, extra participants, conferencing, duplicate submission, cancellation and rescheduling; inspect actual received email and provider event. |
| Reminder delivery | Configure approved transactional sender and verify scheduled delivery, retries, deduplication and recipient controls. Production currently reports emailReminders:false. |
| Availability acceptance | Verify a known all-day busy event, timed busy event, recurrence, shared sub-calendar, holiday rules, timezone/DST, buffers and minimum notice against the actual provider. Confirm fully blocked dates cannot be booked and fresh conflicts are rejected on submission. |
| Persistence acceptance | Verify logout/login, another device and expired access-token refresh. Revocation and credential expiry must produce an actionable reconnect state. No provider grants permanent access. |
| Operations | Record responsible contact, monitoring/alerts, backup retention and restore drill, rollback procedure, resource quotas and billing settings. Free tiers are bounded; no unlimited-cost guarantee has been established. |
| Privacy and accessibility | Validate actual retention and support-led deletion/export processes, provider disclosures and legal business details. Complete accessibility testing. Published policies are not legal certification. |
| CI and mobile | Resolve existing studio iPhone SE WebKit reveal failure (two sections remain opacity 0). It predates this calendar release, but full verification is not green. |
| Payments | Existing PayPal.me support link is active. General card checkout is not implemented or tested. Do not collect card details directly. |

## Credential lifecycle

Record each provider credential's expiry outside source control and arrange advance rotation. Store production credentials only as Worker/Firebase secrets. Never rotate the token-encryption key without a migration plan for existing encrypted connections. Reconnect remains necessary after provider revocation even after app verification.

## Release evidence

- Static release commits: f058cc9 and ba6a0a2.
- Worker provider fix: 04306bf; deployed version e0608b89-759d-44a9-ab21-cf9385d96109.
- Google setup details and demo script: GOOGLE-VERIFICATION.md.
- This document records observed evidence, not a guarantee that every integration or production workflow has passed.
