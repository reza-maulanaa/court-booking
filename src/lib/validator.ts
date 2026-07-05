import { z } from "zod";
import { CLOSE_HOUR, MAX_DAYS_AHEAD, OPEN_HOUR, todayWIB } from "./constants";
import { nowHourWIB, MAX_PROOF_MB } from "./constants";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Email tidak valid"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(72, "Password maksimal 72 karakter"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const createBookingSchema = z
  .object({
    fieldId: z.string().min(1),
    bookingDate: z.iso.date(),
    startHour: z
      .number()
      .int()
      .min(OPEN_HOUR)
      .max(CLOSE_HOUR - 1),
    durationHours: z.number().int().min(1),
  })
  .refine((b) => b.startHour + b.durationHours <= CLOSE_HOUR, {
    message: `Booking melewati jam tutup (${CLOSE_HOUR}:00)`,
    path: ["durationHours"],
  })
  .refine(
    (b) => {
      const today = todayWIB();
      const max = new Date(`${b.bookingDate}T00:00:00`);
      const limit = new Date(`${today}T00:00:00`);
      limit.setDate(limit.getDate() + MAX_DAYS_AHEAD);
      return b.bookingDate >= today && max <= limit;
    },
    {
      message: `Tanggal harus hari ini s/d ${MAX_DAYS_AHEAD} hari ke depan`,
      path: ["bookingDate"],
    },
  )
  .refine((b) => b.bookingDate !== todayWIB() || b.startHour > nowHourWIB(), {
    message: "Jam tersebut sudah lewat",
    path: ["startHour"],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// FormData tidak lewat Zod — validasi file manual, dipakai route proof.
export function proofFileError(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0)
    return "File bukti transfer wajib diunggah";
  if (!file.type.startsWith("image/"))
    return "File harus berupa gambar (JPG/PNG)";
  if (file.size > MAX_PROOF_MB * 1024 * 1024)
    return `Ukuran maksimal ${MAX_PROOF_MB}MB — kirim screenshot saja`;
  return null;
}
