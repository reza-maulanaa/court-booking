"use client";

import { useState } from "react";
import { SectionHeading } from "./section-heading";
import { PROOF_DEADLINE_MIN } from "@/lib/constants";

const FAQS = [
  {
    q: "Bagaimana cara booking lapangan?",
    a: "Pilih lapangan, tanggal, dan jam di form booking, isi nama dan nomor WhatsApp, lalu pilih metode pembayaran. Kode booking langsung terbit dan konfirmasi dikirim ke WhatsApp kamu.",
  },
  {
    q: "Apakah bisa membatalkan atau mengubah jadwal?",
    a: "Bisa, maksimal 6 jam sebelum jadwal main via WhatsApp. Reschedule gratis 1x; pembatalan setelah bayar dikenakan potongan 20%.",
  },
  {
    q: "Apakah harga malam berbeda?",
    a: "Tidak — harga rata Rp 50.000/jam untuk semua jam dan semua lapangan, setiap hari termasuk weekend.",
  },
  {
    q: "Apakah menyediakan sewa perlengkapan?",
    a: "Ya. Rompi 2 set (gratis), bola (gratis), dan sepatu futsal berbagai ukuran (Rp 10.000/pasang) tersedia di front desk.",
  },
  {
    q: "Berapa lama slot ditahan sebelum dibayar?",
    a: `Untuk QRIS dan transfer, slot ditahan ${PROOF_DEADLINE_MIN} menit setelah booking. Untuk bayar di tempat, slot langsung terkunci dengan kode booking.`,
  },
];

export function FaqSection() {
  const [open, setOpen] = useState(0);

  return (
    <div id="faq" className="scroll-mt-16 bg-tf-mist px-4 py-12 md:px-14 md:py-16">
      <SectionHeading kicker="FAQ" title="Sering ditanyakan" />
      <div className="flex max-w-[820px] flex-col gap-2.5">
        {FAQS.map((f, i) => {
          const isOpen = i === open;
          return (
            <div
              key={f.q}
              className="overflow-hidden rounded-xl border border-tf-ink/10 bg-white"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-[22px] py-[18px] text-left transition-colors duration-200 hover:bg-tf-mist active:scale-[0.99]"
              >
                <span className="text-base font-bold text-tf-ink">{f.q}</span>
                <span
                  aria-hidden
                  className={`font-barlow-condensed text-[22px] font-extrabold text-tf-green transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <p className="px-[22px] pb-[18px] text-sm leading-[1.65] text-tf-muted">
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
