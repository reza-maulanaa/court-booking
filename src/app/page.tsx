import type { Metadata } from "next";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, expireStaleBookings } from "@/db";
import { bookings, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { CLOSE_HOUR, OPEN_HOUR, nowHourWIB, todayWIB } from "@/lib/constants";
import { LandingNav } from "@/components/sections/landing-nav";
import { LandingHero } from "@/components/sections/landing-hero";
import { BookingSection } from "@/components/sections/booking-section";
import { FieldsSection } from "@/components/sections/fields-section";
import { FacilitiesSection } from "@/components/sections/facilities-section";
import { GallerySection } from "@/components/sections/gallery-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FaqSection } from "@/components/sections/faq-section";
import { LocationSection } from "@/components/sections/location-section";
import { LandingFooter } from "@/components/sections/landing-footer";

export const metadata: Metadata = {
  title: "Booking Futsal — Booking lapangan, langsung main",
};

// Selalu render per-request: chip "slot kosong hari ini" dan sesi login
// tidak boleh dibekukan saat build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const allFields = await db.query.fields.findMany({
    orderBy: (f, { asc }) => asc(f.name),
  });

  const session = await getSession();
  const user = session
    ? await db.query.users.findFirst({
        columns: { name: true },
        where: eq(users.id, session.sub),
      })
    : null;

  // Chip "N slot kosong" hari ini per lapangan — logika sama dengan
  // availability API: jam operasional − booking aktif − jam yang sudah lewat.
  await expireStaleBookings();
  const today = todayWIB();
  const nowHour = nowHourWIB();
  const bookedToday = allFields.length
    ? await db.query.bookings.findMany({
        columns: { fieldId: true, startHour: true, durationHours: true },
        where: and(
          inArray(
            bookings.fieldId,
            allFields.map((f) => f.id),
          ),
          eq(bookings.bookingDate, today),
          notInArray(bookings.status, ["cancelled", "expired"]),
        ),
      })
    : [];
  const freeToday = allFields.map((f) => {
    const taken = new Set<number>();
    for (const b of bookedToday)
      if (b.fieldId === f.id)
        for (let h = b.startHour; h < b.startHour + b.durationHours; h++)
          taken.add(h);
    let free = 0;
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++)
      if (!taken.has(h) && h > nowHour) free++;
    return free;
  });

  const fieldProps = allFields.map((f) => ({
    id: f.id,
    name: f.name,
    hargaPerJam: f.hargaPerJam,
  }));

  return (
    <div>
      <LandingNav
        isLoggedIn={session !== null}
        isAdmin={session?.role === "admin"}
        userName={user?.name ?? ""}
      />
      <LandingHero />
      <BookingSection
        fields={fieldProps}
        freeToday={freeToday}
        isLoggedIn={session !== null}
        userName={user?.name ?? ""}
      />
      <FieldsSection fields={fieldProps} />
      <FacilitiesSection />
      <GallerySection />
      <TestimonialsSection />
      <FaqSection />
      <LocationSection />
      <LandingFooter />
    </div>
  );
}
