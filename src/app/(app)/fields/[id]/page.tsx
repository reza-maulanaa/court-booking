import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fields } from "@/db/schema";
import { BookingForm } from "@/components/booking-form";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default async function FieldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const field = await db.query.fields.findFirst({ where: eq(fields.id, id) });
  if (!field) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <div className="mb-8 rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-6">
        <h1 className="font-heading text-3xl font-extrabold tracking-wide uppercase italic md:text-4xl">
          {field.name}
        </h1>
        <p className="mt-1 text-base text-muted-foreground md:text-lg">
          <span className="text-xl font-bold text-primary md:text-2xl">
            {rupiah.format(field.hargaPerJam)}
          </span>{" "}
          / jam · buka 08.00–23.00
        </p>
      </div>
      <BookingForm fieldId={field.id} hargaPerJam={field.hargaPerJam} />
    </div>
  );
}
