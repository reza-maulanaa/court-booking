import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validator";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { signToken, COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";

const LOGIN_FAILED = { error: "Email atau password salah" };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) return;
  NextResponse.json(LOGIN_FAILED, { status: 401 });

  const { email, password } = parsed.data;
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if(!user) return NextResponse.json(LOGIN_FAILED, {status: 401})

  const match = await bcrypt.compare(password, user.passwordHash);
  if(!match) return NextResponse.json(LOGIN_FAILED, {status: 401})

 const token = await signToken(user.id, user.role);
  (await cookies()).set(COOKIE_NAME, token, sessionCookieOptions);
  return NextResponse.json({ ok: true, name: user.name, role: user.role });

}
