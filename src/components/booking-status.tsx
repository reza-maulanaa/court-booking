"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MAX_PROOF_MB } from "@/lib/constants";
import { BookingCard, type BookingCardData } from "@/components/booking-card";

type Field = { id: string; name: string };

// Halaman status booking tanpa login (guest checkout) — akses cukup lewat
// ID di URL, sama seperti pola akses bukti transfer (lihat GET
// /api/bookings/[id]). Dipakai juga oleh user login (redirect kalau dia
// yang buka link booking-nya sendiri), tapi jalur utamanya guest.
export function BookingStatus({ id }: { id: string }) {
  const [booking, setBooking] = useState<BookingCardData | null | undefined>(
    undefined,
  );
  const [fieldName, setFieldName] = useState("Lapangan");
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}`);
    if (!res.ok) {
      setBooking(null);
      return;
    }
    const data: BookingCardData & { fieldId: string } = await res.json();
    setBooking(data);
    const fieldsRes = await fetch("/api/fields");
    if (fieldsRes.ok) {
      const allFields: Field[] = await fieldsRes.json();
      setFieldName(
        allFields.find((f) => f.id === data.fieldId)?.name ?? "Lapangan",
      );
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PROOF_MB * 1024 * 1024) {
      toast.error(`Ukuran maksimal ${MAX_PROOF_MB}MB — kirim screenshot saja.`);
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/bookings/${id}/proof`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) toast.error(data?.error ?? "Upload gagal, coba lagi.");
    else toast.success("Bukti terkirim! Menunggu verifikasi admin.");
    setUploading(false);
    load();
  }

  async function handleCancel() {
    if (!confirm("Batalkan booking ini? Tidak bisa dikembalikan.")) return;
    setCancelling(true);
    const res = await fetch(`/api/bookings/${id}`, { method: "PATCH" });
    const data = await res.json().catch(() => null);
    if (!res.ok) toast.error(data?.error ?? "Gagal membatalkan, coba lagi.");
    else toast.success("Booking dibatalkan.");
    setCancelling(false);
    load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-heading mb-6 text-3xl font-extrabold tracking-wide uppercase italic">
        Status Booking
      </h1>

      {booking === undefined ? (
        <p className="text-base text-muted-foreground">Memuat...</p>
      ) : booking === null ? (
        <p className="text-base text-muted-foreground">
          Booking tidak ditemukan — link salah atau sudah kedaluwarsa.
        </p>
      ) : (
        <BookingCard
          booking={booking}
          fieldName={fieldName}
          uploading={uploading}
          onUpload={handleUpload}
          cancelling={cancelling}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
