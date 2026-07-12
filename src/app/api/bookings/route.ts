import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, expireStaleBookings } from "@/db";
import { bookings, fields } from "@/db/schema";
import { createBookingSchema, guestBookingSchema } from "@/lib/validator";
import { getSession } from "@/lib/auth";
import { pgErrorCode } from "@/lib/pg-error";
import { MAX_PENDING_UNPAID_BOOKINGS } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  const session = await getSession();

  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );

  // Tanpa login: nama & No. WhatsApp wajib — jadi identitas booking
  // sekaligus kunci anti-abuse pengganti userId (lihat pendingUnpaid).
  let guestName: string | null = null;
  let guestPhone: string | null = null;
  if (!session) {
    const guestParsed = guestBookingSchema.safeParse(body);
    if (!guestParsed.success)
      return NextResponse.json(
        { error: guestParsed.error.issues[0].message },
        { status: 400 },
      );
    guestName = guestParsed.data.guestName;
    guestPhone = normalizePhone(guestParsed.data.guestPhone);
  }

  const { fieldId, bookingDate, startHour, durationHours } = parsed.data;

  const field = await db.query.fields.findFirst({
    where: eq(fields.id, fieldId),
  });
  if (!field)
    return NextResponse.json(
      { error: "Lapangan tidak ditemukan" },
      { status: 404 },
    );

  // Pending basi masih "menduduki" EXCLUDE constraint — bereskan dulu,
  // supaya slot yang tidak jadi dibayar bisa dibooking user lain.
  await expireStaleBookings();

  // Anti-abuse: cegah satu user mengunci banyak slot sekaligus tanpa pernah
  // bayar (mis. booking semua jam kosong lalu dibiarkan). Booking yang
  // sudah ada buktinya tidak dihitung — itu sudah niat bayar, tinggal
  // nunggu admin. Dicek per-request (bukan constraint DB) karena ini aturan
  // "seberapa banyak", bukan "boleh/tidak" yang butuh atomicity ketat.
  const pendingUnpaid = await db.query.bookings.findMany({
    where: and(
      eq(bookings.userId, session.sub),
      eq(bookings.status, "pending"),
      isNull(bookings.proofUrl),
    ),
    columns: { id: true },
  });
  if (pendingUnpaid.length >= MAX_PENDING_UNPAID_BOOKINGS)
    return NextResponse.json(
      {
        error: `Kamu punya ${pendingUnpaid.length} booking belum dibayar. Selesaikan pembayarannya dulu (atau tunggu kadaluarsa) sebelum booking slot baru.`,
      },
      { status: 429 },
    );

  try {
    const [booking] = await db
      .insert(bookings)
      .values({
        userId: session.sub,
        fieldId,
        bookingDate,
        startHour,
        durationHours,
        hargaSnapshot: field.hargaPerJam,
      })
      .returning();
    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    if (pgErrorCode(e) === "23P01")
      return NextResponse.json(
        { error: "Jam tersebut sudah dibooking, pilih jam lain" },
        { status: 409 },
      );
    throw e;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Silahkan login dulu" }, { status: 401 });

  // Supaya status yang tampil jujur — pending basi langsung terlihat expired.
  await expireStaleBookings();

  const list = await db.query.bookings.findMany({
    where: eq(bookings.userId, session.sub),
    orderBy: [desc(bookings.bookingDate), desc(bookings.startHour)],
  });
  return NextResponse.json(list);
}
