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
      <a href="#" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <span className="grid size-[34px] place-items-center rounded-lg bg-tf-green font-barlow-condensed text-lg font-extrabold italic text-tf-lime sm:size-[38px]">
          TF
        </span>
        <span className="font-barlow-condensed text-lg font-extrabold whitespace-nowrap uppercase tracking-[0.5px] text-tf-ink sm:text-[22px]">
          Tanjung <span className="text-tf-green">Futsal</span>
        </span>
      </a>

      <div className="hidden gap-7 text-sm font-semibold md:flex">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-tf-ink hover:text-tf-green"
          >
            {l.label}
          </a>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-4 text-sm font-semibold md:flex">
          {isLoggedIn ? (
            <>
              <Link
                href="/bookings"
                className="text-tf-ink hover:text-tf-green"
              >
                Booking Saya
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-tf-ink hover:text-tf-green"
                >
                  Admin
                </Link>
              )}
              {userName && (
                <span className="hidden max-w-28 truncate text-tf-muted lg:inline">
                  {userName}
                </span>
              )}
              <LandingLogoutLink />
            </>
          ) : (
            <Link href="/login" className="text-tf-ink hover:text-tf-green">
              Masuk
            </Link>
          )}
        </div>

        <Link
          href={mobileHref}
          aria-label={mobileLabel}
          title={mobileLabel}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-tf-ink/15 text-tf-ink hover:border-tf-green hover:text-tf-green md:hidden"
        >
          <MobileIcon className="size-4" aria-hidden />
        </Link>

        <a
          href="#booking"
          className="shrink-0 rounded-lg bg-tf-green px-4 py-2.5 text-[13px] font-bold whitespace-nowrap text-white hover:bg-tf-green-deep sm:px-[22px] sm:py-[11px] sm:text-sm"
        >
          Booking Sekarang
        </a>
      </div>
    </div>
  );
}
