import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(
  _req: Request,
  ctx: RouteContext<"/api/bookings/[id]">,
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Silakan login dulu" }, { status: 401 });

  const { id } = await ctx.params;

  const [cancelled] = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.userId, session.sub),
        eq(bookings.status, "pending"),
      ),
    )
    .returning();

  if (cancelled) return NextResponse.json(cancelled);

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!b || b.userId !== session.sub)
    return NextResponse.json(
      { error: "Booking tidak ditemukan" },
      { status: 404 },
    );
  return NextResponse.json(
    { error: `Booking berstatus ${b.status}, tidak bisa dibatalkan` },
    { status: 409 },
  );
}
