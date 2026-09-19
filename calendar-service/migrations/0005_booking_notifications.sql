ALTER TABLE bookings ADD COLUMN notification_sent_at INTEGER;
ALTER TABLE bookings ADD COLUMN notification_attempt_at INTEGER;
CREATE INDEX bookings_notifications ON bookings(status, notification_sent_at, created_at);
