ALTER TABLE connections ADD COLUMN mail_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN notification_state TEXT;
ALTER TABLE bookings ADD COLUMN notification_retry_at INTEGER;
