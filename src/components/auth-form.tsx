"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COPY = {
  login: {
    title: "Masuk",
    description: "Masuk untuk booking lapangan.",
    submit: "Masuk",
    pending: "Masuk...",
  },
  register: {
    title: "Daftar",
    description: "Buat akun untuk mulai booking.",
    submit: "Daftar",
    pending: "Mendaftar...",
  },
} as const;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form);

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Terjadi kesalahan, coba lagi.");
      setLoading(false);
      return;
    }

    if (mode === "register") {
      toast.success("Akun berhasil dibuat, silakan masuk.");
      router.push("/login");
    } else {
      toast.success("Selamat datang kembali!");
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-3xl font-extrabold tracking-wide uppercase italic">
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          {mode === "register" && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? copy.pending : copy.submit}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="inline-block font-semibold text-primary transition-all duration-200 hover:scale-105 hover:text-primary/80 active:scale-95"
              >
                Daftar
              </Link>
            </>
          ) : (
            <>
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="inline-block font-semibold text-primary transition-all duration-200 hover:scale-105 hover:text-primary/80 active:scale-95"
              >
                Masuk
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
