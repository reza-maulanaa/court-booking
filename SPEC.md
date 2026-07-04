# SPEC — Sistem Booking Lapangan Futsal (MVP)

## 1. Ringkasan

Aplikasi web untuk booking lapangan futsal. User melihat katalog lapangan,
mengecek ketersediaan per jam, dan membuat booking. Admin meng-approve/reject
booking (pembayaran manual di luar sistem) dan melihat jadwal. Konfirmasi
dikirim via email (Resend).

Stack: Next.js (App Router) + TypeScript, Drizzle ORM, Neon Postgres,
custom JWT (jose), Zod, Tailwind v4 + shadcn/ui, Vitest, deploy Vercel.

## 2. Scope

### Masuk MVP
- Registrasi & login (email + password, custom JWT di cookie httpOnly).
- Katalog lapangan: nama, harga per jam.
- Availability per lapangan per tanggal: daftar jam kosong/terisi,
  dihitung on-the-fly (lihat ARCHITECTURE §3).
- Form booking: pilih lapangan, tanggal, jam mulai, durasi (jam bulat).
- Halaman "booking saya": daftar + status, cancel selama masih `pending`.
- Admin dashboard: daftar booking masuk, approve/reject, lihat jadwal
  per lapangan per tanggal, tandai selesai (`completed`).
- Email via Resend: booking dibuat (ke user), status berubah
  confirmed/cancelled (ke user).

### Di luar MVP (eksplisit TIDAK dibuat)
- Payment gateway — pembayaran manual, admin yang confirm.
- Booking berulang (recurring), multi-lapangan sekali submit.
- Notifikasi selain email, reset password, manajemen lapangan via UI
  (lapangan di-seed lewat script/SQL).

## 3. Aturan bisnis

- **Jam operasional**: 08:00–23:00. `start_hour` valid 8–22,
  `start_hour + duration_hours <= 23`. Konstanta aplikasi + CHECK di DB.
- **Durasi**: integer >= 1 jam, kelipatan 1 jam.
- **Tanggal booking**: hari ini s/d 30 hari ke depan (validasi aplikasi saja;
  bukan constraint DB karena "hari ini" berubah tiap hari).
- **Satu slot satu booking**: tidak boleh ada dua booking aktif
  (status ≠ cancelled) yang overlap pada lapangan & tanggal sama.
  Garansi final di database (EXCLUSION constraint, lihat ARCHITECTURE §4).
- **Harga**: `harga_snapshot` = harga per jam lapangan **saat booking dibuat**.
  Total = `harga_snapshot × duration_hours` (dihitung, tidak disimpan).
  Perubahan harga lapangan tidak mengubah booking lama.
- **Status**: state machine `pending → confirmed → completed / cancelled`
  (transisi lengkap di ARCHITECTURE §5).
- **Cancel oleh user**: hanya saat `pending`. Setelah `confirmed`,
  pembatalan lewat admin.

## 4. Model data

Tiga tabel (skema Drizzle lengkap + migration SQL di ARCHITECTURE §7):

| Tabel | Kolom |
|---|---|
| `users` | id (uuid text, PK), name, email (unique), password_hash, role (`user`\|`admin`) |
| `fields` | id (PK), name, harga_per_jam (integer, rupiah) |
| `bookings` | id (PK), user_id (FK→users), field_id (FK→fields), booking_date (date), start_hour (int), duration_hours (int), harga_snapshot (int, per jam), status (enum), created_at |

Tidak ada tabel slot. Slot deterministik dari
(field_id, booking_date, start_hour).

## 5. Routes / API (sketsa)

| Route | Method | Akses | Fungsi |
|---|---|---|---|
| `/api/auth/register`, `/login`, `/logout` | POST | publik | auth |
| `/api/fields` | GET | publik | katalog |
| `/api/fields/[id]/availability?date=` | GET | publik | jam kosong/terisi |
| `/api/bookings` | POST | user | buat booking |
| `/api/bookings` | GET | user | booking milik sendiri |
| `/api/bookings/[id]/cancel` | POST | user (pemilik) | cancel saat pending |
| `/api/admin/bookings` | GET | admin | semua booking + filter |
| `/api/admin/bookings/[id]/status` | PATCH | admin | approve/reject/complete |

Validasi input semua endpoint dengan Zod. Proteksi route via middleware
(verifikasi JWT dengan jose; cek role untuk `/admin`).

## 6. Definisi selesai (MVP)

- Semua flow §2 jalan end-to-end di Vercel + Neon.
- Double-booking terbukti tidak mungkin: test Vitest yang insert dua booking
  overlap secara paralel — satu sukses, satu dapat error ramah.
- Transisi status di luar tabel valid ditolak.
