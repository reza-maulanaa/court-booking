"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function LandingLogoutLink() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sampai jumpa!");
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex cursor-pointer items-center gap-1.5 text-base font-bold text-tf-muted transition-all duration-200 hover:scale-105 hover:text-tf-ink active:scale-95"
    >
      <LogOut className="size-3.5" aria-hidden />
      Keluar
    </button>
  );
}
