"use client";

import { useState } from "react";
import { Plus, Check, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { setSelected } from "../application/guide-actions";
import type { AiCategoryKey, CityGuideData } from "../domain/ai-suggestion";

// "מומלצים ב<עיר>" — the section the _4 export opens its results with, and the
// one this screen did not have.
//
// The export draws three cards: a photo, an editorial badge, a rating, a name,
// a one-line "category • note", and a round + button. Three of those five are
// real here and two are not, and the difference is worth being precise about:
//
//   * **The badge is the category.** The export's badges are editorial —
//     "חובה ביקור", "כניסה חינם" — written by a person for Rome. Ours names
//     what the item is, which is the same slot filled by the data that exists.
//   * **The line is the tip.** The city guide already writes one per item ("go
//     early, before the groups"), which is exactly the export's second line.
//   * **No photo and no rating.** OpenStreetMap has neither and the guide is
//     text; a 4.8 drawn under a name nobody scored is an invented fact, and a
//     grey rectangle where the photo goes is worse than a card without one. The
//     card is laid out to take an image later without moving anything.
//
// The source is the saved city guide — the same rows the city page reads, so
// what is recommended here is what was already generated for that city, and
// adding one from here marks the same row the guide marks.
const BADGES: Record<AiCategoryKey, { label: string; className: string }> = {
  attractions: {
    label: "חובה ביקור",
    className: "bg-cta-tint text-cta-ink",
  },
  restaurants: {
    label: "חוויה קולינרית",
    className: "bg-cta-tint text-cta-ink",
  },
  experiences: {
    label: "חוויה מקומית",
    className: "bg-success-bright text-success-ink",
  },
  areas: {
    label: "אזור לינה",
    className: "bg-primary-tint text-primary-ink",
  },
};

const CATEGORY_LINE: Record<AiCategoryKey, string> = {
  attractions: "אטרקציה או אתר",
  restaurants: "מסעדה",
  experiences: "חוויה",
  areas: "אזור לינה",
};

// How many to show. The export draws three, and three is also what keeps this
// from becoming the city guide with a different heading — "עוד" goes there.
const SHOWN = 3;

type Item = {
  key: string;
  category: AiCategoryKey;
  name: string;
  tip: string;
  selected: boolean;
};

function pick(guide: CityGuideData): Item[] {
  // One from each category before a second from any, so three cards are three
  // kinds of thing rather than three restaurants.
  const byCategory = (
    ["attractions", "restaurants", "experiences", "areas"] as AiCategoryKey[]
  ).map((category) =>
    (guide.sections[category] ?? []).map((item) => ({
      key: `${category}|${item.name}`,
      category,
      name: item.name,
      tip: item.tip || item.description,
      selected: item.selected,
    })),
  );

  const out: Item[] = [];
  for (let round = 0; out.length < SHOWN; round += 1) {
    const before = out.length;
    for (const list of byCategory) {
      const item = list[round];
      if (item && out.length < SHOWN) out.push(item);
    }
    // Every category is exhausted — stop rather than loop for ever.
    if (out.length === before) break;
  }
  return out;
}

export function RecommendedPlaces({
  tripId,
  city,
  guide,
}: {
  tripId: string;
  city: string;
  guide: CityGuideData | null;
}) {
  const items = guide ? pick(guide) : [];
  const [added, setAdded] = useState<string[]>(
    items.filter((item) => item.selected).map((item) => item.key),
  );
  const [busy, setBusy] = useState<string | null>(null);

  // Nothing generated for this city yet. No empty state: the AI panel directly
  // below is the thing that fills this, and an empty box above it saying so
  // would be the same sentence twice.
  if (items.length === 0) return null;

  async function toggle(item: Item) {
    const on = !added.includes(item.key);
    setBusy(item.key);
    setAdded((current) =>
      on ? [...current, item.key] : current.filter((key) => key !== item.key),
    );
    await setSelected(tripId, city, item.category, item.name, on);
    setBusy(null);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-6 wrap-anywhere">
          מומלצים ב{city}
        </h2>
        {/* The export's "לפי פופולריות". Ours says what the order actually is,
            because saying "by popularity" about a list nobody scored would be
            the rating problem again in one word. */}
        <span className="shrink-0 text-caption font-semibold text-primary-ink">
          מתוך המדריך של {city}
        </span>
      </div>

      {items.map((item) => {
        const isAdded = added.includes(item.key);
        const badge = BADGES[item.category];
        return (
          <article
            key={item.key}
            className="flex min-w-0 items-center gap-3 rounded-card bg-surface p-3 shadow-card"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
                {/* The export's star sits here with a score. Ours marks what is
                    already in the trip, which is the fact this row can actually
                    report. */}
                {isAdded && (
                  <span className="flex shrink-0 items-center gap-1 text-caption font-semibold text-success-ink">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    בטיול
                  </span>
                )}
              </div>
              <h3 className="min-w-0 truncate text-base font-medium">
                {item.name}
              </h3>
              <p className="min-w-0 truncate text-caption text-muted">
                {CATEGORY_LINE[item.category]} · {item.tip}
              </p>
            </div>

            {/* The export's round add button, and its press state: pale tint at
                rest, solid on hover, and a tick once it is in. */}
            <button
              type="button"
              onClick={() => void toggle(item)}
              disabled={busy === item.key}
              aria-label={
                isAdded ? `הסרה של ${item.name} מהטיול` : `הוספת ${item.name} לטיול`
              }
              aria-pressed={isAdded}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-card transition-all active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isAdded
                  ? "bg-success text-white"
                  : "bg-primary-tint text-primary hover:bg-primary hover:text-white",
                busy === item.key && "opacity-60",
              )}
            >
              {isAdded ? (
                <Check className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Plus className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </article>
        );
      })}
    </section>
  );
}
