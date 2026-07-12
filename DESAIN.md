# DESAIN — UI Sistem Booking Lapangan Futsal

Keputusan desain frontend + alasannya. Kode UI ditulis mengikuti dokumen ini
(bukan sebaliknya). Perubahan keputusan = update dokumen dulu.

## 1. Prinsip

1. **Mobile-first.** Orang booking lapangan dari HP. Layout didesain dari
   layar kecil, melebar ke desktop (`max-w` container + grid yang nambah
   kolom). Pengecualian: halaman admin boleh nyaman di desktop dulu,
   admin kerja dari laptop.
2. **Terang, satu aksen.** Background putih/netral, satu warna aksen hijau
   futsal. Alasan: paling aman buat portfolio, fokus ke fungsionalitas,
   gampang konsisten.
3. **shadcn/ui apa adanya dulu.** Komponen dipakai dengan default-nya;
   kustomisasi cuma lewat token di `globals.css`. Styling manual = jalan
   terakhir.
4. **Backend yang ngomong.** Pesan error dari API (Zod, 401/403/409) sudah
   ramah bahasa Indonesia — UI menampilkan apa adanya, tidak menerjemahkan
   ulang. Satu sumber pesan.

## 2. Tema & token (nilai warna/font DIGANTIKAN §2e — struktur token tetap)

- Base: netral `zinc` bawaan shadcn, background putih.
- Aksen (primary): **hijau tua lapangan** `oklch(0.527 0.154 150)`
  (≈ Tailwind `green-700`), diset sebagai token `--primary` + `--ring` di
  `globals.css` — SATU tempat, semua komponen ngikut. Dipakai untuk: tombol
  aksi utama, slot terpilih, badge `confirmed`, focus ring.
  Alasan hijau tua (bukan muda): teks putih di atasnya lolos kontras
  4.5:1; hijau muda maksa teks gelap dan pucat di background putih.
  (Keputusan 2026-07-04: user menolak primary hitam default shadcn.)
  **→ §2e (2026-07-11): nilai persis diganti `#0e7b45` (tf-green), tapi
  prinsip "satu token, semua komponen ngikut" ini justru yang dipakai
  untuk migrasi ke identitas landing — bukan diganti caranya.**
- Status booking → warna badge (satu-satunya pemakaian warna di luar aksen):
  `pending` kuning, `confirmed` hijau, `completed` abu netral,
  `cancelled` merah pudar. **Keputusan ini tetap berlaku pasca-§2e** —
  tidak diseragamkan jadi hijau brand.
- Font: ~~Geist (bawaan create-next-app)~~ → Barlow/Barlow Condensed
  sejak §2e. Radius & shadow: default shadcn, radius dipertahankan
  (sudah cocok dengan landing), shadow Card diperbarui di §2e.
- **Tidak dibuat**: dark mode. Alasan: nambah ±2× kerja styling tanpa
  nambah nilai demo MVP. (Masih berlaku pasca-§2e — lihat §2e.)

## 2b. Hero section & animasi (keputusan 2026-07-04 — DIGANTIKAN §2c)

> **2026-07-05**: hero SVG + GSAP diganti hero video (§2c). Poin "batas
> pemakaian animasi" dan "prefers-reduced-motion" di bawah tetap berlaku
> sebagai prinsip; implementasi hero-nya yang berubah. gsap sekarang tidak
> dipakai siapa pun — boleh di-uninstall, atau disimpan untuk
> micro-interaction nanti.

- Halaman `/` dibuka **hero section** dengan **animasi lapangan futsal**
  (SVG lapangan: garis lapangan ter-gambar berurutan, bola bergerak,
  headline + CTA "Lihat Lapangan" masuk setelahnya).
- Engine animasi: **GSAP saja** (timeline untuk koreografi berurutan).
  anime.js tidak dipasang — overlap ±95% dengan GSAP; dua engine untuk
  satu hero melanggar prinsip performa.
- Batas pemakaian animasi: hero section saja + micro-interaction kecil
  (hover card, transisi badge). Halaman fungsional (booking, admin) tetap
  tanpa animasi dekoratif — di sana kecepatan > gaya.
- `prefers-reduced-motion` dihormati: animasi hero jadi keadaan akhir
  statis. (Aksesibilitas §5 berlaku juga untuk animasi.)
- Referensi gaya komponen: pola dari 21st.dev / refero.design sebagai
  acuan visual, implementasi tetap shadcn + Tailwind (bukan dependency
  baru).

## 2c. Hero Video (keputusan 2026-07-05)

Decision log — menggantikan hero SVG/GSAP §2b:

- **Video sebagai background hero, bukan gambar statis.** Alasan: footage
  lapangan asli menjual suasana lebih kuat daripada ilustrasi; untuk
  portfolio, hero video juga mendemokan penanganan media + a11y.
  File: `public/futsal.mp4` (1280×720, 10 detik, 2,6MB — ukuran kecil
  disengaja agar layak `preload="auto"`; kalau ganti footage, jaga di
  bawah ±5MB).
- **Aspect ratio asli 16:9, ditampilkan `object-cover`.** Video mengisi
  penuh kontainer di semua breakpoint; di mobile portrait sisi kiri-kanan
  ter-crop. Alasan: crop lebih baik daripada gepeng (distorsi) atau
  letterbox (bar hitam) — komposisi tengah frame tetap terlihat.
- **Overlay gelap `bg-black/50`** (hitam 50%) solid di atas video.
  Alasan: frame video berubah-ubah, kontras teks tidak bisa dijamin per
  frame; 50% hitam membuat teks putih lolos WCAG 4.5:1 di frame seterang
  apa pun. Solid dipilih atas gradient: lebih sederhana dan kontras
  merata di semua posisi teks.
- **Poster: `public/hero-poster.jpg`** (frame pertama video, via ffmpeg).
  Dipakai dua lapis: atribut `poster` di `<video>` + `<img>` di belakang
  video. Alasan: koneksi lambat langsung lihat gambar (bukan kotak
  hitam), dan poster = frame pertama membuat transisi ke video mulus.
- **`prefers-reduced-motion` dihormati via client component kecil**
  (`hero-video.tsx`, `matchMedia` lewat `useSyncExternalStore`): kalau
  user set reduce, elemen `<video>` TIDAK dirender sama sekali — bukan
  sekadar disembunyikan CSS. Alasan: `display:none` tetap mengunduh
  video (2,6MB sia-sia); tidak dirender = tidak diunduh, user dapat
  poster statis. Konsekuensi sadar: video baru muncul setelah hydration
  (celahnya ditutup poster).
- **Tinggi hero `85svh`** (bukan `h-screen`/100vh). Alasan: (1) `svh`
  menghitung viewport mobile dengan URL bar terlihat — `100vh` di mobile
  Safari lebih tinggi dari layar dan bikin lompatan; (2) 85% menyisakan
  intip-an katalog di bawah, isyarat bahwa halaman bisa di-scroll —
  hero full-screen sering dikira "halamannya cuma ini".

**Update 2026-07-05 (2) — scroll-scrubbing (keputusan bersama via opsi):**

- **Video tidak autoplay lagi; progress video terikat scroll** (ala
  landing Apple). Wrapper hero setinggi `300vh`, konten hero `sticky`
  setinggi viewport; scroll 0→100% wrapper = video frame awal→akhir,
  dua arah. Alasan: hero jadi interaktif dan memorable — nilai demo
  portfolio — dan video 10 detik pas untuk ±2 viewport jarak scroll.
- **File terpisah `public/futsal-scrub.mp4`** (4,7MB, H.264 openh264,
  tanpa audio, keyframe tiap 4 frame / `-g 4`). Alasan: mp4 asli cuma
  punya 1 keyframe per 10 detik — `currentTime` seeking harus decode
  dari frame 0 setiap kali = scrub patah-patah. Keyframe rapat = seek
  murah. Trade-off sadar: ukuran naik 2,6→4,7MB demi kehalusan scrub;
  `preload="auto"` kini WAJIB (scrub butuh buffer penuh).
- **Scrub via `requestAnimationFrame` + lerp tanpa library** (bukan GSAP
  ScrollTrigger): logika inti cuma ±30 baris — progress dari
  `getBoundingClientRect`, `currentTime` dikejar pelan (lerp 0.15) biar
  halus. gsap resmi tidak dipakai lagi.
- **`prefers-reduced-motion`**: wrapper kolaps ke `85svh` murni via CSS
  (`motion-safe:` variant), video tetap tidak dirender/diunduh — user
  reduce dapat hero statis normal tanpa pin-scroll.
- **Polish halaman publik (scope keputusan bersama)**: navbar sticky +
  backdrop-blur; katalog card hover lift + ikon lapangan; footer
  sederhana; halaman field & auth dirapikan. Tetap dalam pagar §1–§2:
  shadcn default, satu aksen hijau, tanpa dark mode.

## 2d. Landing "Tanjung Futsal" (keputusan 2026-07-10 — menggantikan §2c untuk halaman `/`)

Halaman `/` diganti total dengan landing page hasil prototipe
"Tanjung Futsal.html" (fidelitas visual 1:1, keputusan user via opsi).
Halaman lain tetap §2 (shadcn + Geist + navbar/footer lama).

- **Identitas terpisah dari tema global**: font Barlow + Barlow Condensed
  (next/font, di-load hanya di `/`), palet sendiri sebagai token `tf-*` di
  `globals.css` (hijau `#0E7B45`, lime `#C6E750`, ink `#12241A`, hijau gelap
  `#08301D`, bg section `#F5F7F3`). Alasan token (bukan hex tersebar):
  satu sumber nilai, konsisten dengan pola `--primary` §2.
- **Struktur**: route group — `/` berdiri sendiri dengan nav + footer
  desain baru; halaman lama pindah ke `src/app/(app)/` yang me-render
  Navbar + footer lama. Root layout tinggal html/body/Toaster.
  Hero video §2c (hero-section/hero-video) dihapus — `/` tidak memakainya
  lagi; file video di `public/` dibiarkan (aset, bukan kode).
- **Booking 3 langkah di landing terhubung backend asli** (keputusan user:
  integrasi penuh): daftar lapangan + harga dari DB, slot dari availability
  API, "Konfirmasi Booking" → `POST /api/bookings`. Konsekuensi sadar:
  (1) wajib login — belum login diarahkan ke `/login`;
  (2) jam pilihan non-kontinu dipecah jadi beberapa booking (backend: satu
  booking = satu rentang);
  (3) pilihan metode pembayaran & field nama/WA/catatan hanya tampilan
  (fidelitas prototipe) — backend memakai user JWT dan alur bukti transfer
  §9 ARCHITECTURE, metode bayar memang tidak disimpan;
  (4) "kode booking" = 4 karakter pertama id booking asli (`TF-XXXX`).
- **Copywriting, harga (Rp 50.000/jam), dan jam operasional (08.00–23.00)
  dari prototipe tidak diubah.** Placeholder bergaris = slot foto asli,
  sengaja dibiarkan placeholder.
- Prototipe didesain desktop 1280px; breakpoint mobile ditambahkan wajar
  (grid kolaps, nav link tengah disembunyikan <768px) — prinsip §1 tetap.
- **Rebrand "Tanjung Futsal" → "Booking Futsal"** (2026-07-11): semua teks
  tampil (nav, footer, page title, alt foto, judul galeri) dan prefix kode
  booking (`TF-` → `BF-`). Alamat & embed peta di section Lokasi diganti
  lokasi asli (Google Maps embed `pb=` tanpa API key) menggantikan alamat
  fiktif prototipe — masih level kecamatan, tinggal diperbarui kalau ada
  alamat jalan persis.
- **Font header/footer dipertegas + micro-interaction tombol** (2026-07-11):
  logo nav/footer naik ke `text-2xl`+, link nav/footer naik dari
  `font-medium`/`font-semibold` ke `font-bold`. Semua tombol & link landing
  (CTA, kartu pilihan, slot jam, FAQ, dst) dapat `transition` + hover
  (lift/scale + shadow untuk CTA solid) + `active:scale` (feedback tekan).
  Ini sejalan dengan batas §2b yang dari awal mengizinkan "micro-interaction
  kecil (hover card, transisi badge)" — bukan pengecualian baru. Slot jam
  yang disabled (terisi) sengaja tidak dapat animasi (bukan interaktif).

## 2e. Identitas brand meluas ke seluruh (app) — bukan landing saja (2026-07-11)

Keputusan user (dipilih via opsi, "restyle semua"): identitas visual §2d
(font Barlow, palet `tf-*`, radius, micro-interaction tombol) yang tadinya
cuma di `/`, sekarang jadi identitas **satu aplikasi** — termasuk Navbar +
footer (app) yang dipakai bersama oleh `/login`, `/register`, `/admin`,
`/bookings`, `/fields/[id]`. §2 (shadcn + Geist) resmi digantikan §2e untuk
seluruh app, bukan cuma landing.

**Strategi implementasi — retarget token, bukan tulis ulang komponen:**
Karena halaman (app) sudah dibangun di atas shadcn/ui yang men-drive
warna/radius lewat CSS custom property (`--primary`, `--background`,
`--muted`, `--ring`, dst — dikonsumsi via utility Tailwind seperti
`bg-primary`, `text-foreground`), cara paling efisien & termudah dirawat
adalah me-retarget nilai token itu di `:root` (`globals.css`) ke hex `tf-*`
yang sama persis dengan landing — BUKAN menulis ulang className tiap
Button/Card/Input satu-satu. Efeknya otomatis menjalar ke semua pemakaian
komponen itu di seluruh app tanpa disentuh manual.

- `--primary` → `#0e7b45` (tf-green, sama persis dengan aksen landing),
  `--primary-foreground` → putih, `--ring` → tf-green (focus ring).
- `--background`/`--foreground` → putih/tf-ink. `--muted`/`--secondary`
  → tf-mist, `--accent` → tf-pale — neutral dipilih (bukan default abu
  oklch), konsisten prinsip "choose neutrals, don't default to them".
- `--destructive` **sengaja tidak diubah** (tetap merah) — begitu juga
  `StatusBadge` (pending kuning, cancelled merah, dst, §2): warna status
  booking adalah satu-satunya pemakaian warna semantik di luar aksen,
  keputusan §2 lama tetap berlaku, bukan diseragamkan jadi hijau.
- Dark mode (`.dark` token) dibiarkan tidak disentuh — dikonfirmasi tidak
  ada `ThemeProvider` terpasang di mana pun (`useTheme()` di `sonner.tsx`
  jatuh ke default tanpa provider), jadi token itu memang tidak pernah
  aktif; sesuai §2 "Tidak dibuat: dark mode."
- **Font**: Barlow + Barlow Condensed pindah dari `page.tsx` (landing-only)
  ke `layout.tsx` (root, site-wide), Geist dihapus total. `--font-sans`
  diarahkan ke Barlow (sebelumnya `var(--font-sans)` — self-reference,
  bug lama yang tidak pernah nyala) dan `--font-heading` ke Barlow
  Condensed, supaya `CardTitle` (dipakai AuthForm) & heading manual di
  admin/bookings/fields otomatis dapat font display tanpa override
  per-halaman.
- **Button** (`ui/button.tsx`, dipakai di semua (app) page): base weight
  naik ke `font-bold`; `active:translate-y-px` lama diganti
  `active:scale-[0.97]` (konsisten pola landing). Hover-lift + shadow
  cuma di size `default`/`lg` (dipakai submit form/CTA) — size `sm`/`xs`
  (tombol aksi tabel admin, navbar) sengaja tidak lift, supaya tabel
  padat berisi banyak tombol tidak "loncat-loncat" saat disapu mouse.
- **Card**: radius naik `rounded-xl` → `rounded-2xl` + shadow landing
  (`shadow-[0_2px_10px_rgba(18,36,26,.05)]`), radius `--radius` (10px,
  dipakai Input/Select/Button) sudah pas sama dengan landing, tidak
  diubah.
- Heading `<h1>` di admin/bookings/fields dan `CardTitle` di AuthForm
  pakai treatment sama dengan section-heading landing: `font-heading`
  extrabold uppercase italic. Link inline (`text-primary underline`)
  diseragamkan ke pola landing: tanpa underline, warna+scale+transisi.

## 3. Peta halaman

| Route | Akses | Isi | Sumber data |
|---|---|---|---|
| `/` | publik | landing Tanjung Futsal (§2d): hero, booking 3 langkah, lapangan & harga, fasilitas, galeri, testimoni, FAQ, lokasi | db langsung (Server Component) + `GET /api/fields/[id]/availability` + `POST /api/bookings` |
| `/fields/[id]` | publik | pilih tanggal → grid slot jam 08–23 → form booking (jam mulai, durasi) | `GET /api/fields/[id]/availability?date=` |
| `/login`, `/register` | publik | form auth | `POST /api/auth/*` |
| `/bookings` | user | daftar booking milik sendiri + badge status + cancel (saat pending) | `GET /api/bookings` |
| `/admin` | admin | tabel booking masuk, aksi approve/reject/complete, filter tanggal/lapangan | `GET /api/admin/bookings` |

Navigasi: navbar sederhana (logo teks kiri; kanan: "Booking Saya" + nama
user + logout kalau login, tombol "Masuk" kalau belum; link "Admin" hanya
untuk role admin). Tanpa sidebar — halamannya cuma 5.

## 4. Komponen shadcn yang dipakai

`button` (sudah ada), `input`, `label`, `card`, `badge`, `table`, `select`,
`sonner` (toast). Ditambah saat dibutuhkan, tidak diborong di depan.

## 5. Pola UX

- **Grid slot jam** (inti aplikasi): tombol per jam 08:00–22:00, tiga
  keadaan — kosong (outline, bisa diklik), terisi (disabled, abu),
  terpilih (aksen hijau). Durasi = pilih jam mulai lalu select durasi;
  slot yang kena rentang ikut ter-highlight. Target sentuh min. 44px.
- **Form**: label selalu terlihat (bukan placeholder-only), error inline di
  bawah field dari pesan API, tombol submit disabled + teks "..." saat
  loading. Setelah sukses: redirect + toast.
- **Konflik booking (409/23P01)**: toast merah dengan pesan API, lalu
  availability di-refresh otomatis — slot yang barusan direbut orang
  langsung kelihatan terisi. Ini momen UX paling penting: race yang
  ditangkap constraint harus terasa "yah keduluan", bukan "aplikasi rusak".
- **State kosong**: tiap daftar punya pesan kosong + aksi ("Belum ada
  booking. Lihat jadwal lapangan →").
- **Aksesibilitas dasar** (tidak ditawar): semua input ber-`<label>`,
  kontras teks ≥ 4.5:1, fokus keyboard kelihatan, tombol slot pakai
  `aria-pressed`.

## 6. Definisi selesai (UI MVP)

- Semua flow SPEC §2 bisa dijalankan dari HP (viewport 375px) tanpa zoom.
- Tidak ada teks Inggris nyasar di UI.
- Lighthouse accessibility ≥ 90 di halaman publik.
