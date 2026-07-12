import Link from "next/link";
import { Goal, Shield, CalendarCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

export async function Navbar() {
  const session = await getSession();
  const user = session
    ? await db.query.users.findFirst({
        columns: { name: true },
        where: eq(users.id, session.sub),
      })
    : null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
        >
          <Goal className="size-6 text-primary sm:size-7" aria-hidden />
          <span className="font-heading text-xl font-extrabold whitespace-nowrap uppercase tracking-wide text-foreground sm:text-2xl">
            Booking <span className="text-primary">Futsal</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {session ? (
            <>
              {session.role === "admin" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin" className="gap-1.5">
                    <Shield className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/bookings" className="gap-1.5">
                  <CalendarCheck className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Booking Saya</span>
                </Link>
              </Button>
              <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">
                {user?.name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">Masuk</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
