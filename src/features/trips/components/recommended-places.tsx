"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { setSelected } from "../application/guide-actions";
import { PlacePhoto } from "./place-photo";
import { CategoryTile } from "./category-tile";
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
//   * **A photo, once there was a way to get one.** PlacePhoto already
//     existed for the schedule's stops — Wikipedia's lead image, free and
//     keyless, behind /api/places/photo — so the export's 80px thumbnail is
//     real. It draws nothing at all when Wikipedia has no page for the place,
//     which is why the card has to read without it too.
//   * **Still no rating.** A 4.8 under a name nobody scored is an invented
//     fact, and there is no free source for one.
//
// The source is the saved city guide — the same rows the city page reads, so
// what is recommended here is what was already generated for that city, and
// adding one from here marks the same row the guide marks.
//
// Pencil draws it as one white card of rows — a category tile, the name, a
// "label • note" line, and a round "+" that turns into a filled green check.
// The label is the editorial slot ("חובה ביקור"); ours says what kind of thing
// the item is, which is the same slot filled by the data that exists.
const LABELS: Record<AiCategoryKey, string> = {
  attractions: "חובה ביקור",
  restaurants: "חוויה קולינרית",
  experiences: "חוויה מקומית",
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
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="min-w-0 text-lg font-bold leading-6 wrap-anywhere">
          מומלצים ב{city}
        </h2>
        {/* The export's source note. It says where the order comes from, not
            "by popularity" — nobody scored these. */}
        <span className="shrink-0 text-caption text-muted">
          מתוך מדריך העיר
        </span>
      </div>

      <ul className="overflow-hidden rounded-[20px] bg-surface shadow-card">
        {items.map((item) => {
          const isAdded = added.includes(item.key);
          return (
            <li
              key={item.key}
              className="flex min-w-0 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              {/* The export's 44px category tile — and the photo over it when
                  Wikipedia has one (PlacePhoto draws the tile underneath and
                  fades the image in, so the row is one shape either way). */}
              <PlacePhoto
                query={item.name}
                near={city}
                className="h-11 w-11 shrink-0 rounded-[14px]"
                fallback={
                  <CategoryTile
                    category={item.category}
                    className="h-full w-full rounded-none"
                  />
                }
              />

              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="min-w-0 truncate text-base font-bold">
                  {item.name}
                </h3>
                <p className="min-w-0 truncate text-caption text-muted">
                  {LABELS[item.category]}
                  {item.tip ? ` · ${item.tip}` : ""}
                </p>
              </div>

              {/* The export's round control: outlined "+" at rest, a filled
                  green check once it is in. Pressing the check takes it out
                  again — a toggle of one flag, not a deletion. */}
              <button
                type="button"
                onClick={() => void toggle(item)}
                disabled={busy === item.key}
                aria-label={
                  isAdded
                    ? `הסרה של ${item.name} מהטיול`
                    : `הוספת ${item.name} לטיול`
                }
                aria-pressed={isAdded}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isAdded
                    ? "bg-success text-white hover:bg-success-strong"
                    : "border border-border-strong bg-surface text-foreground hover:bg-surface-sunken",
                  busy === item.key && "opacity-60",
                )}
              >
                {isAdded ? (
                  <Check className="h-5 w-5 animate-stamp" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
