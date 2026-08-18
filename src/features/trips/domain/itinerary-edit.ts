import * as z from "zod";
import { formatMinutes, parseTimeLabel } from "./timeline";

// Editing one itinerary entry: its hours, which day it sits on, and how you get
// to it.
//
// Until now the itinerary was read-only apart from deletion — the AI's answer
// was the only answer, and a wrong time meant rebuilding the whole thing and
// losing every other correction with it.
//
// Times are validated with parseTimeLabel, the same function the timeline uses
// to place a block, rather than with a regex of its own. That is the guarantee
// that matters: anything accepted here can be drawn. It also means the stored
// label is normalised to HH:MM, so a day does not end up with "9:00" next to
// "09:00" next to "בין 8 ל-9" depending on who wrote it.
const timeLabel = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return "";

    const minutes = parseTimeLabel(value);
    if (minutes === null) {
      ctx.addIssue({
        code: "custom",
        message: 'שעה לא תקינה. הפורמט הוא HH:MM, למשל 09:30',
      });
      return z.NEVER;
    }
    return formatMinutes(minutes);
  });

export const updateItineraryEntrySchema = z
  .object({
    id: z.uuid(),
    startLabel: timeLabel,
    endLabel: timeLabel,
    // Which day of the trip. The itinerary's own day numbering, 1-based.
    dayNumber: z
      .number()
      .int("מספר היום צריך להיות מספר שלם")
      .min(1, "היום הראשון הוא 1")
      .max(60, "עד יום 60"),
    note: z.string().trim().max(1000, "ההערה ארוכה מדי").nullable(),
    // How to get there, in the user's own words. The app cannot compute this:
    // it only has a straight-line distance when both ends came from OSM search,
    // and free public-transport routing does not exist as an API (see the C4
    // note in PROJECT_PLAN.md). So this is the place to write down what you
    // worked out once, instead of looking it up again on the day.
    travelNote: z.string().trim().max(500, "הפירוט ארוך מדי").nullable(),
    travelMinutes: z
      .number()
      .int("זמן ההגעה צריך להיות מספר שלם של דקות")
      .min(0, "זמן הגעה לא יכול להיות שלילי")
      .max(1440, "עד 24 שעות")
      .nullable(),
  })
  // A start without an end is fine — the timeline gives it a default block —
  // but an end without a start is not, because there is nothing to hang it on
  // and the entry would silently fall into "no time set".
  .refine((value) => !(value.endLabel !== "" && value.startLabel === ""), {
    message: "אם יש שעת סיום צריך גם שעת התחלה",
    path: ["startLabel"],
  })
  // Checked here rather than left to the timeline's default-block fallback: a
  // reversed range is a typo, and quietly redrawing it hides the mistake.
  .refine(
    (value) => {
      if (value.startLabel === "" || value.endLabel === "") return true;
      const start = parseTimeLabel(value.startLabel);
      const end = parseTimeLabel(value.endLabel);
      if (start === null || end === null) return true;
      return end > start;
    },
    { message: "שעת הסיום צריכה להיות אחרי ההתחלה", path: ["endLabel"] },
  );

export type UpdateItineraryEntryInput = z.infer<
  typeof updateItineraryEntrySchema
>;

export type UpdateEntryResult =
  | { ok: true }
  | { ok: false; errors?: Record<string, string>; message?: string };
