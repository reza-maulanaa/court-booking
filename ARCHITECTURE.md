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

Enum: `pending`, `confirmed`, `completed`, `cancelled`.

| Dari | Ke | Trigger | Siapa |
|---|---|---|---|
| pending | confirmed | approve (pembayaran manual diterima) | admin |
| pending | cancelled | reject | admin |
| pending | cancelled | batalkan sendiri | user pemilik |
| confirmed | completed | sesi selesai dimainkan | admin |
| confirmed | cancelled | pembatalan setelah konfirmasi | admin |

- `completed` dan `cancelled` = terminal, tidak ada transisi keluar.
- Transisi lain (mis. `pending → completed`, `cancelled → confirmed`) invalid.
- Implementasi: satu fungsi `canTransition(from, to, actor)` dengan tabel di
  atas sebagai data; update status selalu
  `UPDATE ... WHERE id = $1 AND status = $2(from)` — kalau 0 baris berubah,
  status sudah berubah di tengah jalan (optimistic check, tanpa lock).
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

## 9. Email (Resend)

Dikirim **setelah** transaksi DB sukses, fire-and-forget dengan catch + log.
**Alasan**: email gagal ≠ booking gagal; booking adalah source of truth,
email hanya notifikasi. Tanpa queue/retry di MVP — kalau butuh reliabilitas
email, tambah nanti.

## 10. Testing (Vitest)

Prioritas test = tempat logika bisa salah:
1. `canTransition` — seluruh matriks transisi.
2. Kalkulasi availability (expand booking → jam terisi).
3. Integration: dua insert overlap paralel ke DB test → tepat satu sukses,
   satu tertangkap sebagai `23P01`.
4. Zod schemas (batas jam, durasi, tanggal).

Tidak menguji framework (routing Next, Drizzle sendiri).
