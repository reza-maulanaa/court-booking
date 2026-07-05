import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { sql as sqlTag } from "drizzle-orm"
import * as schema from "./schema"
import { PROOF_DEADLINE_MIN } from "@/lib/constants"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, {schema})

// Lazy expiration: pending tanpa bukti transfer yang lewat deadline ditandai
// 'expired' — dipanggil di jalur baca/tulis booking, bukan lewat cron.
// Perbandingan waktu sepenuhnya di SQL supaya tidak ada isu timezone JS.
export async function expireStaleBookings() {
  await db
    .update(schema.bookings)
    .set({ status: "expired" })
    .where(
      sqlTag`${schema.bookings.status} = 'pending'
        AND ${schema.bookings.proofUrl} IS NULL
        AND ${schema.bookings.createdAt} < now() - ${PROOF_DEADLINE_MIN} * interval '1 minute'`,
    )
}
