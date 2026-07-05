import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { put, del, get } from "@vercel/blob";
import { db, expireStaleBookings } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { proofFileError } from "@/lib/validator";

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/bookings/[id]/proof">,
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Silakan login dulu" }, { status: 401 });

  const { id } = await ctx.params;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const fileError = proofFileError(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  // Tandai pending basi dulu, supaya upload lewat deadline ditolak
  // deterministik di cek status bawah — bukan tergantung sweep lain.
  await expireStaleBookings();

  // Cek dulu sebelum upload, biar file tidak terbuang kalau bookingnya invalid.
  const b = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, id), eq(bookings.userId, session.sub)),
  });
  if (!b)
    return NextResponse.json(
      { error: "Booking tidak ditemukan" },
      { status: 404 },
    );
  if (b.status !== "pending")
    return NextResponse.json(
      {
        error:
          b.status === "expired"
            ? "Booking kadaluarsa (lewat batas 30 menit), silakan booking ulang"
            : `Booking berstatus ${b.status}, tidak perlu upload bukti`,
      },
      { status: 409 },
    );

  // Store PRIVATE: bukti transfer = data finansial. Blob tidak bisa
  // diakses langsung — hanya lewat GET di bawah (cek pemilik/admin).
  // addRandomSuffix tetap: re-upload = path baru, tanpa allowOverwrite.
  const blob = await put(`bukti-transfer/${id}`, file as File, {
    access: "private",
    addRandomSuffix: true,
  });

  const [updated] = await db
    .update(bookings)
    .set({ proofUrl: blob.url })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.userId, session.sub),
        eq(bookings.status, "pending"),
      ),
    )
    .returning();

  if (!updated) {
    // status keburu berubah di antara cek dan update (mis. admin reject)
    await del(blob.url).catch(() => {});
    return NextResponse.json(
      { error: "Status booking berubah, muat ulang halaman" },
      { status: 409 },
    );
  }
  return NextResponse.json(updated);
}

// Lihat bukti: pemilik booking atau admin. Store private, jadi gambar
// dialirkan lewat sini — otorisasi beneran, bukan URL rahasia.
// ponytail: streaming via function cukup utk file ≤4MB; kalau kelak
// butuh CDN, upgrade ke presignUrl.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/bookings/[id]/proof">,
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Silakan login dulu" }, { status: 401 });

  const { id } = await ctx.params;
  const b = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  });
  // bukan pemilik/admin dijawab 404 (bukan 403) biar tidak bocor — pola 3e
  if (!b?.proofUrl || (b.userId !== session.sub && session.role !== "admin"))
    return NextResponse.json(
      { error: "Bukti tidak ditemukan" },
      { status: 404 },
    );

  const blob = await get(b.proofUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200)
    return NextResponse.json(
      { error: "Bukti tidak ditemukan" },
      { status: 404 },
    );

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
