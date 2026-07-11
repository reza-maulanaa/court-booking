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
      className="flex cursor-pointer items-center gap-1.5 text-tf-muted hover:text-tf-ink"
    >
      <LogOut className="size-3.5" aria-hidden />
      Keluar
    </button>
  );
}
