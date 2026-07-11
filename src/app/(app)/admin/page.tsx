"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateChips } from "@/components/date-chips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type BookingStatus } from "@/components/status-badge";

type AdminBooking = {
  id: string;
  bookingDate: string;
  startHour: number;
  durationHours: number;
  hargaSnapshot: number;
  proofUrl: string | null;
  status: BookingStatus;
  userName: string;
  userEmail: string;
  fieldName: string;
};

type Field = { id: string; name: string };

// aksi yang ditawarkan per status = state machine versi tombol
const ACTIONS: Partial<
  Record<BookingStatus, { label: string; to: BookingStatus; variant: "default" | "outline" | "destructive" }[]>
> = {
  pending: [
    { label: "Konfirmasi", to: "confirmed", variant: "default" },
    { label: "Tolak", to: "cancelled", variant: "destructive" },
  ],
  confirmed: [
    { label: "Selesai", to: "completed", variant: "outline" },
    { label: "Batalkan", to: "cancelled", variant: "destructive" },
  ],
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const jam = (h: number) => `${String(h).padStart(2, "0")}.00`;

export default function AdminPage() {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [date, setDate] = useState("");
  const [fieldId, setFieldId] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (fieldId !== "all") params.set("fieldId", fieldId);
    const res = await fetch(`/api/admin/bookings?${params}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal memuat data.");
      return;
    }
    setBookings(data);
  }, [date, fieldId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    fetch("/api/fields")
      .then((r) => r.json())
      .then(setAllFields)
      .catch(() => {});
  }, []);

  async function transition(id: string, to: BookingStatus, label: string) {
    setBusy(id);
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) toast.error(data?.error ?? `Gagal ${label.toLowerCase()}.`);
    else toast.success(`${label} berhasil.`);
    setBusy(null);
    load();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
        Dashboard Admin
      </h1>

      <div className="mb-6 grid gap-4">
        <div className="grid gap-2">
          <span className="text-sm font-medium">Tanggal</span>
          <DateChips value={date} onChange={setDate} withAll />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-lapangan">Lapangan</Label>
          <Select value={fieldId} onValueChange={setFieldId}>
            <SelectTrigger id="filter-lapangan" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua lapangan</SelectItem>
              {allFields.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {bookings === null ? (
        <p className="text-base text-muted-foreground">Memuat...</p>
      ) : bookings.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Tidak ada booking untuk filter ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jam</TableHead>
                <TableHead>Lapangan</TableHead>
                <TableHead>Pemesan</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Bukti</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.bookingDate}</TableCell>
                  <TableCell>
                    {jam(b.startHour)}–{jam(b.startHour + b.durationHours)}
                  </TableCell>
                  <TableCell>{b.fieldName}</TableCell>
                  <TableCell>
                    <div className="font-medium">{b.userName}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.userEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rupiah.format(b.hargaSnapshot * b.durationHours)}
                  </TableCell>
                  <TableCell>
                    {b.proofUrl ? (
                      <a
                        href={`/api/bookings/${b.id}/proof`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Lihat
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {(ACTIONS[b.status] ?? []).map((a) => (
                        <Button
                          key={a.to}
                          size="sm"
                          variant={a.variant}
                          disabled={busy === b.id}
                          onClick={() => transition(b.id, a.to, a.label)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
