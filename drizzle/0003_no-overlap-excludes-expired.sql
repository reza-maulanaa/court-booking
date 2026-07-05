-- Custom SQL migration file, put your code below! --

-- Booking 'expired' (pending yang tidak dibayar 30 menit) tidak boleh
-- memblokir slot — sama seperti 'cancelled'. Constraint dibuat ulang
-- karena WHERE clause EXCLUDE tidak bisa di-ALTER.
-- File terpisah dari 0002: Postgres melarang nilai enum baru dipakai
-- di transaksi yang sama dengan ALTER TYPE ... ADD VALUE-nya.

ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap;
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (
        field_id        WITH =,
        booking_date    WITH =,
        int4range(start_hour, start_hour + duration_hours)
        WITH &&
    ) WHERE (status NOT IN ('cancelled', 'expired'));
