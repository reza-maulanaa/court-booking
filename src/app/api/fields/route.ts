import { NextResponse } from "next/server";
import { db } from "@/db";
import { fields } from "@/db/schema";

export async function GET() {
  const allFields = await db.query.fields.findMany({
    orderBy: fields.name,
  });
  return NextResponse.json(allFields)
}
