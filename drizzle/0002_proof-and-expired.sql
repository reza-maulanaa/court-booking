ALTER TYPE "public"."booking_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "proof_url" text;