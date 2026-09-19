CREATE TABLE IF NOT EXISTS profiles (
 uid TEXT PRIMARY KEY, slug TEXT UNIQUE, data TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS connections (
 id TEXT PRIMARY KEY, uid TEXT NOT NULL, provider TEXT NOT NULL, account_id TEXT NOT NULL, email TEXT NOT NULL,
 refresh_token TEXT NOT NULL, calendars TEXT NOT NULL, UNIQUE(uid,provider,account_id)
);
CREATE INDEX IF NOT EXISTS connections_owner ON connections(uid);
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, uid TEXT NOT NULL, provider TEXT NOT NULL, verifier TEXT NOT NULL, browser_hash TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, uid TEXT NOT NULL, meeting_id TEXT NOT NULL, request_id TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL,
 busy_start INTEGER NOT NULL, busy_end INTEGER NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, manage_hash TEXT NOT NULL,
 connection_id TEXT NOT NULL, calendar_id TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, UNIQUE(uid,request_id)
);
CREATE INDEX IF NOT EXISTS bookings_conflicts ON bookings(uid,status,busy_start,busy_end);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
