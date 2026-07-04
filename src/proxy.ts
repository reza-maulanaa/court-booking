import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isAdminArea =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!session) {
    if (isApi) {
      return NextResponse.json(
        { error: "Silakan login dulu" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAdminArea && session.role !== "admin") {
    if (isApi) {
      return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/bookings/:path*",
    "/admin/:path*",
    "/api/bookings/:path*",
    "/api/admin/:path*",
  ],
};
