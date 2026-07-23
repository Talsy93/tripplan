import * as z from "zod";

// Mirrors the public.profiles table (see src/db/migrations/0001_profiles.sql).
// Column names are kept snake_case so Supabase query rows validate directly.
export const profileSchema = z.object({
  id: z.uuid(),
  email: z.email().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.url().nullable(),
  created_at: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
