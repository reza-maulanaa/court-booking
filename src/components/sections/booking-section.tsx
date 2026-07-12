"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { SectionHeading } from "./section-heading";
import { fmtRp } from "@/lib/format";
import {
  MAX_PROOF_MB,
  PROOF_DEADLINE_MIN,
  TRANSFER_INFO,
  todayWIB,
} from "@/lib/constants";

type Slot = { hour: number; available: boolean };

export type BookingField = {
  id: string;
  name: string;
  hargaPerJam: number;
};

// ponytail: deskripsi kartu pilihan di-hardcode per urutan lapangan (A, B) —
// pindah ke kolom DB kalau lapangan jadi dinamis/dikelola admin.
const FIELD_DESC = ["Rumput sintetis · 25×15 m", "Vinyl interlock · 25×15 m"];

const STEPS = [
  { n: 1, label: "Pilih Jadwal" },
  { n: 2, label: "Data Pemesan" },
  { n: 3, label: "Pembayaran" },
  { n: 4, label: "Bukti Pembayaran" },
];

const PAY_OPTIONS = [
  {
    id: "qris",
    label: "QRIS",
    desc: "Scan & bayar instan — semua e-wallet dan m-banking",
  },
  {
    id: "transfer",
    label: "Transfer Bank",
    desc: "BCA / Mandiri / BRI — instruksi dikirim via WhatsApp",
  },
  {
    id: "cash",
    label: "Bayar di Tempat",
    desc: "DP tidak diperlukan, bayar penuh saat datang",
  },
] as const;

const PICK_FIELD_EVENT = "tf:pick-field";

// Tombol "Booking Lapangan X" di section Lapangan & Harga: lompat ke #booking
// sekaligus memilihkan lapangannya di form (state lintas section via event —
// dua section ini server/client island terpisah, tanpa context bersama).
export function BookFieldButton({
  fieldId,
  children,
}: {
  fieldId: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#booking"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(PICK_FIELD_EVENT, { detail: fieldId }),
        )
      }
      className="inline-block rounded-[9px] bg-tf-green px-[22px] py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95"
    >
      {children}
    </a>
  );
}

// input file native dibungkus label bergaya tombol — pola sama dengan
// UploadLabel di halaman "Booking Saya", cuma di-restyle ke token tf-*.
function ProofUploadLabel({
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
      className={`inline-flex w-fit items-center justify-center rounded-[10px] px-6 py-3 text-sm font-bold text-white transition-all duration-200 ${
        uploading
          ? "cursor-not-allowed bg-tf-disabled"
          : "cursor-pointer bg-tf-green hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95"
      }`}
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

const pad = (h: number) => String(h).padStart(2, "0");

// 7 hari ke depan (basis WIB, sinkron dengan validator backend)
function dateOptions() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${todayWIB()}T00:00:00`);
    d.setDate(d.getDate() + i);
    const day = d.toLocaleDateString("id-ID", { weekday: "short" });
    const month = d.toLocaleDateString("id-ID", { month: "short" });
    return {
      iso: d.toLocaleDateString("en-CA"),
      day: i === 0 ? "Hari ini" : day,
      label: `${d.getDate()} ${month}`,
      full: `${day}, ${d.getDate()} ${month} ${d.getFullYear()}`,
    };
  });
}

export function BookingSection({
  fields,
  freeToday,
  isLoggedIn,
  userName,
}: {
  fields: BookingField[];
  freeToday: number[];
  isLoggedIn: boolean;
  userName: string;
}) {
  const router = useRouter();
  const dates = useMemo(() => dateOptions(), []);

  const [step, setStep] = useState(1);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [dateIdx, setDateIdx] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<(typeof PAY_OPTIONS)[number]["id"]>("qris");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    summary: string;
    ids: string[];
  } | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  // Penanda refetch manual (setelah 409 / booking sukses) — slot juga
  // otomatis dimuat ulang saat lapangan/tanggal berganti.
  const [slotsVersion, setSlotsVersion] = useState(0);

  // Tinggi tiap langkah beda jauh (step 1 penuh grid jam, step 2 cuma form
  // pendek) — tanpa ini, scrollY yang sama membuat viewport "kelempar" ke
  // konten section berikutnya begitu step berganti jadi lebih pendek.
  const cardRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(true);

  const field = fields[fieldIdx];
  const fieldId = field?.id;

  useEffect(() => {
    if (!fieldId) return;
    let ignore = false;
    (async () => {
      const res = await fetch(
        `/api/fields/${fieldId}/availability?date=${dates[dateIdx].iso}`,
      );
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
  }, [fieldId, dates, dateIdx, slotsVersion]);

  function refreshSlots() {
    setSlots(null);
    setSlotsVersion((v) => v + 1);
  }

  // Dengar tombol "Booking Lapangan X" dari section Lapangan & Harga.
  useEffect(() => {
    function onPick(e: Event) {
      const idx = fields.findIndex(
        (f) => f.id === (e as CustomEvent<string>).detail,
      );
      if (idx === -1) return;
      setFieldIdx(idx);
      setSelected(new Set());
      setStep(1);
      setDone(null);
    }
    window.addEventListener(PICK_FIELD_EVENT, onPick);
    return () => window.removeEventListener(PICK_FIELD_EVENT, onPick);
  }, [fields]);

  useEffect(() => {
    if (skipScrollRef.current) {
      // Lewati saat mount pertama — jangan auto-scroll ke #booking saat
      // halaman baru dibuka.
      skipScrollRef.current = false;
      return;
    }
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    cardRef.current?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  }, [step, done]);

  const selHours = [...selected].sort((a, b) => a - b);
  const nSel = selHours.length;
  const total = nSel * (field?.hargaPerJam ?? 0);
  const timesLabel = selHours.map((h) => `${pad(h)}:00`).join(", ");
  const canNext1 = nSel > 0;
  const canNext2 = name.trim() !== "" && phone.trim() !== "";
  const pickSummary = `${field?.name} · ${dates[dateIdx].full} · ${timesLabel} · ${fmtRp(total)}`;

  function toggleHour(h: number) {
    const next = new Set(selected);
    if (next.has(h)) next.delete(h);
    else next.add(h);
    setSelected(next);
  }

  function resetBooking() {
    setStep(1);
    setSelected(new Set());
    setName(userName);
    setPhone("");
    setNotes("");
    setPay("qris");
    setDone(null);
    setProofUploading(false);
    setProofDone(false);
    refreshSlots();
  }

  async function uploadProof(file: File | undefined) {
    if (!file || !done) return;
    if (file.size > MAX_PROOF_MB * 1024 * 1024) {
      toast.error(`Ukuran maksimal ${MAX_PROOF_MB}MB — kirim screenshot saja.`);
      return;
    }
    setProofUploading(true);
    let anyOk = false;
    let lastError: string | null = null;
    // Jam yang dipilih bisa loncat → beberapa booking terpisah dibuat
    // sekaligus (lihat confirmBooking). Bukti yang sama dikirim ke semuanya.
    for (const id of done.ids) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bookings/${id}/proof`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) anyOk = true;
      else lastError = data?.error ?? "Upload gagal, coba lagi.";
    }
    setProofUploading(false);
    if (anyOk) {
      setProofDone(true);
      toast.success("Bukti terkirim! Menunggu verifikasi admin.");
    } else {
      toast.error(lastError ?? "Upload gagal, coba lagi.");
    }
  }

  async function confirmBooking() {
    if (done || submitting || !field) return;
    if (!isLoggedIn) {
      toast.error("Silakan login dulu untuk booking.");
      router.push("/login");
      return;
    }
    setSubmitting(true);

    // Backend: satu booking = satu rentang kontinu (startHour + durationHours).
    // Jam pilihan yang loncat dipecah jadi beberapa booking.
    const runs: { startHour: number; durationHours: number }[] = [];
    for (const h of selHours) {
      const last = runs[runs.length - 1];
      if (last && last.startHour + last.durationHours === h)
        last.durationHours++;
      else runs.push({ startHour: h, durationHours: 1 });
    }

    const created: { id: string }[] = [];
    const createdHours: number[] = [];
    let failedError: string | null = null;
    for (const run of runs) {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: field.id,
          bookingDate: dates[dateIdx].iso,
          ...run,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        toast.error("Silakan login dulu untuk booking.");
        router.push("/login");
        return;
      }
      if (!res.ok) {
        failedError = data?.error ?? "Terjadi kesalahan, coba lagi.";
        break;
      }
      created.push(data);
      for (let h = run.startHour; h < run.startHour + run.durationHours; h++)
        createdHours.push(h);
    }

    setSubmitting(false);

    if (created.length === 0) {
      // Slot barusan direbut orang — tampilkan pesan API, refresh grid,
      // kembali ke langkah pilih jam.
      toast.error(failedError ?? "Terjadi kesalahan, coba lagi.");
      setSelected(new Set());
      setStep(1);
      refreshSlots();
      return;
    }

    if (failedError)
      toast.error(`Sebagian jam gagal dibooking: ${failedError}`);
    else
      toast.success(
        `Booking dibuat! Transfer & upload bukti dalam ${PROOF_DEADLINE_MIN} menit ya.`,
      );

    setDone({
      summary: `${field.name} · ${dates[dateIdx].full} · ${createdHours
        .map((h) => `${pad(h)}:00`)
        .join(", ")}`,
      ids: created.map((c) => c.id),
    });
    setStep(4);
  }

  return (
    <div id="booking" className="scroll-mt-16 bg-tf-mist px-4 py-12 md:px-14 md:py-16">
      <div className="mb-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <SectionHeading
            kicker="Booking Online"
            title="Pilih jadwal, kunci lapanganmu"
            spaced={false}
          />
        </div>
        <div className="flex flex-wrap gap-2.5">
          {fields.map((f, i) => (
            <div
              key={f.id}
              className="rounded-[10px] border border-tf-ink/10 bg-white px-4 py-2.5 text-[13px] font-medium text-tf-muted"
            >
              {i === 0 ? "Hari ini · " : ""}
              {f.name}:{" "}
              <strong className="font-bold text-tf-green">
                {freeToday[i] ?? 0} slot kosong
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="my-5 mb-6 flex flex-wrap gap-2">
        {STEPS.map((st) => {
          const active = st.n === step;
          const past = st.n < step;
          return (
            <div
              key={st.n}
              className={`flex items-center gap-[9px] rounded-full border py-2 pr-4 pl-2 ${
                active
                  ? "border-tf-green bg-tf-pale"
                  : "border-tf-ink/12 bg-white"
              }`}
            >
              <span
                className={`grid size-[26px] place-items-center rounded-full text-[13px] font-bold ${
                  active || past
                    ? "bg-tf-green text-white"
                    : "bg-tf-fog text-tf-muted"
                }`}
              >
                {st.n}
              </span>
              <span
                className={`text-sm font-semibold ${
                  active ? "text-tf-green-deep" : "text-tf-muted"
                }`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={cardRef}
        className="scroll-mt-20 rounded-2xl border border-tf-ink/10 bg-white p-5 shadow-[0_2px_10px_rgba(18,36,26,.05)] md:p-8"
      >
        {step === 1 && (
          <>
            <div className="mb-3 text-[15px] font-bold text-tf-ink">
              1. Pilih lapangan
            </div>
            <div className="mb-[26px] flex flex-col gap-3.5 sm:flex-row">
              {fields.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={i === fieldIdx}
                  onClick={() => {
                    setFieldIdx(i);
                    setSelected(new Set());
                    if (i !== fieldIdx) setSlots(null);
                  }}
                  className={`flex flex-1 cursor-pointer items-center justify-between rounded-xl border-2 px-[18px] py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
                    i === fieldIdx
                      ? "border-tf-green bg-tf-pale"
                      : "border-tf-ink/18 bg-white"
                  }`}
                >
                  <span>
                    <span className="block font-barlow-condensed text-xl font-extrabold uppercase text-tf-ink">
                      {f.name}
                    </span>
                    <span className="block text-[13px] text-tf-muted">
                      {FIELD_DESC[i] ?? ""}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-tf-green">
                    {fmtRp(f.hargaPerJam)}/jam
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-3 text-[15px] font-bold text-tf-ink">
              2. Pilih tanggal
            </div>
            <div className="mb-[26px] grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dates.map((d, i) => {
                const active = i === dateIdx;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDateIdx(i);
                      setSelected(new Set());
                      if (i !== dateIdx) setSlots(null);
                    }}
                    className={`cursor-pointer rounded-[10px] border-2 py-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95 ${
                      active
                        ? "border-tf-green bg-tf-pale"
                        : "border-tf-ink/18 bg-white"
                    }`}
                  >
                    <span
                      className={`block text-xs font-semibold uppercase tracking-[1px] ${
                        active ? "text-tf-green" : "text-tf-muted"
                      }`}
                    >
                      {d.day}
                    </span>
                    <span
                      className={`block font-barlow-condensed text-xl font-extrabold ${
                        active ? "text-tf-green" : "text-tf-ink"
                      }`}
                    >
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[15px] font-bold text-tf-ink">
                3. Pilih jam (boleh lebih dari satu)
              </div>
              <div className="flex gap-4 text-xs font-medium text-tf-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] border-[1.5px] border-tf-ink/25 bg-white" />
                  Kosong
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-tf-green" />
                  Dipilih
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-tf-fog" />
                  Terisi
                </span>
              </div>
            </div>
            {slots === null ? (
              <p className="mb-6 text-sm text-tf-muted">Memuat jadwal...</p>
            ) : (
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
                {slots.map((s) => {
                  const sel = selected.has(s.hour);
                  return (
                    <button
                      key={s.hour}
                      type="button"
                      disabled={!s.available}
                      aria-pressed={sel}
                      onClick={() => toggleHour(s.hour)}
                      className={`rounded-[10px] border-2 py-[13px] text-center text-[15px] font-bold transition-all duration-150 ${
                        sel
                          ? "cursor-pointer border-tf-green bg-tf-green text-white hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95"
                          : s.available
                            ? "cursor-pointer border-tf-ink/18 bg-white text-tf-ink hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95"
                            : "cursor-not-allowed border-tf-fog bg-tf-fog text-tf-slot-muted line-through"
                      }`}
                    >
                      {pad(s.hour)}:00 – {pad(s.hour + 1)}:00
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col justify-between gap-4 rounded-xl bg-tf-mist px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="text-[13px] font-medium text-tf-muted">
                  {nSel === 0
                    ? "Belum ada jam dipilih"
                    : `${nSel} jam dipilih · ${timesLabel}`}
                </div>
                <div className="font-barlow-condensed text-[26px] font-extrabold text-tf-ink">
                  Total: {fmtRp(total)}
                </div>
              </div>
              <button
                type="button"
                disabled={!canNext1}
                onClick={() => setStep(2)}
                className={`rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-white transition-all duration-200 ${
                  canNext1
                    ? "cursor-pointer bg-tf-green hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95"
                    : "cursor-not-allowed bg-tf-disabled"
                }`}
              >
                Lanjut — Data Pemesan →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-6 inline-flex gap-2 rounded-full border border-tf-green/20 bg-tf-pale px-4 py-2 text-[13px] font-semibold text-tf-green-deep">
              {pickSummary}
            </div>
            <div className="mb-[18px] grid gap-[18px] md:grid-cols-2">
              <div>
                <label
                  htmlFor="tf-name"
                  className="mb-[7px] block text-[13px] font-semibold text-tf-ink"
                >
                  Nama lengkap
                </label>
                <input
                  id="tf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Andi Saputra"
                  className="w-full rounded-[10px] border-[1.5px] border-tf-ink/18 px-[15px] py-[13px] text-[15px] font-medium text-tf-ink outline-none focus:border-tf-green"
                />
              </div>
              <div>
                <label
                  htmlFor="tf-phone"
                  className="mb-[7px] block text-[13px] font-semibold text-tf-ink"
                >
                  No. WhatsApp
                </label>
                <input
                  id="tf-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="cth: 0812-3456-7890"
                  className="w-full rounded-[10px] border-[1.5px] border-tf-ink/18 px-[15px] py-[13px] text-[15px] font-medium text-tf-ink outline-none focus:border-tf-green"
                />
              </div>
            </div>
            <div className="mb-[26px]">
              <label
                htmlFor="tf-notes"
                className="mb-[7px] block text-[13px] font-semibold text-tf-ink"
              >
                Catatan (opsional)
              </label>
              <textarea
                id="tf-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="cth: sewa rompi 2 set"
                className="min-h-20 w-full resize-y rounded-[10px] border-[1.5px] border-tf-ink/18 px-[15px] py-[13px] text-[15px] font-medium text-tf-ink outline-none focus:border-tf-green"
              />
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="cursor-pointer rounded-[10px] border-[1.5px] border-tf-ink/20 px-6 py-3.5 text-[15px] font-semibold text-tf-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-tf-green hover:text-tf-green active:translate-y-0 active:scale-95"
              >
                ← Kembali
              </button>
              <button
                type="button"
                disabled={!canNext2}
                onClick={() => setStep(3)}
                className={`rounded-[10px] px-7 py-3.5 text-[15px] font-bold text-white transition-all duration-200 ${
                  canNext2
                    ? "cursor-pointer bg-tf-green hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95"
                    : "cursor-not-allowed bg-tf-disabled"
                }`}
              >
                Lanjut — Pembayaran →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="grid gap-7 md:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="mb-3 text-[15px] font-bold text-tf-ink">
                Ringkasan booking
              </div>
              <div className="flex flex-col gap-2.5 rounded-xl bg-tf-mist px-[22px] py-5">
                {(
                  [
                    ["Lapangan", field?.name ?? "—"],
                    ["Tanggal", dates[dateIdx].full],
                    ["Jam", `${timesLabel} (${nSel} jam)`],
                    ["Pemesan", name || "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-4 text-sm font-medium text-tf-muted"
                  >
                    <span>{k}</span>
                    <strong className="text-right font-bold text-tf-ink">
                      {v}
                    </strong>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-dashed border-tf-ink/20 pt-3 text-[15px] font-bold text-tf-ink">
                  <span>Total</span>
                  <span className="font-barlow-condensed text-2xl font-extrabold text-tf-green">
                    {fmtRp(total)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[15px] font-bold text-tf-ink">
                Metode pembayaran
              </div>
              <div className="mb-5 flex flex-col gap-2.5">
                {PAY_OPTIONS.map((p) => {
                  const active = p.id === pay;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPay(p.id)}
                      className={`flex cursor-pointer items-center gap-3 rounded-[11px] border-2 px-4 py-[13px] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98] ${
                        active
                          ? "border-tf-green bg-tf-pale"
                          : "border-tf-ink/18 bg-white"
                      }`}
                    >
                      <span
                        className={`grid size-[18px] flex-none place-items-center rounded-full border-2 ${
                          active ? "border-tf-green" : "border-tf-ink/30"
                        }`}
                      >
                        <span
                          className={`size-[9px] rounded-full ${
                            active ? "bg-tf-green" : "bg-transparent"
                          }`}
                        />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-tf-ink">
                          {p.label}
                        </span>
                        <span className="block text-xs text-tf-muted">
                          {p.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmBooking}
                className="w-full cursor-pointer rounded-[10px] bg-tf-green py-[15px] text-center text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-tf-disabled disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100"
              >
                {submitting ? "Memproses..." : "Konfirmasi Booking"}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full cursor-pointer py-3 text-center text-[13px] font-semibold text-tf-muted transition-all duration-200 hover:text-tf-ink active:scale-95"
              >
                ← Kembali ke data pemesan
              </button>
            </div>
          </div>
        )}

        {step === 4 && done && (
          <div className="pt-7 pb-3">
            <div className="text-center">
              <div className="mx-auto mb-[18px] grid size-[72px] place-items-center rounded-full border-2 border-tf-green bg-tf-pale font-barlow-condensed text-[34px] font-extrabold text-tf-green">
                {proofDone ? "⏳" : "🔒"}
              </div>
              <div className="font-barlow-condensed text-[32px] font-extrabold italic uppercase text-tf-ink">
                {proofDone
                  ? "Menunggu Verifikasi Admin"
                  : "Slot Dikunci — Lanjutkan Pembayaran"}
              </div>
              <div className="mt-2.5 mb-[8px] text-[15px] text-tf-muted">
                {done.summary}
              </div>
              {proofDone && (
                <p className="mx-auto mt-2 mb-[8px] max-w-md text-sm text-tf-muted">
                  Bukti sudah terkirim. Admin akan mencocokkan dengan mutasi
                  rekening — kode booking &amp; konfirmasi final muncul di
                  halaman <strong className="text-tf-ink">Booking Saya</strong>{" "}
                  begitu disetujui. Kalau ditolak, booking otomatis batal dan
                  slotnya lepas.
                </p>
              )}
            </div>

            {!proofDone && (
              <div className="mx-auto mt-8 max-w-md rounded-xl bg-tf-mist px-5 py-5 sm:px-7 sm:py-6">
                <div className="mb-3 text-[15px] font-bold text-tf-ink">
                  4. Upload bukti pembayaran
                </div>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-tf-muted">
                    Bayar{" "}
                    <strong className="font-bold text-tf-ink">
                      {fmtRp(total)}
                    </strong>{" "}
                    lalu upload screenshot bukti dalam{" "}
                    <strong className="font-bold text-tf-ink">
                      {PROOF_DEADLINE_MIN} menit
                    </strong>{" "}
                    — lewat dari itu booking hangus otomatis. Slot baru pasti
                    jadi milikmu setelah admin memverifikasi buktinya.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aset statis, tak perlu optimasi next/image */}
                    <img
                      src="/qris.jpeg"
                      alt="QRIS — scan untuk bayar"
                      width={112}
                      height={158}
                      className="rounded-md border border-tf-ink/10"
                    />
                    <div className="grid gap-1 text-sm">
                      <div className="font-bold text-tf-ink">Scan QRIS</div>
                      <div className="text-tf-muted">atau transfer bank:</div>
                      <div className="text-tf-ink">
                        <strong className="font-bold">
                          {TRANSFER_INFO.bank} {TRANSFER_INFO.norek}
                        </strong>
                        <br />
                        a.n. {TRANSFER_INFO.atasNama}
                      </div>
                    </div>
                  </div>
                  <ProofUploadLabel
                    uploading={proofUploading}
                    label="Upload bukti pembayaran"
                    onFile={uploadProof}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-2 text-center">
              <Link
                href="/bookings"
                className="inline-block cursor-pointer rounded-[10px] bg-tf-green px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95"
              >
                {proofDone ? "Lihat Status Booking →" : "Lanjutkan nanti di Booking Saya →"}
              </Link>
              <button
                type="button"
                onClick={resetBooking}
                className="inline-block cursor-pointer py-2 text-center text-[13px] font-semibold text-tf-muted transition-all duration-200 hover:text-tf-ink active:scale-95"
              >
                Buat booking lain
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
