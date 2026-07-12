import { describe, it, expect } from "vitest";
import { buildAdminWaLink } from "./wa";

describe("buildAdminWaLink", () => {
  it("normalisasi nomor 08xx jadi 62xx di URL wa.me", () => {
    const link = buildAdminWaLink({
      adminPhone: "0812-3456-7890",
      customerName: "Budi",
      summary: "Lapangan A · Sen, 20 Jul 2026 · 10:00",
      origin: "https://example.com",
    });
    expect(link).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
  });

  it("pesan berisi nama, ringkasan, dan link /admin, ter-encode", () => {
    const link = buildAdminWaLink({
      adminPhone: "0812-3456-7890",
      customerName: "Budi",
      summary: "Lapangan A · Sen, 20 Jul 2026 · 10:00",
      origin: "https://example.com",
    });
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toContain("Budi");
    expect(text).toContain("Lapangan A");
    expect(text).toContain("https://example.com/admin");
  });
});
