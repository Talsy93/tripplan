"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { setSelected } from "../application/guide-actions";
import { categoryLabel } from "../domain/place";
import type { SelectedItem } from "../domain/ai-suggestion";
import { MapPin } from "lucide-react";

function keyOf(item: SelectedItem) {
  return `${item.city}|${item.category}|${item.name}`;
}

// "נבחרו לטיול" — the shortlist, as rows with a green check.
//
// It was a two-column grid of cards, grouped by city, each row carrying a tone
// dot, a Google Maps icon and a red X. The design draws one card of rows and a
// check per row, and three things follow from that rather than from taste:
//
//   * **Rows, not cards.** Twelve cards is a screen; twelve rows is a list. This
//     is a shortlist you skim to see whether something is already on it.
//   * **The check is the control.** The red X sitting at rest in every row is
//     what the design forbids outright (law 05, and the same icon was removed
//     from the itinerary list in T2). A green check that turns into an X on
//     hover says "selected — press to unselect", which is what this actually is:
//     a toggle of one boolean, not a deletion.
//   * **No per-row map link.** The places on this list are the pins on the map
//     pane beside it and on the מפה tab. A link out to Google Maps on every row
//     of a shortlist is the kind of thing the redesign strips.
//
// The city stays, as the row's subtitle rather than as a heading over a group:
// in a 372px pane a per-city grid has no second column to give, and the city is
// one fact about a place rather than the way in to it.
export function SelectedList({
  tripId,
  items: initialItems,
}: {
  tripId: string;
  items: SelectedItem[];
}) {
  const [items, setItems] = useState<SelectedItem[]>(initialItems);

  function remove(item: SelectedItem) {
    setItems((prev) => prev.filter((it) => keyOf(it) !== keyOf(item)));
    void setSelected(tripId, item.city, item.category, item.name, false);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="עדיין לא הוספתם פריטים"
        description="חפשו מקום למעלה, או היכנסו לעיר מתוך ״גילוי יעדים״ והוסיפו המלצות לטיול."
      />
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <ul>
        {items.map((item) => (
          <li
            key={keyOf(item)}
            className="flex min-w-0 items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            {/* group/pick, not group: the row also sits inside whatever the
                caller wrapped it in, and an unnamed group would be captured by
                the nearest one. */}
            <button
              type="button"
              onClick={() => remove(item)}
              title={`הסרה של ${item.name} מהטיול`}
              aria-label={`הסרה של ${item.name} מהטיול`}
              className={cn(
                "group/pick flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                "bg-success-tint text-success-ink hover:bg-danger-tint hover:text-danger-ink",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Check
                className="h-4 w-4 group-hover/pick:hidden"
                aria-hidden="true"
              />
              <X
                className="hidden h-4 w-4 group-hover/pick:block"
                aria-hidden="true"
              />
            </button>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {item.name}
              </span>
              {/* One truncated line of context. For a hand-typed place this is
                  the address that was entered — without it the address would be
                  stored and never shown; for a guide item it is the start of the
                  AI's description. The city leads, because on a four-city trip
                  that is the fact you are scanning for. */}
              <span className="block truncate text-caption text-muted">
                {item.city}
                {" · "}
                {item.description ?? categoryLabel(item.category)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
