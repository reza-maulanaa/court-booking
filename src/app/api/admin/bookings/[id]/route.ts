import { NextResponse } from "next/server";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/auth";

// state machine: target status → dari status apa aja dia SAH dicapai
const ALLOWED_FROM = {
  confirmed: ["pending"],
  completed: ["confirmed"],
  cancelled: ["pending", "confirmed"],
} as const;
const bodySchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled"]),
});
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/admin/bookings/[id]">,
) {
  const session = await getSession();
  if (session?.role !== "admin")
    return NextResponse.json({ error: "Khusus admin" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Status tujuan tidak valid" },
      { status: 400 },
    );
  const target = parsed.data.status;
  const [updated] = await db
    .update(bookings)
    .set({ status: target })
    .where(
      and(
        eq(bookings.id, id),
        inArray(bookings.status, [...ALLOWED_FROM[target]]),
      ),
    )
    .returning();

  if (updated) return NextResponse.json(updated);

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!b)
    return NextResponse.json(
      { error: "Booking tidak ditemukan" },
      { status: 404 },
    );
  return NextResponse.json(
    { error: `Tidak bisa ${b.status} → ${target}` },
    { status: 409 },
  );
}
