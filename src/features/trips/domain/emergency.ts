import * as z from "zod";

// The numbers you need when something goes wrong abroad: the insurer, the
// embassy, a doctor. Mirrors public.trip_emergency_contacts (migration 0026).

export const emergencyContactSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  label: z.string().min(1).max(80),
  phone: z.string().min(3).max(40),
  detail: z.string().max(120).nullable(),
  created_at: z.string(),
});
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;

// What the add/edit form submits. Bounds match the column's check constraints,
// so the database is never the thing that reports a bad value.
export const emergencyContactFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { error: "יש לציין למי המספר." })
    .max(80, { error: "עד 80 תווים." }),
  phone: z
    .string()
    .trim()
    .min(3, { error: "יש לציין מספר טלפון." })
    .max(40, { error: "מספר ארוך מדי." })
    .regex(/^[+\d][\d\s\-()]*$/, { error: "רק ספרות, רווחים, מקפים ו-+." }),
  detail: z
    .string()
    .trim()
    .max(120, { error: "עד 120 תווים." })
    .optional()
    .transform((value) => (value ? value : undefined)),
});
export type EmergencyContactInput = z.infer<typeof emergencyContactFormSchema>;

// A dialable href. Spaces and dashes are for reading; the dialler wants digits
// and the leading plus.
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
