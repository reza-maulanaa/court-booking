export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 23;
export const MAX_DAYS_AHEAD = 30;

// Pembayaran manual: batas upload bukti transfer sejak booking dibuat.
export const PROOF_DEADLINE_MIN = 30;
// Vercel memotong body request ~4.5MB — di atas itu upload gagal sebelum
// sampai ke kode kita, jadi batas aplikasi harus di bawahnya.
export const MAX_PROOF_MB = 4;
// ponytail: rekening hardcoded — pindah ke DB kalau admin butuh ganti via UI
export const TRANSFER_INFO = {
  bank: "SEABANK",
  norek: "901397238897",
  atasNama: "Reza Maulana",
};

export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}
export function nowHourWIB(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}
