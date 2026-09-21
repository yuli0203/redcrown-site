# Gmail scope removal - production verification, 2026-09-21

- Frontend removal is live from main commit afc0f97. Live api.js has no mailConnectionId; settings.js has no Enable booking emails control; the published calendar privacy policy no longer claims mailbox sending permission.
- Worker source commits e7ed31f and 1ccf20e were fast-forwarded locally and deployed as version 741700e1-8e1d-462e-972b-d48703374cd1.
- All 65 server tests passed. Wrangler deployment dry run passed. Production health reports ready=true and google=true.
- Project 846983787 (crown-calendar-89e18): removed gmail.send in Google Auth Platform Data Access, updated the justification, and saved. The console confirmed Data access changes saved and that saving updated the existing verification request. Verification Center reports data access under review; branding is verified. Existing demonstration URL is https://youtu.be/FYQCuO2tvwE.
- Calendar invitations retain sendUpdates=all. No Resend key or sender is configured. Production correctly reports bookingNotifications=false and emailReminders=false. Separate application emails are unavailable; native Calendar invitation delivery is tested below.
- Authorized live test: booking 1b7389bc-fc7e-44ae-8e44-56ebb654ecb3, title Calendar confirmation test 2026-09-21, scheduled for 2026-09-22 14:45 Asia/Jerusalem. The application confirmed it and stored provider event 1b7389bcfc7e44ae8e4456ebb654ecb3. notification_sent_at remained null, confirming the app email path did not send.
- Gmail confirmed the native Calendar invitation arrived in INBOX at 2026-09-21T04:28:17Z, message 1a0c238d0846d7f3, from julia@redcrowninteractive.com to yuli0203@gmail.com, with invite.ics. This proves guest invitation delivery to Gmail; it does not prove a separate organizer confirmation email.
- A reply to Google's review email has not been sent.

Historical preparation notes in GOOGLE-VERIFICATION.md predate the saved console update and this live test. This record supersedes their assertions that the demo is missing, submission is blocked, or Resend is configured.

Test cleanup: cancellation succeeded through the public management page; production database status verified as cancelled. The temporary slot is released.
