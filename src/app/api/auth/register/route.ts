import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validator";
import { pgErrorCode } from "@/lib/pg-error";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({ name, email, passwordHash });
  } catch (e) {
    if (pgErrorCode(e) === "23505") {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
