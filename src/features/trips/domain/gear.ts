import * as z from "zod";
import type { DomainIconName } from "./icons";

// The packing list.
//
// Mirrors public.trip_gear (migration 0017). Unlike every other list in the
// trip, nothing here is suggested, fetched or derived — see the migration for
// why that is a deliberate property of the feature and not a gap in it.

export const gearCategorySchema = z.enum([
  "documents",
  "clothing",
  "toiletries",
  "electronics",
  "health",
  "other",
]);
export type GearCategory = z.infer<typeof gearCategorySchema>;

// Icon keys, not pictures: what a category looks like is the component layer's
// business (see components/domain-icon.tsx). These used to be emoji, under the
// rule "lucide for interface affordances, emoji for domain identity" — see
// domain/icons.ts for the three measurements that retired it.
//
// Written in the order things get packed in practice: the documents you must not
// forget first, the "anything else" bucket last. The UI renders groups in this
// order rather than alphabetically or by count, so the list does not reshuffle
// itself as items are added.
export const GEAR_CATEGORIES: Record<
  GearCategory,
  { label: string; icon: DomainIconName }
> = {
  documents: { label: "מסמכים", icon: "documents" },
  clothing: { label: "ביגוד", icon: "clothing" },
  toiletries: { label: "טואלטיקה", icon: "toiletries" },
  electronics: { label: "אלקטרוניקה", icon: "electronics" },
  health: { label: "בריאות ותרופות", icon: "health" },
  other: { label: "אחר", icon: "other" },
};

export const GEAR_CATEGORY_ORDER = Object.keys(
  GEAR_CATEGORIES,
) as GearCategory[];

export const gearItemSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  label: z.string().min(1),
  category: gearCategorySchema,
  packed: z.boolean(),
  created_at: z.string(),
});
export type GearItem = z.infer<typeof gearItemSchema>;

// What the add form submits. The same schema validates the Server Action's
// FormData, so the field names here are the field names in the markup.
export const gearFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "כתבו מה להוסיף")
    .max(120, "עד 120 תווים"),
  category: gearCategorySchema,
});
export type GearFormValues = z.infer<typeof gearFormSchema>;

export type GearFormState =
  | {
      message?: string;
      errors?: { label?: string[]; category?: string[] };
    }
  | undefined;

// The column is plain text (see the migration), so a value the app does not know
// has to resolve to something rather than throwing. It becomes "other", which is
// a visible group the user can move the item out of — the failure mode is a
// misfiled item, not a screen that will not render.
export function normalizeCategory(value: string | null): GearCategory {
  const parsed = gearCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : "other";
}

export type GearGroup = {
  category: GearCategory;
  items: GearItem[];
  packed: number;
};

// Groups the list for rendering, in GEAR_CATEGORY_ORDER, skipping empty groups.
//
// Packed items are *not* sorted to the bottom. A checklist where ticking a box
// makes the row jump somewhere else is a checklist you lose your place in, and
// the next thing you want to tick was the row underneath.
export function groupGear(items: GearItem[]): GearGroup[] {
  const byCategory = new Map<GearCategory, GearItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }

  return GEAR_CATEGORY_ORDER.flatMap((category) => {
    const group = byCategory.get(category);
    if (!group || group.length === 0) return [];
    return [
      {
        category,
        items: group,
        packed: group.filter((item) => item.packed).length,
      },
    ];
  });
}

export type GearProgress = {
  total: number;
  packed: number;
  // 0–100, rounded. 0 when the list is empty, so a caller can render a bar
  // without special-casing division by zero.
  percent: number;
  done: boolean;
};

export function gearProgress(items: GearItem[]): GearProgress {
  const total = items.length;
  const packed = items.filter((item) => item.packed).length;
  return {
    total,
    packed,
    percent: total === 0 ? 0 : Math.round((packed / total) * 100),
    // Explicitly `total > 0`: an empty list is not a finished one, and a
    // "הכול ארוז" banner over nothing is the kind of thing that gets someone
    // to the airport without a passport.
    done: total > 0 && packed === total,
  };
}

// Quick-add suggestions.
//
// Not AI, and not a template that writes rows on its own: a flat list of the
// things people forget, offered as one-tap buttons that add a normal row the
// user can then rename or delete. It is here rather than in the component
// because it is product copy, and because it is the kind of list that gets
// argued about and edited — which is easier when it is data in the domain.
//
// Anything already on the list is filtered out at the call site, so the buttons
// only ever offer something new.
export const GEAR_STARTERS: Record<GearCategory, string[]> = {
  documents: ["דרכון", "ויזה", "כרטיסי טיסה", "ביטוח נסיעות", "רישיון נהיגה בינלאומי"],
  clothing: ["מעיל", "נעלי הליכה", "בגד ים", "גרביים", "פיג׳מה"],
  toiletries: ["מברשת שיניים", "משחת שיניים", "דאודורנט", "קרם הגנה", "מגבת"],
  electronics: ["מטען טלפון", "מתאם שקע", "סוללה נטענת", "אוזניות"],
  health: ["תרופות קבועות", "משככי כאבים", "פלסטרים", "כמוסות לבחילה"],
  other: ["בקבוק מים", "תיק יום", "שקיות כביסה", "מזומן"],
};

// Case- and whitespace-insensitive, because "דרכון" and "דרכון " are the same
// item and offering the button again after it was added reads as a bug.
export function starterSuggestions(
  category: GearCategory,
  existing: GearItem[],
): string[] {
  const taken = new Set(
    existing.map((item) => item.label.trim().toLocaleLowerCase("he")),
  );
  return GEAR_STARTERS[category].filter(
    (label) => !taken.has(label.trim().toLocaleLowerCase("he")),
  );
}
