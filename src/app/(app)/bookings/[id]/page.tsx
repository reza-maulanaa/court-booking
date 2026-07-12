import { BookingStatus } from "@/components/booking-status";

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingStatus id={id} />;
}
