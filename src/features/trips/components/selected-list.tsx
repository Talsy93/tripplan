"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { setSelected } from "../application/guide-actions";
import { categoryLabel } from "../domain/place";
import { PlacePhoto } from "./place-photo";
import { CategoryTile } from "./category-tile";
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

  // **Re-seeded when the server sends a different list.**
  //
  // Reported as "the attractions chosen for the trip are not rendered live,
  // only after a refresh", and this was the whole of it: `useState(initialItems)`
  // reads the prop once, on mount. Adding a place elsewhere on the screen does
  // revalidate — setSelected calls revalidatePath on the trip layout — so the
  // server re-rendered and handed this component a new array, which it then
  // ignored for the rest of its life. Only a full page load remounted it.
  //
  // Synced during render, React's documented way to adjust state when incoming
  // input changes, rather than in an effect — the same shape booking-form uses
  // for its own echo, and for the same reason: an effect would paint the stale
  // list for a frame first.
  //
  // This also makes the optimistic removal below self-healing. It drops the row
  // locally, the action revalidates, the server's answer comes back, and this
  // replaces the guess with the truth — including when the delete failed.
  //
  // Not booking-list's answer to the same bug, which holds a list of removed
  // *ids* and filters the prop. That works there because a booking id is unique
  // and never comes back; a row here is keyed by city|category|name, so
  // removing a place and adding it again would hand it a key already on the
  // removed list and the row would stay invisible.
  const [seenItems, setSeenItems] = useState(initialItems);
  if (initialItems !== seenItems) {
    setSeenItems(initialItems);
    setItems(initialItems);
  }

  // Which rows are expanded, by key. A Set rather than a single key: two
  // places you are comparing is exactly when you want both open.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    // Pencil's list card: white, radius 20, hairlines between rows — the
    // same card "מומלצים" above draws, so the two lists read as one system.
    <div className="overflow-hidden rounded-[20px] bg-surface shadow-card">
      <ul>
        {items.map((item, index) => {
          const key = keyOf(item);
          const isOpen = expanded.has(key);
          // Only worth expanding when there is more than the one line shows.
          // A place added by hand with no address has nothing behind the
          // chevron, and a chevron that opens onto its own subtitle is worse
          // than no chevron.
          const detail = item.description?.trim() ?? "";
          const canExpand = detail.length > 0;

          return (
          <li
            key={key}
            className="flex min-w-0 flex-col border-b border-border last:border-b-0"
          >
           <div className="flex min-w-0 items-center gap-3 px-4 py-3">
            {/* v6 (_4): the row's number, and it is the same number the map
                draws on its pin. The export numbers this list 1..N for exactly
                that reason — a list of six names beside a map of six pins is
                two lists until something ties them together. */}
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[0.6875rem] font-bold tabular-nums text-background"
            >
              {index + 1}
            </span>
            {/* A 44px thumbnail over the category tile — Pencil's list
                language. The tile shows whenever Wikipedia has no page for the
                place, which most hand-added places do not — see PlacePhoto. */}
            <PlacePhoto
              query={item.name}
              near={item.city}
              className="h-11 w-11 shrink-0 rounded-[14px]"
              // The same placeholder as the suggestions above. "Uniform" has
              // to mean the screen, not one list on it — two lists of cards
              // where only one keeps its shape is the same raggedness moved.
              fallback={
                <CategoryTile
                  category={item.category}
                  className="h-full w-full rounded-none"
                />
              }
            />
            <span className="min-w-0 flex-1">
              {/* Wrapped to a second line, not truncated: a place name is
                  whatever the user or the AI typed, and `truncate` in RTL clips
                  the start of a Latin string with the ellipsis off screen. Two
                  lines is what the design allows destination names. */}
              <span className="line-clamp-2 min-w-0 text-[0.9375rem] font-bold leading-5 wrap-anywhere">
                {item.name}
              </span>
              {/* One truncated line of context. For a hand-typed place this is
                  the address that was entered — without it the address would be
                  stored and never shown; for a guide item it is the start of the
                  AI's description. The city leads, because on a four-city trip
                  that is the fact you are scanning for. */}
              {/* One line at rest. The full text is behind the chevron —
                  before it, a guide description was stored, truncated to a
                  single line and unreadable in full anywhere in the app. */}
              <span className="block truncate text-caption text-muted">
                {item.city}
                {" · "}
                {detail || categoryLabel(item.category)}
              </span>
            </span>

            {canExpand && (
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={isOpen}
                aria-label={isOpen ? `סגירת התיאור של ${item.name}` : `מה יש ב${item.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-settle ease-snap",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
            )}
            {/* group/pick, not group: the row also sits inside whatever the
                caller wrapped it in, and an unnamed group would be captured by
                the nearest one. */}
            <button
              type="button"
              onClick={() => remove(item)}
              title={`הסרה של ${item.name} מהטיול`}
              aria-label={`הסרה של ${item.name} מהטיול`}
              className={cn(
                "group/pick flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                "bg-success text-white hover:bg-danger-tint hover:text-danger-ink",
                // Touch has no hover, so the swap below never happens there and
                // the control was a green check for its entire life — reported
                // as "removing them is not clear". On a coarse pointer it shows
                // what it does instead of what it is.
                //
                // Quiet rather than red: this is still a toggle of one boolean,
                // not a deletion, and law 05 keeps destructive colour out of a
                // row at rest. The tint arrives on press.
                "pointer-coarse:bg-surface-2 pointer-coarse:text-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Check
                className="h-5 w-5 animate-stamp group-hover/pick:hidden pointer-coarse:hidden"
                aria-hidden="true"
              />
              <X
                className="hidden h-5 w-5 group-hover/pick:block pointer-coarse:block"
                aria-hidden="true"
              />
            </button>
           </div>

            {/* Indented so the text lines up with the name above it: 1rem of
                row padding, the 1.5rem number, the 2.75rem thumbnail and two
                0.75rem gaps. The check moved to the row's far end with the
                Pencil restyle — the design's round control sits there on every
                list — so it is no longer in this sum. max-w-measure, because
                an AI description in a 372px pane is the one place in this
                component where a real paragraph lands. */}
            {canExpand && isOpen && (
              <p className="max-w-measure animate-rise pb-3 pe-4 ps-[6.75rem] text-caption leading-relaxed text-muted wrap-anywhere">
                {detail}
              </p>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
