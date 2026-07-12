ALTER TABLE "bookings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_phone" text;--> statement-breakpoint

-- Pemesan booking: akun terdaftar (user_id) ATAU tamu tanpa akun (guest_name) —
-- persis salah satu, gak boleh dua-duanya null (booking tanpa pemilik) atau
-- dua-duanya keisi (ambigu punya siapa). Dipakai Guest Checkout & Close Booking.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_xor" CHECK (
    (user_id IS NOT NULL AND guest_name IS NULL)
    OR
    (user_id IS NULL AND guest_name IS NOT NULL)
);