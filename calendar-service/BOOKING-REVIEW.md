# Booking review - 19 September 2026

## Completed passes

- Setup: replaced misleading static-preview entry points with readiness checks and explicit publishing. Suggest a page address without overwriting a saved address.
- Guest flow: preserve details when changing time; provide availability and page-load retry actions; reject whitespace-only names; preserve request identity and freeze submitted details after an uncertain booking response.
- Management: show booking details and calendar export; provide rescheduling and explicit cancellation confirmation; keep a rescheduling guest's back link within booking management.
- Display: desktop host/calendar/time columns, compact narrow layout, intermediate-width fallback.
- Calendar export: escape text, fold UTF-8 content lines, use UTC timestamps and CRLF termination.

## Evidence

- 29 Node service/export tests passed, including scheduling boundaries, DST, conflicts, concurrent bookings, retries, cancellation, rescheduling, private-data exclusion and invitation payloads.
- Browser sample-provider flow: book, open management, keep meeting after opening cancellation, reschedule, then confirm cancellation.
- Browser guest details persisted after changing selected time.
- Browser confirmation includes email recipient and a calendar download link.
- Desktop layout and narrow layout inspected. Narrow browser reported 546px content and viewport width with no horizontal overflow. Requested viewport overrides did not reliably produce exact mobile dimensions; 390px and 820px remain unverified.
- No real invitations sent by this review. Sample provider does not send email.

## Still required for release

- Verify a published real host page, production OAuth and actual inbox invitation delivery.
- Configure and verify reminder delivery separately from provider invitations.
- Test failure/retry states in a browser under simulated network faults; backend retry tests are already passing.
- Test exact mobile dimensions, keyboard/screen-reader booking, deployed security controls and full accessibility.
- Confirm public hosting and legal release requirements. This review is not a claim of Calendly parity or production readiness.
