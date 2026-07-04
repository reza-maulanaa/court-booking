import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Daftar — Booking Futsal" };

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <AuthForm mode="register" />
    </main>
  );
}
