-- Validate the original booking in the same transaction as its replacement.
CREATE TRIGGER validate_replaced_booking BEFORE INSERT ON bookings
WHEN NEW.replaces IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM bookings WHERE id=NEW.replaces AND uid=NEW.uid
   AND meeting_id=NEW.meeting_id AND status='confirmed'
 ) THEN RAISE(ABORT, 'BOOKING_CHANGED') END;
END;
