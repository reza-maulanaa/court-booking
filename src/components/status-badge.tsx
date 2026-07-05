import { Badge } from "@/components/ui/badge";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired";

const STATUS_BADGE: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Dikonfirmasi", className: "bg-primary text-primary-foreground" },
  completed: { label: "Selesai", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Dibatalkan", className: "bg-red-100 text-red-700" },
  expired: { label: "Kadaluarsa", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const badge = STATUS_BADGE[status];
  return <Badge className={badge.className}>{badge.label}</Badge>;
}
