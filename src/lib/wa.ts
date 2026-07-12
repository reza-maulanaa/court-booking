import { normalizePhone } from "./phone";

// origin diambil dari window.location.origin oleh caller (client-only) —
// app ini gak punya NEXT_PUBLIC_SITE_URL, dan origin otomatis benar di
// dev/preview/prod tanpa env var baru.
export function buildAdminWaLink(params: {
  adminPhone: string;
  customerName: string;
  summary: string;
  origin: string;
}): string {
  const { adminPhone, customerName, summary, origin } = params;
  const message = `Booking baru dari ${customerName}\n${summary}\nCek & approve: ${origin}/admin`;
  return `https://wa.me/${normalizePhone(adminPhone)}?text=${encodeURIComponent(message)}`;
}
