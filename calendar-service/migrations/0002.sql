ALTER TABLE bookings ADD COLUMN replaces TEXT;
CREATE UNIQUE INDEX one_active_replacement ON bookings(replaces) WHERE replaces IS NOT NULL AND status IN ('pending','confirmed');
CREATE TRIGGER lock_replaced_booking AFTER INSERT ON bookings WHEN NEW.replaces IS NOT NULL BEGIN
 UPDATE bookings SET status='rescheduling' WHERE id=NEW.replaces AND status='confirmed';
END;
