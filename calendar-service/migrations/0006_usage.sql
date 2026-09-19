CREATE TABLE usage_sessions (
 day TEXT NOT NULL,
 user_key TEXT NOT NULL,
 session_key TEXT NOT NULL,
 provider TEXT NOT NULL,
 PRIMARY KEY(day, user_key, session_key)
);
