# Product completion review

Scope: public one-to-one scheduling, Firebase identity, Google and Microsoft calendar accounts, sub-calendar selection, persistent sync access, meeting types, availability rules and buffers, exceptions/holidays, branding, public booking, cancel/reschedule. Team routing, payments, CRM and AI features are outside this pass.

Current baseline: static preview, client-only tokens, local-only configuration, snapshot URLs, no confirmed bookings. This is not a production scheduling service.

Chosen foundation: preserve the static Red Crown UI and Firebase identity; add a Cloudflare Worker + D1 API. Refresh credentials are encrypted with an environment secret, never sent to browsers. Public APIs return bookable slots, never private event names. The scheduling engine is shared by preview and booking validation. SQL atomically reserves buffered intervals across all meeting types for a host. Google/Microsoft remain the source of truth for external busy time and are checked again at booking.

Review gates:
- Sign-in ownership and tenant isolation on every private endpoint.
- Server validation of schedules, time zones, all-day events and buffers.
- Fail closed when an availability source cannot be checked.
- Concurrent requests cannot reserve overlapping host intervals.
- Provider failures cannot produce a false confirmation.
- Reload preserves account connections and configuration.
- Actual public page, branding, time-zone-aware slots, confirmation and cancellation.
- Keyboard/mobile/error/loading/empty-state checks.
- Small restorable commits; no changes to unrelated studio pages.

Deployment dependencies: Cloudflare account/database binding, Google OAuth web client secret and callback registration, Microsoft app registration, token encryption secret. None may be placed in public JavaScript or committed. Free-tier quotas are finite. Production acceptance requires live provider round trips, domain routing and abuse protection.


## Follow-up review - 2026-09-19

Fixed a cancellation/rescheduling race: a replacement now validates the original booking atomically through migration 0003, and cancellation claims an eligible booking before calling the provider. Interrupted cancellations expose a retry action, and successful cancellation removes the obsolete rescheduling link. Invitations include the guest management link. Deleted or disabled meeting links display an explanation instead of an empty page.

Validation: 17 service tests, 11 calendar UI logic tests, and the Worker dry-run build passed. Sample-only browser booking and cancellation succeeded; the cancelled page has no remaining rescheduling action. The unavailable-meeting message was verified in the browser. No real provider invitations were sent. Migration 0003 is local and must be applied before deploying this change.

Resolved the daily-limit rescheduling issue in d9f79ac with a regression test. Live provider testing and credentials remain outstanding.


## Separate backend and booking-page review

Kept Porkbun DNS and GitHub Pages. Added restricted-origin CORS and first-party OAuth form navigation to a separate Worker. The frontend supports a configured API origin and fails closed during configured-service outages. Public errors no longer expose selected calendar names. Added refreshable calendar lists and destination-removal protection. Paused meeting types retain their state when edited. Public meeting cards link to individual booking pages with month navigation, selectable dates, times and explicit guest time zones.

Validation: 21 service tests and 11 calendar UI logic tests pass. Worker dry-run passes. Browser checks cover month navigation, normal booking and the confirmation state with the isolated sample fixture. No real invitations have been sent. Remaining release gates are listed in README.
