-- Custom SQL migration file, put your code below! --

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (
        field_id        WITH =,
        booking_date    WITH =,
        int4range(start_hour, start_hour + duration_hours)
        WITH &&
    ) WHERE (status <> 'cancelled');

--> statement-brakepoint

ALTER TABLE bookings ADD CONSTRAINT bookings_valid_hours
CHECK (
    duration_hours >= 1
    AND start_hour >= 8
    AND start_hour + duration_hours <= 23
);