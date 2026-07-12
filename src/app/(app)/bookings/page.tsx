"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MAX_PROOF_MB } from "@/lib/constants";
import { BookingCard, type BookingCardData } from "@/components/booking-card";

type Field = { id: string; name: string };

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingCardData[] | null>(null);
  const [fieldNames, setFieldNames] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [bookingsRes, fieldsRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch("/api/fields"),
    ]);
    if (!bookingsRes.ok) {
      toast.error("Gagal memuat booking, coba muat ulang.");
      return;
    }
    setBookings(await bookingsRes.json());
    if (fieldsRes.ok) {
      const allFields: Field[] = await fieldsRes.json();
      setFieldNames(Object.fromEntries(allFields.map((f) => [f.id, f.name])));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function handleUpload(id: string, file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PROOF_MB * 1024 * 1024) {
      toast.error(`Ukuran maksimal ${MAX_PROOF_MB}MB — kirim screenshot saja.`);
      return;
    }
    setUploading(id);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/bookings/${id}/proof`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) toast.error(data?.error ?? "Upload gagal, coba lagi.");
    else toast.success("Bukti terkirim! Menunggu verifikasi admin.");
    setUploading(null);
    load();
  }

  async function handleCancel(id: string) {
    if (!confirm("Batalkan booking ini? Tidak bisa dikembalikan.")) return;
    setCancelling(id);
    const res = await fetch(`/api/bookings/${id}`, { method: "PATCH" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal membatalkan, coba lagi.");
    } else {
      toast.success("Booking dibatalkan.");
    }
    setCancelling(null);
    load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-heading mb-6 text-3xl font-extrabold tracking-wide uppercase italic">
        Booking Saya
      </h1>

      {bookings === null ? (
        <p className="text-base text-muted-foreground">Memuat...</p>
      ) : bookings.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Belum ada booking.{" "}
          <Link
            href="/"
            className="inline-block font-semibold text-primary transition-all duration-200 hover:scale-105 hover:text-primary/80 active:scale-95"
          >
            Lihat jadwal lapangan →
          </Link>
        </p>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              fieldName={fieldNames[b.fieldId] ?? "Lapangan"}
              uploading={uploading === b.id}
              onUpload={(f) => handleUpload(b.id, f)}
              cancelling={cancelling === b.id}
              onCancel={() => handleCancel(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
