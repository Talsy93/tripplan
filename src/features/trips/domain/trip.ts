import * as z from "zod";

// Trip state machine — see ARCHITECTURE.md iron rule #6.
export const tripStatusSchema = z.enum([
  "planning",
  "executing",
  "completed",
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

// Mirrors public.trips (see src/db/migrations/0002_trips.sql).
export const tripSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().min(1),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: tripStatusSchema,
  created_at: z.string(),
});
export type Trip = z.infer<typeof tripSchema>;

// Input schema for creating a trip (thin slice — name only for now).
export const createTripSchema = z.object({
  name: z.string().trim().min(1, { error: "יש להזין שם לטיול." }),
});
export type CreateTripInput = z.infer<typeof createTripSchema>;

export type TripFormState =
  | {
      errors?: { name?: string[] };
      message?: string;
    }
  | undefined;

// Hebrew labels for the trip state machine.
export const tripStatusLabels: Record<TripStatus, string> = {
  planning: "בתכנון",
  executing: "בביצוע",
  completed: "הושלם",
};
