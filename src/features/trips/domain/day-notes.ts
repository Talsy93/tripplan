import * as z from "zod";
import type { DomainIconName } from "./icons";

// Something true of a whole day rather than of an hour in it.
//
// Migration 0025. Asked for as "a point to mark on that day regardless of the
// schedule — say that a certain day is a holiday."
//
// Everything else a day holds is an event: an itinerary item has an hour, a
// reminder has an hour, a booking has a timestamp. A note has none, and that is
// the whole point of it. "Yom Kippur", "a rest day", "Dana's birthday",
// "museums shut on Mondays" — each changes what the day should hold without
// being something in it.
//
// Two jobs, and both matter:
//
//   on screen   a band at the top of the day, above the schedule, in the
//               colour of what it is
//   in the      a line in the itinerary prompt, so the build plans around it
//   prompt      rather than being corrected afterwards. A holiday is the clear
//               case: half the places the model would pick are shut.

export const DAY_NOTE_KINDS = ["holiday", "rest", "event", "note"] as const;
export const dayNoteKindSchema = z.enum(DAY_NOTE_KINDS);
export type DayNoteKind = z.infer<typeof dayNoteKindSchema>;

// What each kind is called, what it looks like, and — the field the other two
// do not have — what it means for planning.
//
// `planning` is written as an instruction to the model rather than as a
// description, because that is where it is going. "A holiday" tells it nothing;
// "many places are closed, prefer things that stay open" tells it what to do.
// A kind with nothing useful to say leaves it null rather than inventing
// advice, and the prompt then carries the label alone.
export const DAY_NOTE_KINDS_INFO: Record<
  DayNoteKind,
  {
    label: string;
    icon: DomainIconName;
    // The tone token family the band is drawn in.
    tone: "callout" | "primary" | "neutral";
    planning: string | null;
  }
> = {
  holiday: {
    label: "חג",
    icon: "holiday",
    tone: "callout",
    planning:
      "יום חג — הרבה מקומות סגורים או בשעות מיוחדות. העדיפו דברים פתוחים, ואל תצפיפו את היום",
  },
  rest: {
    label: "יום מנוחה",
    icon: "rest",
    tone: "primary",
    planning: "יום מנוחה — תכננו לכל היותר דבר אחד או שניים, ובקצב נינוח",
  },
  event: {
    label: "אירוע",
    icon: "event",
    tone: "callout",
    planning: null,
  },
  note: {
    label: "הערה",
    icon: "note",
    tone: "neutral",
    planning: null,
  },
};

export const dayNoteSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  day_number: z.number().int().min(1).max(60),
  kind: dayNoteKindSchema,
  label: z.string().min(1).max(80),
  created_at: z.string(),
});
export type DayNote = z.infer<typeof dayNoteSchema>;

export const dayNoteFormSchema = z.object({
  dayNumber: z
    .number()
    .int("מספר היום צריך להיות מספר שלם")
    .min(1, "היום הראשון הוא 1")
    .max(60, "עד יום 60"),
  kind: dayNoteKindSchema,
  label: z
    .string()
    .trim()
    .min(1, "כתבו מה לציין ביום הזה")
    .max(80, "עד 80 תווים"),
});
export type DayNoteFormValues = z.infer<typeof dayNoteFormSchema>;

export function notesForDay(notes: DayNote[], dayNumber: number): DayNote[] {
  return notes.filter((note) => note.day_number === dayNumber);
}

// True when there is anything here worth putting in a prompt.
export function dayNotesHaveFacts(notes: DayNote[]): boolean {
  return notes.length > 0;
}

// The notes as instructions, grouped one line per day.
//
// The label is the traveller's own words and is passed through as written — it
// is the specific thing they know and the model does not. The kind's `planning`
// sentence follows it, because "Yom Kippur" on its own does not tell a model
// that the city stops.
export function dayNotesPromptLines(notes: DayNote[]): string {
  const byDay = new Map<number, DayNote[]>();
  for (const note of notes) {
    const list = byDay.get(note.day_number) ?? [];
    list.push(note);
    byDay.set(note.day_number, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, dayNotes]) => {
      const parts = dayNotes.map((note) => {
        const info = DAY_NOTE_KINDS_INFO[note.kind];
        const advice = info.planning ? ` — ${info.planning}` : "";
        return `${info.label}: ${note.label}${advice}`;
      });
      return `- יום ${day}: ${parts.join(" | ")}`;
    })
    .join("\n");
}
