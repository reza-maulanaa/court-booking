import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, fields } from "@/db/schema";
import { OPEN_HOUR, CLOSE_HOUR } from "@/lib/constants";

const dateSchema = z.iso.date();

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/fields/[id]/availability">,
) {
  const { id } = await ctx.params;

  const parsed = dateSchema.safeParse(req.nextUrl.searchParams.get("date"));
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Query ?date= wajib, format YYYY-MM-DD",
      },
      { status: 400 },
    );
  const date = parsed.data;

  const field = await db.query.fields.findFirst({ where: eq(fields.id, id) });
  if (!field)
    return NextResponse.json(
      { error: "Lapangan tidak ditemukan" },
      { status: 404 },
    );

  const booked = await db.query.bookings.findMany({
    columns: { startHour: true, durationHours: true },
    where: and(
      eq(bookings.fieldId, id),
      eq(bookings.bookingDate, date),
      ne(bookings.status, "cancelled"),
    ),
  });

  const taken = new Set<number>();
  for (const b of booked)
    for (let h = b.startHour; h < b.startHour + b.durationHours; h++)
      taken.add(h);

  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++)
    slots.push({ hour: h, available: !taken.has(h) });

  return NextResponse.json({ fieldId: id, date, slots });
}
