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

Remaining review item: rescheduling a booking on a day already at its daily booking limit currently counts the original booking against that limit. Live provider testing, credentials, and hosting configuration remain outstanding.
