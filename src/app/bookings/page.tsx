"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type BookingStatus } from "@/components/status-badge";

type Booking = {
  id: string;
  fieldId: string;
  bookingDate: string;
  startHour: number;
  durationHours: number;
  hargaSnapshot: number;
  status: BookingStatus;
};

type Field = { id: string; name: string };

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const jam = (h: number) => `${String(h).padStart(2, "0")}.00`;

const tanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [fieldNames, setFieldNames] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState<string | null>(null);

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
    load();
  }, [load]);

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
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        Booking Saya
      </h1>

      {bookings === null ? (
        <p className="text-base text-muted-foreground">Memuat...</p>
      ) : bookings.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Belum ada booking.{" "}
          <Link href="/" className="text-primary underline">
            Lihat jadwal lapangan →
          </Link>
        </p>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => {
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1 text-base">
                    <div className="text-lg font-bold">
                      {fieldNames[b.fieldId] ?? "Lapangan"}
                    </div>
                    <div className="text-muted-foreground">
                      {tanggal(b.bookingDate)} · {jam(b.startHour)}–
                      {jam(b.startHour + b.durationHours)}
                    </div>
                    <div className="font-semibold text-primary">
                      {rupiah.format(b.hargaSnapshot * b.durationHours)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    {b.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancelling === b.id}
                        onClick={() => handleCancel(b.id)}
                      >
                        {cancelling === b.id ? "..." : "Batalkan"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
