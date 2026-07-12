"use client";

import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type BookingStatus } from "@/components/status-badge";
import { PROOF_DEADLINE_MIN, TRANSFER_INFO } from "@/lib/constants";

export type BookingCardData = {
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

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const jam = (h: number) => `${String(h).padStart(2, "0")}.00`;

// Kode cuma berarti (dan cuma ditampilkan) setelah admin ACC — sebelum itu
// booking baru "pending", belum pasti jadi, jadi belum dapat kode.
export const bookingCode = (id: string) => `BF-${id.slice(0, 4).toUpperCase()}`;

export const tanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function sisaMenit(createdAt: string): number {
  const lewat = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  return Math.max(0, Math.ceil(PROOF_DEADLINE_MIN - lewat));
}

// input file native dibungkus label bergaya tombol — tanpa library upload
export function UploadLabel({
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

export function BookingCard({
  booking: b,
  fieldName,
  uploading,
  onUpload,
  cancelling,
  onCancel,
}: {
  booking: BookingCardData;
  fieldName: string;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  cancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1 text-base">
          <div className="text-lg font-bold">{fieldName}</div>
          <div className="text-muted-foreground">
            {tanggal(b.bookingDate)} · {jam(b.startHour)}–
            {jam(b.startHour + b.durationHours)}
          </div>
          <div className="font-semibold text-primary">
            {rupiah.format(b.hargaSnapshot * b.durationHours)}
          </div>
          {(b.status === "confirmed" || b.status === "completed") && (
            <div className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-mono text-sm font-bold text-primary">
              {bookingCode(b.id)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          {b.status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={onCancel}
            >
              {cancelling ? "..." : "Batalkan"}
            </Button>
          )}
        </div>

        {b.status === "pending" && (
          <div className="w-full rounded-lg border bg-muted/50 p-4 text-sm">
            {b.proofUrl ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Bukti transfer terkirim ✓ — menunggu verifikasi admin. Kode
                  booking muncul di sini begitu disetujui.{" "}
                  <a
                    href={`/api/bookings/${b.id}/proof`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-semibold text-primary transition-all duration-200 hover:scale-105 hover:text-primary/80 active:scale-95"
                  >
                    Lihat bukti
                  </a>
                </span>
                <UploadLabel
                  uploading={uploading}
                  label="Ganti bukti"
                  onFile={onUpload}
                />
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  Bayar{" "}
                  <b>{rupiah.format(b.hargaSnapshot * b.durationHours)}</b>{" "}
                  lalu upload bukti dalam <b>{sisaMenit(b.createdAt)} menit</b>{" "}
                  — lewat dari itu booking hangus otomatis.
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aset statis satu-satunya, tak perlu optimasi next/image */}
                  <img
                    src="/qris.jpeg"
                    alt="QRIS — scan untuk bayar"
                    width={112}
                    height={158}
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
                  uploading={uploading}
                  label="Upload bukti pembayaran"
                  onFile={onUpload}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
