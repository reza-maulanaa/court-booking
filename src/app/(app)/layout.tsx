import { Navbar } from "@/components/navbar";

// Halaman aplikasi (auth, booking saya, jadwal, admin) tetap pakai navbar +
// footer lama; landing "/" punya nav & footer sendiri (DESAIN §2d).
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
      <footer className="mt-auto border-t bg-muted/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p className="font-heading text-lg font-extrabold uppercase tracking-wide text-foreground">
            Booking Futsal
          </p>
          <p>Buka setiap hari 08.00–23.00 WIB</p>
        </div>
      </footer>
    </>
  );
}
