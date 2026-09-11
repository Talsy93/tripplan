import * as z from "zod";

// A reminder pinned to an hour of a trip day — "17:30, call the hotel about the
// late check-in". It lives inside the day's timeline between the entries, and
// is ticked off like a task rather than deleted.
//
// Not a booking reminder (domain/reminders.ts): those are derived from a
// booking's deadlines and sent as push. These are typed in by the user and
// shown where the day is read.

const TIME_LABEL = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayReminderSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  day_number: z.number().int().min(1).max(60),
  time_label: z.string().regex(TIME_LABEL),
  title: z.string().min(1).max(120),
  done: z.boolean(),
  created_at: z.string(),
});

export type DayReminder = z.infer<typeof dayReminderSchema>;

export const dayReminderFormSchema = z.object({
  dayNumber: z
    .number()
    .int("מספר היום צריך להיות מספר שלם")
    .min(1, "היום הראשון הוא 1")
    .max(60, "עד יום 60"),
  timeLabel: z.string().regex(TIME_LABEL, "שעה בפורמט 17:30"),
  title: z
    .string()
    .trim()
    .min(1, "כתבו מה להזכיר")
    .max(120, "עד 120 תווים"),
});

export type DayReminderFormValues = z.infer<typeof dayReminderFormSchema>;

export function remindersForDay(
  reminders: DayReminder[],
  dayNumber: number,
): DayReminder[] {
  return reminders
    .filter((reminder) => reminder.day_number === dayNumber)
    .sort((a, b) => a.time_label.localeCompare(b.time_label));
}
