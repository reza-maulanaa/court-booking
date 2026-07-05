"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type BookingStatus } from "@/components/status-badge";
import {
  MAX_PROOF_MB,
  PROOF_DEADLINE_MIN,
  TRANSFER_INFO,
} from "@/lib/constants";

type Booking = {
  id: string;
  fieldId: string;
  bookingDate: string;
  startHour: number;
  durationHours: number;
  hargaSnapshot: number;
  proofUrl: string | null;
  status: BookingStatus;
  createdAt: string;
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

// input file native dibungkus label bergaya tombol — tanpa library upload
function UploadLabel({
  uploading,
  label,
  onFile,
}: {
  uploading: boolean;
  label: string;
  onFile: (f: File | undefined) => void;
}) {
  return (
    <label
      className={`${buttonVariants({ variant: "default", size: "sm" })} w-fit cursor-pointer`}
    >
      {uploading ? "Mengunggah..." : label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function sisaMenit(createdAt: string): number {
  const lewat = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  return Math.max(0, Math.ceil(PROOF_DEADLINE_MIN - lewat));
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
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
    load();
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

                  {b.status === "pending" && (
                    <div className="w-full rounded-lg border bg-muted/50 p-4 text-sm">
                      {b.proofUrl ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Bukti transfer terkirim ✓ — menunggu verifikasi
                            admin.{" "}
                            <a
                              href={`/api/bookings/${b.id}/proof`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline"
                            >
                              Lihat bukti
                            </a>
                          </span>
                          <UploadLabel
                            uploading={uploading === b.id}
                            label="Ganti bukti"
                            onFile={(f) => handleUpload(b.id, f)}
                          />
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          <div>
                            Bayar{" "}
                            <b>
                              {rupiah.format(b.hargaSnapshot * b.durationHours)}
                            </b>{" "}
                            lalu upload bukti dalam{" "}
                            <b>{sisaMenit(b.createdAt)} menit</b> — lewat dari
                            itu booking hangus otomatis.
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis kecil, tak perlu optimasi next/image */}
                            <img
                              src="/qris.svg"
                              alt="QRIS — scan untuk bayar"
                              width={112}
                              height={112}
                              className="rounded-md border"
                            />
                            <div className="grid gap-1">
                              <div className="font-semibold">Scan QRIS</div>
                              <div className="text-muted-foreground">
                                atau transfer bank:
                              </div>
                              <div>
                                <b>
                                  {TRANSFER_INFO.bank} {TRANSFER_INFO.norek}
                                </b>{" "}
                                a.n. {TRANSFER_INFO.atasNama}
                              </div>
                            </div>
                          </div>
                          <UploadLabel
                            uploading={uploading === b.id}
                            label="Upload bukti pembayaran"
                            onFile={(f) => handleUpload(b.id, f)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
