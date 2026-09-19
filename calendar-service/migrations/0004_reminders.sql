ALTER TABLE bookings ADD COLUMN reminder_sent_at INTEGER;
ALTER TABLE bookings ADD COLUMN reminder_attempt_at INTEGER;
CREATE INDEX bookings_reminders ON bookings(status, reminder_sent_at, start);
