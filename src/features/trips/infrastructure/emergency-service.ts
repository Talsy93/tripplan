import { createClient } from "@/lib/supabase/server";
import {
  emergencyContactSchema,
  type EmergencyContact,
  type EmergencyContactInput,
} from "../domain/emergency";

// Empty on a database where 0026 has not been run, rather than an error that
// takes the documents screen down with it: the card simply offers to add one.
export async function listEmergencyContacts(
  tripId: string,
): Promise<EmergencyContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_emergency_contacts")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("listEmergencyContacts failed:", error.message);
    return [];
  }
  return data.flatMap((row) => {
    const parsed = emergencyContactSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createEmergencyContact(
  tripId: string,
  input: EmergencyContactInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_emergency_contacts").insert({
    trip_id: tripId,
    label: input.label,
    phone: input.phone,
    detail: input.detail ?? null,
  });
  if (error) console.error("createEmergencyContact failed:", error.message);
  return !error;
}

export async function updateEmergencyContact(
  id: string,
  input: EmergencyContactInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_emergency_contacts")
    .update(
      { label: input.label, phone: input.phone, detail: input.detail ?? null },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) console.error("updateEmergencyContact failed:", error.message);
  return !error && count !== 0;
}

export async function deleteEmergencyContact(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_emergency_contacts")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("deleteEmergencyContact failed:", error.message);
  return !error && count !== 0;
}
