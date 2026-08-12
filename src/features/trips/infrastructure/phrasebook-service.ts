import { createClient } from "@/lib/supabase/server";
import { aiPhrasebookSchema } from "../domain/phrasebook";
import type { AiPhrasebook } from "../domain/phrasebook";

// Loads the saved phrasebook, or null when the trip hasn't got one yet.
//
// The phrases come back as jsonb, so they're re-validated here: what a column
// holds is whatever was written to it, and a shape change should surface as a
// missing phrasebook rather than as a crash halfway down the render.
export async function getPhrasebook(
  tripId: string,
): Promise<AiPhrasebook | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_phrasebooks")
    .select("language, language_english, phrases")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error || !data) return null;

  const parsed = aiPhrasebookSchema.safeParse({
    language: data.language,
    language_english: data.language_english,
    sections: data.phrases,
  });
  if (!parsed.success) {
    console.error("getPhrasebook: stored phrasebook failed validation");
    return null;
  }
  return parsed.data;
}

// Replaces the trip's phrasebook. Upsert on trip_id, which is the primary key,
// so regenerating overwrites rather than failing.
export async function savePhrasebook(tripId: string, phrasebook: AiPhrasebook) {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_phrasebooks").upsert(
    {
      trip_id: tripId,
      language: phrasebook.language,
      language_english: phrasebook.language_english,
      phrases: phrasebook.sections,
    },
    { onConflict: "trip_id" },
  );

  if (error) {
    console.error("savePhrasebook failed:", error.message);
    return false;
  }
  return true;
}
