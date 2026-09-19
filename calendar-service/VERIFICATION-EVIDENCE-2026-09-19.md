# Verification evidence - 19 September 2026

This is an implementation review, not an independent security certification or a Google approval.

## Observed live

- Personal Google calendar: September 28 all-day event is opaque (busy). Production public availability returns no slots that day.
- Business Google calendar: September 23 meeting 16:00-16:45 Asia/Jerusalem is opaque. Both published meeting types returned zero slots overlapping that interval (12 and 13 slots total respectively).
- Business September 23 all-day event named Block is transparent (free). A name does not override Google Busy/Free semantics. It should be changed to Busy by the host if intended to block the whole day.
- Anonymous production requests to workspace, connections and bookings return HTTP 401.
- Public host response exposes page/profile/meeting information, not tokens, private event titles or internal settings.
- Calendar, studio and Hebrew legal pages respond HTTP 200. This is availability evidence, not legal certification.
- Google Verification Center: branding verified; data access NOT verified. Submission requires a demo video URL. Gmail send declaration and justification prepared but Save disabled until video supplied.
- Two production Google connections, both mail_enabled=0. No connected Microsoft account. Actual host mail delivery and Outlook sync cannot be certified from this state.

## Automated/code evidence

- All 61 tests pass: busy/all-day/DST/buffers, reservation concurrency, idempotency, cancellation/rescheduling, owner authorization, encrypted credentials, scoped consent and all notification recipients with mocked provider APIs.
- npm audit --omit=dev --audit-level=high: zero reported dependency vulnerabilities. This is not a full vulnerability assessment.
- Refresh tokens encrypted with AES-GCM; OAuth state bound to initiating browser and one-time consumption; Firebase signed JWT and verified email required for private APIs.
- Public invitations have CAPTCHA and recipient/host rate limits.

## Still required

- Destination-account mail consent and controlled real delivery to host, booker and additional guests.
- Microsoft Firebase provider setup/admin access and live Outlook checks.
- Google demo video, saved full scope declaration and review submission/approval.
- Controlled live create, reschedule and cancel test with disposable accounts. Existing events were only read during this review.
- Do not claim complete two-way synchronization: externally deleting a provider event does not currently automatically cancel the application booking record; internal reservations can remain blocked. Cancellation through the app has automated coverage.
- Previously shared OAuth secrets should be rotated through provider consoles and deployed securely before claiming release security readiness.

## Host mail follow-up

After the host approved sending permission, only the booking destination connection has mail_enabled=1; the availability-only account remains 0. The automatic scheduled worker submitted both previously unnotified confirmed bookings. Both now have notification_state=accepted and notification_sent_at=1789816028673. Inbox receipt is checked separately; API acceptance alone is not delivery proof.
Inbox verification: both automatic New Event messages are visible with Inbox labels in julia@redcrowninteractive.com at 14:07 Israel time, including the Serjio booking. This establishes actual host receipt for these two bookings; it does not establish guest or Outlook receipt.

## Controlled booking delivery and cancellation

The disposable notification test on September 22 at 14:30-15:15 Asia/Jerusalem was created through the public booking flow. Google listed both authorized test attendees. The personal Gmail invitation was observed in Inbox; the user subsequently confirmed receipt at the additional Technion address. This is evidence for this test, not a guarantee of delivery to every mailbox.

Cancelled this test through its management page on September 19. The UI confirmed Meeting cancelled. The production public slots endpoint then returned the exact original start/end interval (1790076600000 / 1790079300000), proving that cancellation released this slot. The real September 23 meeting was not changed.

The Google Data Access draft was restored with gmail.send and a 937-character justification. Save remains disabled without the required YouTube demonstration URL. No review submission has been made.