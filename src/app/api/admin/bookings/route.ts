import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, expireStaleBookings } from "@/db";
import { bookings, fields, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin")
    return NextResponse.json({ error: "Khusus admin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const fieldId = searchParams.get("fieldId");

  const conditions = [];
  if (date) conditions.push(eq(bookings.bookingDate, date));
  if (fieldId) conditions.push(eq(bookings.fieldId, fieldId));

  await expireStaleBookings();

  const list = await db
    .select({
      id: bookings.id,
      bookingDate: bookings.bookingDate,
      startHour: bookings.startHour,
      durationHours: bookings.durationHours,
      hargaSnapshot: bookings.hargaSnapshot,
      proofUrl: bookings.proofUrl,
      status: bookings.status,
      createdAt: bookings.createdAt,
      userName: users.name,
      userEmail: users.email,
      fieldName: fields.name,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(fields, eq(bookings.fieldId, fields.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookings.bookingDate), desc(bookings.startHour));

  return NextResponse.json(list);
}
