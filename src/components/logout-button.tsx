"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sampai jumpa!");
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">Keluar</span>
    </Button>
  );
}
