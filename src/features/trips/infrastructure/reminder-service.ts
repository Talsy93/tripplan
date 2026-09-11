import { createClient } from "@/lib/supabase/server";
import { dayReminderSchema, type DayReminder } from "../domain/day-reminders";

export async function listDayReminders(tripId: string): Promise<DayReminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_reminders")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("time_label", { ascending: true });
  if (error || !data) {
    if (error) console.error("listDayReminders failed:", error.message);
    return [];
  }
  return data.flatMap((row) => {
    const parsed = dayReminderSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createDayReminder(input: {
  tripId: string;
  dayNumber: number;
  timeLabel: string;
  title: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_reminders").insert({
    trip_id: input.tripId,
    day_number: input.dayNumber,
    time_label: input.timeLabel,
    title: input.title,
  });
  if (error) console.error("createDayReminder failed:", error.message);
  return !error;
}

export async function setDayReminderDone(
  id: string,
  done: boolean,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_reminders")
    .update({ done }, { count: "exact" })
    .eq("id", id);
  if (error) console.error("setDayReminderDone failed:", error.message);
  return !error && count !== 0;
}

export async function deleteDayReminder(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_reminders")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("deleteDayReminder failed:", error.message);
  return !error && count !== 0;
}
