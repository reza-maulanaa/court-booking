import {
  pgEnum,
  integer,
  pgTable,
  text,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("user"),
});

export const fields = pgTable("fields", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  hargaPerJam: integer("harga_per_jam").notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  fieldId: text("field_id")
    .notNull()
    .references(() => fields.id),
  bookingDate: date("booking_date").notNull(),
  startHour: integer("start_hour").notNull(),
  durationHours: integer("duration_hours").notNull(),
  hargaSnapshot: integer("harga_snapshot").notNull(),
  proofUrl: text("proof_url"),
  status: bookingStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
