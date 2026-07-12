import { NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/auth";

// Pemilik booking: sesi cocok (userId) ATAU booking guest (userId null,
// tanpa akun) — tau ID-nya sendiri sudah cukup jadi bukti kepemilikan,
// pola sama seperti akses bukti transfer di ./[id]/proof/route.ts. Dipakai
// halaman status publik /bookings/[id] (guest checkout, tanpa login).
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/bookings/[id]">,
) {
  const session = await getSession();
  const { id } = await ctx.params;
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (
    !b ||
    (b.userId !== null && b.userId !== session?.sub && session?.role !== "admin")
  )
    return NextResponse.json(
      { error: "Booking tidak ditemukan" },
      { status: 404 },
    );
  return NextResponse.json(b);
}

export async function PATCH(
  _req: Request,
  ctx: RouteContext<"/api/bookings/[id]">,
) {
  const session = await getSession();
  const { id } = await ctx.params;

  const [cancelled] = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bookings.id, id),
        session
          ? or(eq(bookings.userId, session.sub), isNull(bookings.userId))
          : isNull(bookings.userId),
        eq(bookings.status, "pending"),
      ),
    )
    .returning();

  if (cancelled) return NextResponse.json(cancelled);

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!b || (b.userId !== null && b.userId !== session?.sub))
    return NextResponse.json(
      { error: "Booking tidak ditemukan" },
      { status: 404 },
    );
  return NextResponse.json(
    { error: `Booking berstatus ${b.status}, tidak bisa dibatalkan` },
    { status: 409 },
  );
}
