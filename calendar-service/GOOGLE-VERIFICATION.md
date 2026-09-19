# Google verification preparation

Checked 19 September 2026 after production deployment. Calendar permission verification is still pending. See LAUNCH-READINESS.md for release gates.

## Observed console state

- Project: crown-calendar-89e18. External audience, In production, unverified user cap still applies.
- Red Crown Calendar branding is verified and published. Homepage, privacy, terms and developer contact are saved.
- Public calendar and legal pages return HTTP 200.
- Actual identity and calendar scopes below are now declared; justification is saved.
- calendar.events remains unverified. gmail.send has been prepared in the current Data Access form but is not saved. Submission is blocked by the missing demonstration video; Confirm is disabled. No scope-review submission has been completed.
- Support email is the eligible project account; public support is hello@redcrowninteractive.com.

## Prepared branding values

These branding values are now saved (the eligible Google support selector still uses the project account):

| Field | Value |
| --- | --- |
| App name | Red Crown Calendar |
| Homepage | https://redcrowninteractive.com/calendar/ |
| Privacy policy | https://redcrowninteractive.com/calendar/legal/#privacy |
| Terms | https://redcrowninteractive.com/calendar/legal/#terms |
| Developer contact | hello@redcrowninteractive.com |
| Public support | hello@redcrowninteractive.com |

The support email selector only offers eligible Google account/group addresses. Keep the existing eligible contact until the public support address is eligible; a forwarding address alone is not an authenticated Google identity.

Existing authorized domains: `crown-calendar-89e18.firebaseapp.com`, `redcrowninteractive.com`, `yuli0203.workers.dev`. Authorization is not proof of domain ownership. Verify ownership through a project owner/editor's Search Console account; do not move DNS management. Review provider-owned domains against Google's requirements before submission.

## Actual calendar scope inventory and draft justifications

Source: `src/providers.js`, `providerConfig`, Google branch.

| Scope | Current purpose / justification |
| --- | --- |
| `openid` | Identify the account being connected. |
| `email` | Display the connected account email so the host can distinguish multiple accounts. |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List accessible calendars and write permissions so the host can choose conflict-checking calendars and a writable booking destination. No calendar-list write access is needed. |
| `https://www.googleapis.com/auth/calendar.events.freebusy` | Query busy intervals on selected accessible calendars to exclude conflicts. The documented FreeBusy endpoint does not accept `calendar.events` alone. |
| `https://www.googleapis.com/auth/calendar.events` | Read selected-calendar event details for the host preview and fallback conflict checking; create booking events and invitations in a selected writable calendar; remove booked events when cancelled or rescheduled. Read-only access cannot create/cancel bookings. Owned-only access would omit shared calendars the host can edit. |

The optional https://www.googleapis.com/auth/gmail.send scope is now used only when the host enables notifications for the saved booking destination account. It sends confirmation mail from that mailbox to itself and grants no inbox reading. Availability-only accounts do not request this scope. The live console draft includes it and the updated justification below, but Save is disabled until a demo URL is supplied. No new user grant was approved during this review.

Draft sensitive-scope justification (937 characters):

Red Crown Calendar lets hosts select calendars, exclude busy times and accept bookings. calendar.calendarlist.readonly lists calendars and write permissions. calendar.events.freebusy reads busy intervals. calendar.events reads selected event details for the host preview and FreeBusy fallback, and creates/cancels booking events with attendee invitations. Read-only access cannot save bookings; owned-only access excludes shared calendars the host can edit. gmail.send is requested separately, only for the saved booking destination account, to send each confirmed booking notification from that mailbox to itself. Calendar invitations do not reliably notify the organizer. No inbox reading, Gmail modification, contacts or Drive access is requested. Identity scopes support sign-in and identify connected accounts. Refresh tokens are encrypted; guests never receive private calendar event details. Users can disconnect or revoke access.

## Demonstration script to record before submission

Use test accounts and invented attendee data; do not record tokens, secrets, private event names or unrelated calendar contents.

1. Show the product homepage, name, support and product-specific privacy/terms links.
2. Sign in, choose Add calendar account, and show the complete Google consent flow in English with the exact requested scopes.
3. Select subcalendars, save the selection, and show combined availability and a busy interval excluded from booking.
4. Select a writable booking destination and create a meeting type.
5. Open the public booking page as a guest, choose an available slot, and book using test participant addresses.
6. Show the resulting provider event, invitation recipients, and host-only event preview.
7. Show Enable booking emails for the saved destination, the complete separate Gmail send consent, and actual receipt of the automatic host notification. Show that availability-only connections do not request mail access.
7. Demonstrate cancellation/rescheduling and disconnecting access, plus the support route for privacy/deletion requests.

No video or verification submission has been created yet. Google must be able to inspect working functionality when reviewing; a localhost-only app is not a completed submission package.

## Release gates

- Publish the reviewed informational/policy pages only with authorization. Publishing those pages is separate from enabling public bookings.
- Confirm declared scopes and actual Firebase/backend OAuth requests match; submit only necessary permissions.
- Finish identity/domain/branding checks, scoped justifications and demonstration evidence.
- Review policy accuracy against production processors, retention, deletion/export procedures, invitation recipients and abuse controls. Existing local copy is not legal certification.
- Obtain Google's applicable verification approval. Production status alone does not remove the unverified warning.
- Test reconnect, refresh, busy checks and booking operations using approved production credentials. Stored calendar selections survive reloads, but provider grants can still be revoked or expire.

The special seven-day refresh-token expiry applies to external projects in Testing with calendar scopes. This project is currently In production, so do not diagnose its current connections using that Testing-only rule. Existing tokens can still expire for other reasons; never promise permanent authorization.

## Official references

- https://support.google.com/cloud/answer/13464321
- https://developers.google.com/identity/protocols/oauth2#expiration
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
