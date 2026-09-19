-- Daily active verified users and sessions, UTC. Repeat page loads do not inflate counts.
SELECT day, COUNT(DISTINCT user_key) AS active_users, COUNT(DISTINCT session_key) AS sessions
FROM usage_sessions GROUP BY day ORDER BY day DESC;
-- Unique users/sessions by authentication method over retained history.
SELECT provider, COUNT(DISTINCT user_key) AS users, COUNT(DISTINCT session_key) AS sessions
FROM usage_sessions GROUP BY provider;
