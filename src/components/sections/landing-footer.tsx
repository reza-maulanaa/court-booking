const LINKS = [
  { label: "Booking", href: "#booking" },
  { label: "Harga", href: "#lapangan" },
  { label: "FAQ", href: "#faq" },
  { label: "Lokasi", href: "#lokasi" },
];

export function LandingFooter() {
  return (
    <footer className="flex flex-col items-center justify-between gap-5 bg-tf-ink px-4 py-9 md:flex-row md:px-14">
      <div className="flex items-center">
        <span className="font-barlow-condensed text-2xl font-extrabold uppercase tracking-wide text-white">
          Booking Futsal
        </span>
      </div>
      <div className="flex gap-6 text-[15px] font-bold">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-tf-sage transition-all duration-200 hover:scale-105 hover:text-white active:scale-95"
          >
            {l.label}
          </a>
        ))}
      </div>
      <div className="text-sm text-tf-muted">© 2026 Booking Futsal</div>
    </footer>
  );
}
