# Signed-in usage analytics

First-party operational metrics start with this release. No advertising SDK or additional browser tracking storage is installed.

An authenticated, email-verified GET /workspace records one row per UTC day, user and Firebase sign-in session. Page refreshes and token refreshes do not create additional sessions. A sign-in that never opens the workspace is not counted. These are active workspace users and sessions, not registration counts or every authentication attempt.

Rows contain only UTC day, allowlisted authentication provider, and domain-separated HMAC user/session identifiers. No raw Firebase UID, email, name, IP address, page URL, calendar data or booking data is stored in this table. Identifiers remain pseudonymous personal data, not anonymous data. The scheduled Worker deletes rows older than 90 days. Metrics failures cannot block workspace access.

## View reports

In Cloudflare, open Workers & Pages > D1 > red-crown-calendar > Console and run the queries from analytics-report.sql. Or run from calendar-service:

```powershell
npx wrangler d1 execute red-crown-calendar --remote --file analytics-report.sql
```

The first result is daily active verified users and sessions; the second groups unique users and sessions by password, Google, Microsoft or other sign-in method. Cross-day unique sessions are counted once in the second report. Account-level access to Cloudflare is required; there is no public analytics endpoint or in-app analytics dashboard.

For support-led deletion, derive the same user_key using recordWorkspaceUsage's HMAC recipe and delete that key from usage_sessions alongside account deletion. Do not log the source UID or derived key. Rotating TOKEN_ENCRYPTION_KEY affects metric continuity as well as existing encrypted calendar credentials and requires migration planning.
