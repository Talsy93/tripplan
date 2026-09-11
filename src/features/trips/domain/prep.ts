import * as z from "zod";
import type { Booking } from "./booking";

// The to-do list before departure.
//
// Two kinds of rows share one table: things the user typed ("kind" null) and
// things the app suggested and the user accepted ("kind" = the suggestion's
// key). The key is what stops a suggestion coming back after it was added, and
// what lets a suggestion carry a due date computed from the trip — online
// check-in opens 24 hours before the first flight, so that row knows its date.

export const prepItemSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  title: z.string().min(1).max(160),
  done: z.boolean(),
  due_date: z.string().nullable(),
  url: z.string().nullable(),
  kind: z.string().nullable(),
  created_at: z.string(),
});

export type PrepItem = z.infer<typeof prepItemSchema>;

export const prepItemFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "כתבו מה לזכור")
    .max(160, "עד 160 תווים"),
  url: z
    .string()
    .trim()
    .max(2000, "הקישור ארוך מדי")
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "קישור מתחיל ב-http:// או https://",
    )
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך בפורמט YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
});

export type PrepFormState =
  | {
      message?: string;
      errors?: { title?: string[]; url?: string[]; dueDate?: string[] };
    }
  | undefined;

export type PrepSuggestion = {
  kind: string;
  title: string;
  dueDate: string | null;
  // Where in the app this is done, when it is done in the app.
  path: string | null;
};

// Everything the app can reasonably guess a traveller has to do before leaving.
// Ordered by when it bites: the things with a deadline first, then the
// documents, then the comforts. `context` narrows the list — a trip that is
// already shared does not need "share the trip".
export function suggestPrepItems({
  bookings,
  startDate,
  existing,
  isShared,
  hasGear,
  pushEnabled,
}: {
  bookings: Booking[];
  startDate: string | null;
  existing: PrepItem[];
  isShared: boolean;
  hasGear: boolean;
  pushEnabled: boolean;
}): PrepSuggestion[] {
  const taken = new Set(existing.map((item) => item.kind).filter(Boolean));
  const out: PrepSuggestion[] = [];
  const add = (suggestion: PrepSuggestion) => {
    if (!taken.has(suggestion.kind)) out.push(suggestion);
  };

  const firstFlight = bookings
    .filter((booking) => booking.kind === "flight")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  if (firstFlight) {
    add({
      kind: "checkin",
      title: `צ׳ק-אין אונליין ל${firstFlight.title}`,
      dueDate: shiftDate(firstFlight.starts_at.slice(0, 10), -1),
      path: "more/trip",
    });
    add({
      kind: "tickets",
      title: "כרטיסי הטיסה שמורים בטלפון (קישור או צילום מסך)",
      dueDate: shiftDate(firstFlight.starts_at.slice(0, 10), -1),
      path: null,
    });
  } else {
    add({
      kind: "flights",
      title: "להזין את הטיסות — הלו״ז מסתמך עליהן",
      dueDate: null,
      path: "more/trip",
    });
  }

  const hasLodging = bookings.some((booking) => booking.kind === "lodging");
  add({
    kind: "hotel-confirmations",
    title: hasLodging
      ? "אישורי המלונות שמורים אופליין"
      : "להזין את הלינה — היא קובעת איזה יום באיזו עיר",
    dueDate: startDate ? shiftDate(startDate, -2) : null,
    path: "more/trip",
  });

  add({
    kind: "passport",
    title: "דרכון בתוקף לפחות 6 חודשים מיום החזרה",
    dueDate: startDate ? shiftDate(startDate, -14) : null,
    path: null,
  });
  add({
    kind: "passport-copy",
    title: "עותק דיגיטלי של הדרכון (ובנפרד מהמקור)",
    dueDate: startDate ? shiftDate(startDate, -3) : null,
    path: null,
  });
  add({
    kind: "insurance",
    title: "ביטוח נסיעות — פוליסה שמורה ומספר חירום",
    dueDate: startDate ? shiftDate(startDate, -7) : null,
    path: null,
  });
  add({
    kind: "esim",
    title: "eSIM או חבילת גלישה לחו״ל",
    dueDate: startDate ? shiftDate(startDate, -3) : null,
    path: null,
  });
  add({
    kind: "cards",
    title: "כרטיס אשראי בלי עמלות המרה, ומזומן קטן במטבע היעד",
    dueDate: startDate ? shiftDate(startDate, -3) : null,
    path: null,
  });
  add({
    kind: "offline-maps",
    title: "מפות אופליין של הערים בטיול",
    dueDate: startDate ? shiftDate(startDate, -1) : null,
    path: null,
  });
  add({
    kind: "meds",
    title: "תרופות קבועות לכל הימים, ומרשם באנגלית",
    dueDate: startDate ? shiftDate(startDate, -3) : null,
    path: null,
  });
  if (!isShared) {
    add({
      kind: "share",
      title: "לשתף את הטיול עם מי שנוסע איתכם",
      dueDate: null,
      path: "more/members",
    });
  }
  if (!pushEnabled) {
    add({
      kind: "push",
      title: "להפעיל תזכורות בטלפון (באייפון — אחרי התקנה למסך הבית)",
      dueDate: null,
      path: "more/trip",
    });
  }
  add({
    kind: "packing",
    title: hasGear ? "לסיים את האריזה" : "לבנות רשימת אריזה",
    dueDate: startDate ? shiftDate(startDate, -1) : null,
    path: "more/gear",
  });

  return out;
}

export function prepProgress(items: PrepItem[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// Items due within the next `days` days or already overdue, undone.
export function duePrep(items: PrepItem[], today: string, days = 3): PrepItem[] {
  const limit = shiftDate(today, days);
  return items.filter(
    (item) => !item.done && item.due_date !== null && item.due_date <= limit,
  );
}

function shiftDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const at = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return at.toISOString().slice(0, 10);
}
