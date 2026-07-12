# ARCHITECTURE — Sistem Booking Lapangan Futsal

Setiap keputusan ditulis dengan alasannya. Perubahan keputusan = diskusi dulu.

## 1. Prinsip

1. **Garansi terakhir di database.** Validasi aplikasi (Zod, cek availability)
   hanya untuk UX — dua request paralel bisa sama-sama lolos validasi aplikasi.
   Yang atomik hanya constraint DB.
2. **Derive, jangan simpan.** Data yang bisa dihitung dari data lain
   (availability, total harga, durasi selesai) tidak disimpan — tidak ada
   yang perlu di-sync, tidak ada yang bisa basi.

## 2. Autentikasi

- Custom JWT (library `jose`), disimpan di cookie `httpOnly` + `secure` +
  `sameSite=lax`. Payload: `{ sub: userId, role }`, exp 7 hari.
- Verifikasi di Next.js middleware (edge) — `jose` dipilih karena jalan di
  edge runtime, `jsonwebtoken` tidak.
- Password di-hash dengan bcrypt. Kolomnya bernama `password_hash` supaya
  isinya tidak pernah ambigu.
- **Alasan custom JWT** (bukan NextAuth): tujuan project ini portfolio +
  belajar fundamental; scope auth-nya kecil (register/login/logout, 2 role).
- Otorisasi: route `/admin/*` dan API admin cek `role === "admin"` di
  middleware. Role disimpan di tabel `users` (bukan tabel/kredensial
  terpisah) karena hanya ada 2 role dan tidak ada permission granular.

## 3. Slot & availability (keputusan final #2)

**Tidak ada tabel slot.** Slot deterministik dari
`(field_id, booking_date, start_hour)` dengan jam operasional 08–23
sebagai konstanta aplikasi.

Availability = jam operasional − booking aktif:

```sql
SELECT start_hour, duration_hours
FROM bookings
WHERE field_id = $1 AND booking_date = $2 AND status <> 'cancelled';
```

Aplikasi meng-expand tiap baris jadi jam terisi
(`start_hour` s/d `start_hour + duration_hours - 1`), sisanya kosong.

**Alasan**: tabel slot pre-generated harus di-generate (cron/script), bisa
bolong, bisa duplikat, dan menambah state yang harus disinkronkan. Slot yang
deterministik cukup dihitung saat dibutuhkan — satu query ringan per
(lapangan, tanggal).

## 4. Anti double-booking (keputusan final #3 + hasil diskusi multi-jam)

**Keputusan: satu booking = satu baris; overlap ditolak oleh EXCLUSION
constraint Postgres** (opsi "b+" dari diskusi).

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    field_id      WITH =,
    booking_date  WITH =,
    int4range(start_hour, start_hour + duration_hours) WITH &&
  ) WHERE (status <> 'cancelled');
```

Cara kerja: EXCLUDE adalah generalisasi UNIQUE — dua baris ditolak jika
SEMUA operatornya cocok: `field_id` sama, `booking_date` sama, dan range
jamnya beririsan (`&&`). `int4range` half-open `[start, start+durasi)`,
sehingga booking 10–12 dan 12–14 **tidak** dianggap overlap — pas untuk
slot berurutan.

Detail penting:
- `WHERE (status <> 'cancelled')`: partial constraint. Booking yang dibatalkan
  tidak boleh memblokir slot — tanpa klausa ini, slot yang pernah di-cancel
  mati selamanya.
- `btree_gist` diperlukan agar kolom skalar (`field_id`, `booking_date`)
  bisa ikut di index gist.
- Drizzle belum mendukung EXCLUDE di schema definition → constraint ini
  hidup di **file migration SQL manual** (drizzle-kit `--custom`).

**Penanganan error**: pelanggaran EXCLUDE = SQLSTATE **`23P01`**
(exclusion_violation), bukan `23505`. Satu helper menerjemahkan:
`23P01` pada `bookings_no_overlap` → HTTP 409
`"Jam tersebut sudah dibooking, silakan pilih jam lain."`
Cek availability di form tetap ada — tapi hanya UX; race sesungguhnya
diselesaikan constraint ini.

**Alternatif yang ditolak**:
- *(a) Multi-baris per jam + UNIQUE*: garansi sama kuat dan Drizzle-native,
  tapi 1 booking = N baris → status redundan, update menyentuh N baris,
  query booking user butuh GROUP BY.
- *(b) Satu baris + `SELECT ... FOR UPDATE`*: garansi pindah ke aplikasi —
  melanggar prinsip §1, dan salah satu langkah (lupa lock di satu code path)
  langsung membuka race.

## 5. State machine status booking (keputusan final #4)

Enum: `pending`, `confirmed`, `completed`, `cancelled`, `expired`
(`expired` ditambah di F6, revisi 2026-07-05).

| Dari | Ke | Trigger | Siapa |
|---|---|---|---|
| pending | confirmed | approve (bukti transfer cocok dgn mutasi) | admin |
| pending | cancelled | reject | admin |
| pending | cancelled | batalkan sendiri | user pemilik |
| pending | expired | 5 menit tanpa bukti transfer (lazy, §9) | sistem |
| confirmed | completed | sesi selesai dimainkan | admin |
| confirmed | cancelled | pembatalan setelah konfirmasi | admin |

- `completed`, `cancelled`, `expired` = terminal, tidak ada transisi keluar.
  Booking yang hangus tidak dihidupkan lagi — user booking ulang.
  `expired` sengaja dibedakan dari `cancelled`: beda kejadian beda nama
  (admin bisa lihat pola "sering booking tapi tak pernah bayar").
- Transisi lain (mis. `pending → completed`, `cancelled → confirmed`) invalid.
- Implementasi (terealisasi F4, 2026-07-04 — revisi dari rencana
  `canTransition(from, to, actor)`): tabel dibalik jadi peta
  `ALLOWED_FROM: { target → [asal yang sah] }` di
  `api/admin/bookings/[id]/route.ts` karena input request berupa status
  TUJUAN; aktor dipisah per route (user pemilik: `pending → cancelled` di
  `api/bookings/[id]`, admin: sisanya). Update selalu atomik:
  `UPDATE ... WHERE id = $1 AND status IN (asal sah)` — kalau 0 baris
  berubah, transisi tidak sah ATAU status keburu berubah di tengah jalan
  (race user-cancel vs admin-confirm) → 409 menyebut transisinya.
  `pending` tidak pernah jadi kunci `ALLOWED_FROM` = tidak ada jalan
  kembali ke antrean; `completed`/`cancelled` tidak pernah jadi nilai
  asal untuk keluar = terminal terjaga struktural.
- **Alasan pakai enum + tabel transisi, bukan boolean/if bertebaran**:
  4 status tidak muat di boolean, dan transisi yang valid harus satu sumber
  kebenaran — bukan tersebar di tiap handler.

## 6. Harga

- Semua uang **integer rupiah** — float membuat error pembulatan.
- `harga_snapshot` = harga per jam **saat booking dibuat** (copy dari
  `fields.harga_per_jam`). Total tampilan = `harga_snapshot × duration_hours`.
- **Alasan snapshot**: kalau join ke `fields.harga_per_jam`, admin menaikkan
  harga → tagihan booking lama ikut berubah. Harga adalah fakta historis.
- **Alasan per-jam (bukan total)**: unit yang di-snapshot sama dengan unit
  sumbernya; total selalu bisa dihitung, kebalikannya tidak.

## 7. Skema

Drizzle (`src/db/schema.ts` nanti — Fase 0 belum menulis kode):

```ts
import { pgTable, pgEnum, text, integer, date, timestamp } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const bookingStatus = pgEnum("booking_status", [
  "pending", "confirmed", "completed", "cancelled",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("user"),
});

export const fields = pgTable("fields", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  hargaPerJam: integer("harga_per_jam").notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  fieldId: text("field_id").notNull().references(() => fields.id),
  bookingDate: date("booking_date").notNull(),
  startHour: integer("start_hour").notNull(),
  durationHours: integer("duration_hours").notNull(),
  hargaSnapshot: integer("harga_snapshot").notNull(),
  status: bookingStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Migration SQL manual (di luar jangkauan Drizzle):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    field_id      WITH =,
    booking_date  WITH =,
    int4range(start_hour, start_hour + duration_hours) WITH &&
  ) WHERE (status <> 'cancelled');

ALTER TABLE bookings ADD CONSTRAINT bookings_valid_hours CHECK (
  duration_hours >= 1
  AND start_hour >= 8
  AND start_hour + duration_hours <= 23
);
```

Catatan: jam operasional muncul dua kali (konstanta aplikasi + CHECK).
Duplikasi disengaja — CHECK adalah garansi, konstanta adalah UX. Kalau jam
operasional berubah, dua tempat itu satu-satunya yang disentuh.

## 8. Lapisan validasi

| Lapisan | Alat | Peran |
|---|---|---|
| Form/client | state form + availability API | UX instan |
| API boundary | Zod | tolak input malformed sebelum sentuh DB |
| Database | FK, CHECK, UNIQUE, EXCLUDE | garansi kebenaran final |

Dua lapisan pertama boleh gagal mendeteksi (race, bug) — lapisan ketiga tidak.

## 9. Pembayaran manual & bukti transfer (revisi final 2026-07-05)

Menggantikan rencana email (Resend → Brevo → dihapus). **Alasan**: email
konfirmasi tidak menyelesaikan masalah inti (booking tak berbayar menahan
slot); bukti transfer menyelesaikannya sekaligus menghapus dependensi
email service beserta dilema kepemilikan akunnya. Status dilihat user di
halaman "booking saya" — email jadi murni nice-to-have, di luar MVP.

### Alur

1. Booking dibuat → `pending`, slot langsung ke-hold (melindungi user
   jujur yang sedang buka m-banking; penyerang iseng dibatasi 5 menit).
2. User bayar manual — QRIS (gambar statis `public/qris.svg`) atau
   transfer bank — lalu upload bukti (gambar) → `proof_url` terisi,
   tetap `pending`, tidak bisa hangus lagi. Metode bayar TIDAK disimpan:
   buktinya satu jenis, admin memverifikasi ke mutasi/dashboard QRIS
   apa pun metodenya — kolom `payment_method` = state tanpa keputusan.
3. Admin cocokkan bukti dengan mutasi rekening → confirm / reject (§5).
4. Tanpa upload dalam 5 menit → `expired`, slot terlepas.

### Kadaluarsa lazy — tanpa cron (keputusan final #5)

`expired` dievaluasi **saat data disentuh**, bukan oleh scheduler:
satu UPDATE (`pending` + `proof_url IS NULL` + `created_at` lewat
deadline → `expired`) di `expireStaleBookings()` (`src/db/index.ts`),
dipanggil di jalur availability, buat booking, list booking, list admin.

- **Kenapa bukan cron**: infra baru di serverless, presisi menit-an,
  dan race cron-vs-user. Query yang dievaluasi saat dibutuhkan selalu
  tepat waktu — pola sama dengan availability §3 ("derive, jangan simpan").
- **Kenapa UPDATE fisik (bukan filter murni di query)**: EXCLUDE
  constraint §4 menilai baris berdasarkan status tersimpan — pending basi
  harus benar-benar diubah agar tidak memblokir insert user lain. Karena
  itu sweep wajib di jalur tulis; di jalur baca ikut dipanggil supaya
  status yang tampil jujur.
- Perbandingan waktu sepenuhnya di SQL (`now() - interval`) — tidak ada
  jam aplikasi vs jam DB.
- Konsekuensi migrasi: `WHERE` EXCLUDE jadi
  `status NOT IN ('cancelled','expired')`; nilai enum baru tidak boleh
  dipakai di transaksi yang sama dengan pembuatannya → dua file migration
  (0002 enum+kolom, 0003 constraint).

### Anti-abuse: deadline dipersingkat + batas booking belum bayar (revisi 2026-07-12)

Skenario yang mau dicegah: satu akun booking banyak/semua slot kosong
tanpa pernah bermaksud bayar, cuma buat mengganggu user lain (semua slot
kelihatan penuh). Lazy expiration (di atas) sudah membatasi durasi
gangguan per booking, tapi 30 menit cukup lama untuk mengunci banyak slot
sekaligus lalu diulang terus. Dua perubahan:

- **`PROOF_DEADLINE_MIN` 30 → 5 menit** (`lib/constants.ts`, satu-satunya
  sumber nilai — dipakai `expireStaleBookings()`, pesan UI, dan FAQ,
  jangan pernah hardcode ulang teks "X menit"). Trade-off sadar: user
  jujur yang transfer manual (bukan QRIS instan) mepet waktunya — dianggap
  sepadan mengingat mayoritas pembayaran di app ini QRIS/scan cepat.
- **`MAX_PENDING_UNPAID_BOOKINGS = 3`**: `POST /api/bookings` menolak
  (429) kalau user yang sama sudah punya ≥3 booking `pending` DENGAN
  `proof_url IS NULL`. Booking yang sudah ada buktinya tidak dihitung —
  itu sudah niat bayar, tinggal nunggu admin, bukan slot yang "digantung".
  Dicek per-request (query count, bukan constraint DB) karena ini aturan
  kuantitas, bukan aturan "boleh/tidak" yang butuh atomicity ketat seperti
  EXCLUDE constraint §4 — sedikit race (dua request nyaris bersamaan lolos
  kedua-duanya) diterima, dampaknya cuma +1 slot terkunci sesaat.
- **Belum ditangani** (di luar scope perbaikan ini, catat kalau jadi
  masalah nyata): satu orang bikin banyak akun buat kelilingi limit ini
  (butuh rate-limit registrasi per IP/device) dan rate-limit di endpoint
  `POST /api/bookings` itu sendiri (saat ini cuma dibatasi limit total,
  bukan kecepatan submit).

### Penyimpanan bukti (Supabase Storage — revisi 2026-07-12, menggantikan Vercel Blob)

File tidak bisa ke filesystem (serverless, hilang) atau ke Neon (DB
gendut). Awalnya **Vercel Blob** (nol akun baru, token nempel di project
Vercel yang sama); dipindah ke **Supabase Storage** atas keputusan user —
Supabase dipakai **hanya untuk storage, tidak lebih** (bukan Supabase
Auth — sesi login tetap JWT sendiri, `lib/auth.ts`). DB hanya menyimpan
path objek, bukan URL (bucket private tidak punya URL publik).

- Client di `lib/supabase.ts` pakai **service role key** (bypass RLS),
  dipanggil cuma di route handler. Alasan bukan anon key + RLS: RLS
  Supabase Storage lazimnya keyed ke `auth.uid()` dari Supabase Auth —
  app ini tidak pakai itu, jadi RLS berbasis auth Supabase tidak
  relevan; otorisasi tetap 100% di kode route (cek pemilik/admin dari
  session JWT) sebelum panggil Supabase, sama seperti pola Blob lama.
- Bucket **`bukti-transfer`**, dibuat manual di dashboard Supabase,
  **private** (bukan public) — dibuat manual sekali, tidak lewat migrasi
  Drizzle (di luar jangkauannya, sama seperti EXCLUDE constraint §4).
- Batas **4MB** + wajib `image/*`, divalidasi **di server**
  (`proofFileError`, `lib/validator.ts`) — asalnya dari batas body
  request Vercel serverless function (~4.5MB), yang tetap berlaku
  walau storage-nya bukan Vercel lagi (file tetap lewat function
  sebelum diteruskan ke Supabase); UI menyarankan screenshot.
- Path objek `${bookingId}/${randomUUID()}` — pengganti
  `addRandomSuffix` Vercel Blob: re-upload otomatis jadi objek baru,
  tanpa perlu `upsert`.
- Akses lewat `GET /api/bookings/[id]/proof` yang mengecek pemilik/admin
  lalu meng-alirkan gambar (`storage.download()`) — otorisasi beneran,
  bukan URL rahasia. Streaming via function cukup untuk ≤4MB; upgrade
  path kalau butuh CDN: `createSignedUrl`.
- Re-upload saat masih `pending` diizinkan (salah kirim gambar tidak
  mematikan booking); objek lama dibiarkan yatim — volumenya kecil.
- Urutan di route proof: validasi → sweep expired → cek kepemilikan+status
  → upload objek → UPDATE berkondisi status. Kalau UPDATE 0 baris (status
  keburu berubah), objek dihapus lagi — tidak ada bukti nyangkut di
  booking yang sudah ditolak.

Env: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Project
Settings > API di dashboard Supabase — service role key SECRET, jangan
dipakai di client). Rekening tujuan: konstanta `TRANSFER_INFO`
(`lib/constants.ts`) — pindah ke DB kalau kelak admin perlu ganti via UI.

## 10. Testing (Vitest)

Prioritas test = tempat logika bisa salah:
1. `canTransition` — seluruh matriks transisi.
2. Kalkulasi availability (expand booking → jam terisi).
3. Integration: dua insert overlap paralel ke DB test → tepat satu sukses,
   satu tertangkap sebagai `23P01`.
4. Zod schemas (batas jam, durasi, tanggal, `guestBookingSchema`).
5. `proofFileError` (tipe file, batas ukuran, file kosong).
6. Guest checkout: booking tanpa sesi berhasil & bisa diakses balik lewat
   ID; booking ber-`userId` tetap 404 buat non-pemilik tanpa sesi.
7. Close Booking: admin insert langsung `confirmed`; slot bentrok → 409;
   bukan admin → 403.

Tidak menguji framework (routing Next, Drizzle sendiri).

## 11. Booking tanpa akun (guest checkout — revisi 2026-07-12)

**Alasan**: banyak calon pemesan anak-anak/gaptek, tidak paham cara
registrasi (email/password). Wajib akun jadi penghalang booking, langsung
berdampak ke bisnis. Login tetap ada dan tetap didukung penuh — ini
tambahan jalur, bukan pengganti.

- **`src/proxy.ts`** (Next.js 16 — pengganti `middleware.ts` lama) blanket-block
  semua request tanpa sesi ke matcher `/bookings/:path*` & `/api/bookings/:path*`
  **sebelum** route/page manapun kesentuh. Ini gerbang pertama yang harus
  tau soal guest checkout — kalau lupa diupdate, semua perbaikan di
  route.ts sia-sia (request-nya gak pernah sampai ke situ sama sekali).
  Daftar `GUEST_ACCESSIBLE` di file itu eksplisit nyebut path mana yang
  boleh dilewati tanpa sesi: `POST /api/bookings`, `/api/bookings/[id]`
  (+ `/proof`), dan halaman `/bookings/[id]`. `/bookings` (list) &
  `/api/admin/*` tetap blanket-gated.
- Schema: `bookings.userId` sekarang **nullable**; tambah `guest_name`,
  `guest_phone` (nullable). **CHECK constraint** `bookings_owner_xor`
  (migration `0004`) menjamin persis salah satu dari `user_id`/`guest_name`
  yang terisi — garansi di lapisan DB, bukan cuma app (§8).
- `POST /api/bookings`: sesi opsional. Tanpa sesi → `guestName`+
  `guestPhone` wajib (Zod `guestBookingSchema`, `lib/validator.ts`),
  nomor dinormalisasi (`lib/phone.ts`) sebelum disimpan.
- **Anti-abuse tanpa akun**: `MAX_PENDING_UNPAID_BOOKINGS` yang tadinya
  dihitung per `userId`, untuk guest dihitung per `guestPhone`
  (dinormalisasi). Nomor bisa dipalsukan — known ceiling, upgrade path:
  rate-limit per-IP kalau abuse guest beneran kejadian.
- **Kepemilikan tanpa sesi**: booking dengan `userId IS NULL` bisa
  diakses (lihat status, upload bukti, batalkan) hanya dengan tahu ID-nya
  — ID booking adalah UUID acak, jadi "tau ID" setara "punya link
  rahasia", pola yang sama seperti akses bukti transfer (§9). Diterapkan
  di `GET/PATCH /api/bookings/[id]` dan `POST/GET /api/bookings/[id]/proof`.
  Booking yang punya `userId` tetap 404 buat siapa pun tanpa sesi yang
  cocok (atau admin) — guest tidak bisa mengintip booking user lain.
- Halaman status publik `/bookings/[id]` (`components/booking-status.tsx`)
  — satu-satunya kanal guest melihat hasil approve/reject, karena tidak
  ada email/SMS. Reuse `components/booking-card.tsx` (dipecah dari
  `bookings/page.tsx` yang login-only) supaya UI upload/cancel/status
  identik di kedua halaman.
- Dua jalur booking (wizard `booking-section.tsx` di landing page, form
  `booking-form.tsx` di `/fields/[id]`) dua-duanya mendukung guest —
  keduanya sudah mengumpulkan nama+No. WhatsApp, tinggal dikirim ke API
  (sebelumnya dikumpulkan di form tapi tidak pernah dipakai/disimpan).

### Close Booking — walk-in bayar cash (revisi 2026-07-12)

Reuse infrastruktur guest checkout di atas (`userId` nullable +
`guest_name`/`guest_phone`) buat kasus kebalikannya: pelanggan datang
langsung, bayar cash di tempat, tanpa pernah booking online. **Alasan**:
menghapus opsi "Bayar di Tempat" dari alur online (anti-abuse) berarti
butuh jalan lain buat walk-in — kalau tidak, bisnis kehilangan segmen
pelanggan itu.

- `POST /api/admin/bookings` (admin-only): insert booking **langsung
  `confirmed`** — skip `pending`/upload bukti, karena uangnya sudah di
  tangan admin saat itu juga. `userId: null`, `guestName` wajib,
  `guestPhone` **opsional** (beda dari guest checkout online — admin
  yang input manual, kadang tamu tak mau kasih nomor).
- Zod `adminBookingSchema`: jam & tanggal operasional sama kayak
  `createBookingSchema`, TAPI **boleh jam yang sedang berjalan**
  (tanpa refine "jam sudah lewat") — walk-in fisik sudah di tempat, beda
  konteks dari customer online yang booking jam depan.
- **Konflik slot**: reuse EXCLUDE constraint `bookings_no_overlap` yang
  sama dipakai booking online — kalau slot sudah ada row aktif
  (pending/confirmed), insert kena `23P01` → 409. **Sengaja tidak ada
  logic "override paksa"**: kalau admin mau walk-in menang atas booking
  online yang masih `pending`, admin cancel dulu manual booking itu
  (`PATCH /api/admin/bookings/[id]`, sudah ada) baru Close Booking lagi.
  Prioritas siapa menang ditentukan admin lewat urutan klik, bukan
  logic sistem yang mutusin sepihak.
- `GET /api/admin/bookings`: `innerJoin(users)` → **`leftJoin`** — booking
  walk-in tidak punya baris `users`; `innerJoin` akan diam-diam
  menghilangkan mereka dari dashboard admin. Kolom `guestName`/
  `guestPhone` ditambahkan ke response.
- Dashboard admin (`(app)/admin/page.tsx`): tombol "+ Close Booking"
  membuka form inline (bukan modal/dialog — satu form sederhana, tidak
  butuh komponen baru). Baris tabel booking walk-in ditandai badge
  "Cash" di kolom Pemesan.

### Notifikasi manual admin via WhatsApp (revisi 2026-07-12)

Bukan API gateway (Fonnte/Twilio dll) — cukup deep link `wa.me`, jadi
tidak ada dependency baru & tidak ada biaya per-pesan. Konsekuensinya:
ini **fire-and-forget, aksi manual customer** (klik tombol → buka WA →
customer sendiri yang kirim), bukan notifikasi otomatis push ke admin.
Tidak ada state "sudah dinotif" yang disimpan — murni UI convenience.

- `ADMIN_WA_PHONE` (`lib/constants.ts`) — hardcoded, sama nomor dengan
  kontak WA publik di section Lokasi (satu admin, satu nomor).
- `buildAdminWaLink()` (`lib/wa.ts`) — pure client function, base URL
  dari `window.location.origin` (bukan env var baru — app ini tidak
  punya `NEXT_PUBLIC_SITE_URL`, dan `origin` otomatis benar di
  dev/preview/prod). Link tujuan `/admin` (list dashboard) — tidak ada
  halaman detail per-booking, jadi pesan cukup sebut ringkasan
  (nama/lapangan/tanggal/jam) yang bisa dicocokkan admin di tabel.
- Tombol "Konfirmasi ke Admin via WhatsApp" muncul di `booking-section.tsx`
  step 4, tepat setelah bukti pembayaran terkirim (`proofDone`) — bukan
  sebelum upload, dan bukan di jalur `/fields/[id]` (`booking-form.tsx`)
  yang langsung redirect keluar tanpa step konfirmasi inline.
