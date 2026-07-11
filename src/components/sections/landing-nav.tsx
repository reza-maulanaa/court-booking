import Link from "next/link";
import { CalendarCheck, LogIn, Shield } from "lucide-react";
import { LandingLogoutLink } from "./landing-logout-link";

const LINKS = [
  { label: "Lapangan", href: "#lapangan" },
  { label: "Fasilitas", href: "#fasilitas" },
  { label: "Galeri", href: "#galeri" },
  { label: "FAQ", href: "#faq" },
  { label: "Lokasi", href: "#lokasi" },
];

export function LandingNav({
  isLoggedIn,
  isAdmin,
  userName,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  userName: string;
}) {
  // Mobile: satu ikon ringkas ke tujuan akun paling relevan — dari sana
  // navbar halaman (app) (route lama) sudah punya link lengkap (Booking
  // Saya, Admin, Keluar), jadi tidak perlu semuanya muat di sini.
  const mobileHref = !isLoggedIn ? "/login" : isAdmin ? "/admin" : "/bookings";
  const mobileLabel = !isLoggedIn ? "Masuk" : isAdmin ? "Admin" : "Booking saya";
  const MobileIcon = !isLoggedIn ? LogIn : isAdmin ? Shield : CalendarCheck;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-tf-ink/10 bg-white px-4 py-4 md:px-14">
      <a
        href="#"
        className="flex shrink-0 items-center transition-transform duration-200 hover:scale-[1.03] active:scale-95"
      >
        <span className="font-barlow-condensed text-xl font-extrabold whitespace-nowrap uppercase tracking-[0.5px] text-tf-ink sm:text-2xl sm:tracking-wide lg:text-[28px]">
          Booking <span className="text-tf-green">Futsal</span>
        </span>
      </a>

      <div className="hidden gap-5 text-sm font-bold md:flex lg:gap-7 lg:text-base">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-tf-ink transition-all duration-200 hover:scale-105 hover:text-tf-green active:scale-95"
          >
            {l.label}
          </a>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-3 text-sm font-bold md:flex lg:gap-4 lg:text-base">
          {isLoggedIn ? (
            <>
              <Link
                href="/bookings"
                className="text-tf-ink transition-all duration-200 hover:scale-105 hover:text-tf-green active:scale-95"
              >
                Booking Saya
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-tf-ink transition-all duration-200 hover:scale-105 hover:text-tf-green active:scale-95"
                >
                  Admin
                </Link>
              )}
              {userName && (
                <span className="hidden max-w-28 truncate text-sm font-semibold text-tf-muted lg:inline">
                  {userName}
                </span>
              )}
              <LandingLogoutLink />
            </>
          ) : (
            <Link
              href="/login"
              className="text-tf-ink transition-all duration-200 hover:scale-105 hover:text-tf-green active:scale-95"
            >
              Masuk
            </Link>
          )}
        </div>

        <Link
          href={mobileHref}
          aria-label={mobileLabel}
          title={mobileLabel}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-tf-ink/15 text-tf-ink transition-all duration-200 hover:scale-110 hover:border-tf-green hover:text-tf-green active:scale-90 md:hidden"
        >
          <MobileIcon className="size-4" aria-hidden />
        </Link>

        <a
          href="#booking"
          className="shrink-0 rounded-lg bg-tf-green px-4 py-2.5 text-[13px] font-bold whitespace-nowrap text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-tf-green-deep hover:shadow-lg hover:shadow-tf-green/30 active:translate-y-0 active:scale-95 sm:px-[22px] sm:py-[11px] sm:text-sm"
        >
          Booking Sekarang
        </a>
      </div>
    </div>
  );
}
