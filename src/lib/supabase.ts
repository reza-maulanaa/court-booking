import { createClient } from "@supabase/supabase-js";

// Supabase dipakai HANYA sebagai private object storage untuk bukti
// transfer — bukan Supabase Auth (app ini pakai JWT sendiri, lib/auth.ts).
// Karena itu client di sini pakai service role key (bypass RLS) dan
// SELALU dipanggil di server (route handler) setelah otorisasi
// pemilik/admin dicek lewat session — sama seperti pola @vercel/blob
// sebelumnya, cuma provider-nya diganti.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const PROOF_BUCKET = "bukti-transfer";
