import Image from "next/image";

const STATS = [
  { value: "2", label: "Lapangan indoor" },
  { value: "15 jam", label: "Operasional / hari" },
  { value: "Rp 50rb", label: "Per jam, semua slot" },
];

export function LandingHero() {
  return (
    <div className="relative flex min-h-[88svh] items-center overflow-hidden bg-tf-forest md:min-h-svh">
      <Image
        src="/court.jpg"
        alt="Lapangan Booking Futsal"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-[.38]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,#08301df2_30%,#08301d80_70%,#0e7b4540)]" />
      <div className="relative w-full max-w-[760px] px-5 py-16 md:px-14 md:pt-[88px] md:pb-[72px]">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-tf-lime/40 bg-tf-lime/13 px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[2px] text-tf-lime sm:text-xs">
          <span className="size-[7px] rounded-full bg-tf-lime" />
          Buka setiap hari · 08.00–23.00
        </p>
        <h1 className="font-barlow-condensed text-[clamp(2.5rem,11vw,5.25rem)] leading-[0.95] font-extrabold italic uppercase tracking-[0.5px] text-white">
          Booking lapangan,
          <br />
          <span className="text-tf-lime">langsung main.</span>
        </h1>
        <p className="mt-5 mb-8 max-w-[520px] text-base leading-[1.6] text-tf-cloud sm:text-lg">
          Pilih jadwal, isi data, bayar — selesai dalam 1 menit. Dua lapangan
          indoor rumput sintetis di pusat kota, mulai{" "}
          <strong className="text-white">Rp 50.000/jam</strong>.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href="#booking"
            className="rounded-[10px] bg-tf-lime px-[30px] py-[15px] text-center text-base font-bold text-tf-ink hover:bg-tf-lime-bright"
          >
            Booking Sekarang
          </a>
          <a
            href="#lapangan"
            className="rounded-[10px] border-[1.5px] border-white/33 px-[26px] py-3.5 text-center text-base font-semibold text-white hover:border-white"
          >
            Lihat Lapangan &amp; Harga
          </a>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-x-4 gap-y-6 sm:mt-12 sm:flex sm:gap-10">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-barlow-condensed text-[clamp(1.75rem,7vw,2.125rem)] font-extrabold text-white">
                {s.value}
              </div>
              <div className="text-[13px] font-medium text-tf-sage">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
