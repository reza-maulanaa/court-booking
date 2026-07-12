import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, expireStaleBookings } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { proofFileError } from "@/lib/validator";
import { supabaseAdmin, PROOF_BUCKET } from "@/lib/supabase";
import { PROOF_DEADLINE_MIN } from "@/lib/constants";

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
            ? `Booking kadaluarsa (lewat batas ${PROOF_DEADLINE_MIN} menit), silakan booking ulang`
            : `Booking berstatus ${b.status}, tidak perlu upload bukti`,
      },
      { status: 409 },
    );

  // Store PRIVATE (bucket dibuat private di dashboard Supabase): bukti
  // transfer = data finansial, tidak bisa diakses langsung — hanya lewat
  // GET di bawah (cek pemilik/admin, service role key). Path diberi
  // UUID acak sendiri (bukan addRandomSuffix Vercel Blob) — re-upload
  // jadi objek baru, tanpa perlu upsert.
  const path = `${id}/${crypto.randomUUID()}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PROOF_BUCKET)
    .upload(path, file as File, {
      contentType: (file as File).type,
      upsert: false,
    });
  if (uploadError) {
    // Pesan ke user sengaja generik (jangan bocorkan detail storage) —
    // detail asli dicatat di log server (mis. Vercel → Functions → Logs)
    // buat didiagnosis. Penyebab tersering: bucket PROOF_BUCKET belum
    // dibuat manual di dashboard Supabase (ARCHITECTURE §9) atau
    // SUPABASE_SERVICE_ROLE_KEY di env production salah/kadaluarsa.
    console.error("[proof upload] Supabase Storage error:", uploadError);
    return NextResponse.json(
      { error: "Gagal mengunggah bukti, coba lagi" },
      { status: 500 },
    );
  }

  // proofUrl menyimpan PATH objek Supabase (bukan URL publik — bucket
  // private tidak punya itu), dialirkan lewat GET di bawah.
  const [updated] = await db
    .update(bookings)
    .set({ proofUrl: path })
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
    await supabaseAdmin.storage.from(PROOF_BUCKET).remove([path]);
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
// butuh CDN, upgrade ke signed URL (createSignedUrl).
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

  const { data, error } = await supabaseAdmin.storage
    .from(PROOF_BUCKET)
    .download(b.proofUrl);
  if (error || !data) {
    if (error) console.error("[proof download] Supabase Storage error:", error);
    return NextResponse.json(
      { error: "Bukti tidak ditemukan" },
      { status: 404 },
    );
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
