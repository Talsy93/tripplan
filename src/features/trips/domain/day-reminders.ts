import * as z from "zod";
import { APP_TIME_ZONE } from "./weather";

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

// How much of the day's list is done — the count a checklist puts in its
// header. Same shape as prepProgress and gearProgress, because it is the same
// question asked about a different list.
export function reminderProgress(reminders: DayReminder[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = reminders.filter((reminder) => reminder.done).length;
  const total = reminders.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// Wall-clock minutes of an instant, in the trip's zone.
//
// Here and not in the component for the reason every other date derivation in
// this project gives: the browser's clock is not the trip's, and a component
// that computed this itself would disagree with the server render across
// hydration.
export function minutesOfDay(
  iso: string,
  zone: string = APP_TIME_ZONE,
): number | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hours = read("hour") % 24;
  const minutes = read("minute");
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

// A reminder whose hour has gone by and which has not been ticked off.
//
// The thing a to-do list of *timed* items has to say and a plain list cannot:
// "17:30, call the hotel" is information at 16:00 and a problem at 19:00, and
// the two should not look the same. Returns false when the day being looked at
// is not the day being lived — `nowMinutes` is null then, and a reminder on
// Thursday is not late on Tuesday.
export function isOverdue(
  reminder: DayReminder,
  nowMinutes: number | null,
): boolean {
  if (nowMinutes === null || reminder.done) return false;
  const [hours, minutes] = reminder.time_label.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  return hours * 60 + minutes < nowMinutes;
}
