"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateChips } from "@/components/date-chips";
import { PROOF_DEADLINE_MIN, todayWIB } from "@/lib/constants";

type Slot = { hour: number; available: boolean };

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const jam = (h: number) => `${String(h).padStart(2, "0")}.00`;

export function BookingForm({
  fieldId,
  hargaPerJam,
}: {
  fieldId: string;
  hargaPerJam: number;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayWIB());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Penanda refetch manual (setelah 409) — slot juga otomatis dimuat ulang
  // saat tanggal berganti.
  const [slotsVersion, setSlotsVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setSlots(null);
      setStartHour(null);
      setDuration(1);
      const res = await fetch(`/api/fields/${fieldId}/availability?date=${date}`);
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok) {
        toast.error(data?.error ?? "Gagal memuat jadwal, coba lagi.");
        return;
      }
      setSlots(data.slots);
    })();
    return () => {
      ignore = true;
    };
  }, [fieldId, date, slotsVersion]);

  // durasi maksimal = slot kosong beruntun mulai dari jam terpilih
  const maxDuration = (() => {
    if (startHour === null || !slots) return 1;
    let d = 0;
    for (let h = startHour; slots.find((s) => s.hour === h)?.available; h++) d++;
    return d;
  })();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (startHour === null) return;
    setSubmitting(true);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldId,
        bookingDate: date,
        startHour,
        durationHours: duration,
        guestName,
        guestPhone,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.status === 409) {
      // slot barusan direbut orang — tampilkan pesan API lalu refresh grid
      toast.error(data?.error ?? "Jam tersebut sudah dibooking.");
      setSubmitting(false);
      setSlotsVersion((v) => v + 1);
      return;
    }
    if (!res.ok) {
      toast.error(data?.error ?? "Terjadi kesalahan, coba lagi.");
      setSubmitting(false);
      return;
    }

    toast.success(
      `Booking dibuat! Transfer & upload bukti dalam ${PROOF_DEADLINE_MIN} menit ya.`,
    );
    router.push(data.userId ? "/bookings" : `/bookings/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-base font-semibold">Tanggal</legend>
        <DateChips value={date} onChange={setDate} />
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-base font-semibold">Jam mulai</legend>
        {slots === null ? (
          <p className="text-base text-muted-foreground">Memuat jadwal...</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {slots.map((slot) => {
              const selected =
                startHour !== null &&
                slot.hour >= startHour &&
                slot.hour < startHour + duration;
              return (
                <Button
                  key={slot.hour}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className="h-12 text-base font-semibold transition-all not-disabled:hover:border-primary/50 disabled:bg-muted disabled:opacity-40"
                  disabled={!slot.available}
                  aria-pressed={selected}
                  onClick={() => {
                    setStartHour(slot.hour);
                    setDuration(1);
                  }}
                >
                  {jam(slot.hour)}
                </Button>
              );
            })}
          </div>
        )}
      </fieldset>

      {startHour !== null && (
        <div className="grid gap-2">
          <Label htmlFor="durasi" className="text-base font-semibold">
            Durasi
          </Label>
          <Select
            value={String(duration)}
            onValueChange={(v) => setDuration(Number(v))}
          >
            <SelectTrigger id="durasi" className="h-12 w-44 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxDuration }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} jam
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="guestName" className="text-base font-semibold">
            Nama
          </Label>
          <Input
            id="guestName"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Nama kamu"
            className="h-12 text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="guestPhone" className="text-base font-semibold">
            No. WhatsApp
          </Label>
          <Input
            id="guestPhone"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="08xx-xxxx-xxxx"
            className="h-12 text-base"
          />
        </div>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Sudah login? Boleh dikosongkan.
      </p>

      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="text-base">
          {startHour === null ? (
            <span className="text-muted-foreground">
              Pilih jam mulai dulu.
            </span>
          ) : (
            <>
              <div className="text-lg font-bold">
                {jam(startHour)}–{jam(startHour + duration)}
              </div>
              <div className="text-muted-foreground">
                {duration} jam × {rupiah.format(hargaPerJam)}
              </div>
            </>
          )}
        </div>
        <div className="text-2xl font-extrabold text-primary">
          {startHour === null ? "—" : rupiah.format(hargaPerJam * duration)}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-14 text-lg font-bold"
        disabled={startHour === null || submitting}
      >
        {submitting ? "Memproses..." : "Booking Sekarang"}
      </Button>
    </form>
  );
}
