// Nomor HP Indonesia: buang semua non-digit, ganti awalan 0 jadi 62 — biar
// "0812..." dan "+62812..." dianggap identitas yang sama (anti-abuse guest
// checkout & link wa.me butuh format internasional tanpa simbol).
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "62");
}
