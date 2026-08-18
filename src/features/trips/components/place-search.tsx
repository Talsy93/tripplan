"use client";

import { useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  Input,
  ListRow,
  SectionHeading,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addPlace } from "../application/place-actions";
import { PLACE_CATEGORIES } from "../domain/place";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { PlaceCategory } from "../domain/place";
import type { Place } from "../domain/place";
import type { AddedPlace } from "../infrastructure/place-service";
import { PlaceDetails } from "./place-details";

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[];

// A place is in the trip whether or not the itinerary has been built since —
// so "in the trip" is the fallback, and a day is the better news when we have
// it.
function dayLabel(days: number[]) {
  if (days.length === 0) return "בטיול";
  if (days.length === 1) return `יום ${days[0]}`;
  return `ימים ${days.join(", ")}`;
}

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: Place[] }
  | { kind: "error"; message: string };

export function PlaceSearch({
  tripId,
  cities,
  addedPlaces,
  savedCounts,
}: {
  tripId: string;
  // The trip's destinations, in route order — the filter's options.
  cities: string[];
  // Places already in the trip, with the itinerary days they're scheduled on,
  // so results can say so instead of offering to add them twice.
  addedPlaces: AddedPlace[];
  // How many things the trip already holds per category, for the tiles.
  savedCounts: Record<PlaceCategory, number>;
}) {
  const [city, setCity] = useState(cities[0] ?? "");
  // Null means the category grid — the screen this tab opens on.
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState<Place | null>(null);
  const [added, setAdded] = useState<Map<string, number[]>>(
    () => new Map(addedPlaces.map((place) => [place.externalId, place.days])),
  );
  const [adding, setAdding] = useState<string | null>(null);

  const tones = cityToneMap(cities);

  async function add(place: Place) {
    setAdding(place.id);
    // Optimistic: the row is written server-side, and a failure rolls it back.
    // No days yet — it only gets scheduled when the itinerary is next built.
    setAdded((prev) => new Map(prev).set(place.id, []));

    const ok = await addPlace(tripId, city, place);
    if (!ok) {
      setAdded((prev) => {
        const next = new Map(prev);
        next.delete(place.id);
        return next;
      });
    }
    setAdding(null);
  }

  async function search(
    nextCategory: PlaceCategory | null,
    nextCity: string = city,
  ) {
    if (!nextCity) return;
    setStatus({ kind: "searching" });

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          city: nextCity,
          category: nextCategory ?? undefined,
          query: query.trim() || undefined,
        }),
      });

      if (res.status === 429) {
        setStatus({
          kind: "error",
          message: "יותר מדי חיפושים. נסו שוב בעוד רגע.",
        });
        return;
      }
      if (res.status === 503) {
        // Overpass is a shared service — this is "busy", not "broken", and the
        // difference matters to whether the user bothers trying again.
        setStatus({
          kind: "error",
          message: "שירות המפות עמוס כרגע. נסו שוב בעוד כמה שניות.",
        });
        return;
      }
      if (res.status === 422) {
        setStatus({
          kind: "error",
          message: `לא הצלחנו לאתר את ${nextCity} על המפה, אז אין סביב מה לחפש.`,
        });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: "החיפוש נכשל. נסו שוב." });
        return;
      }

      const data: { places: Place[] } = await res.json();
      setStatus({ kind: "results", places: data.places ?? [] });
    } catch {
      setStatus({ kind: "error", message: "שגיאת רשת. נסו שוב." });
    }
  }

  function openCategory(key: PlaceCategory) {
    setCategory(key);
    void search(key);
  }

  function backToGrid() {
    setCategory(null);
    setStatus({ kind: "idle" });
    setQuery("");
  }

  if (cities.length === 0) {
    return (
      <EmptyState
        icon="🧭"
        title="קודם בחרו יעדים"
        description="החיפוש עובד סביב ערי הטיול, אז הוסיפו יעד אחד לפחות."
      />
    );
  }

  // ---- The grid: where this tab starts -------------------------------------
  if (category === null) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {CATEGORY_KEYS.map((key) => {
          const meta = PLACE_CATEGORIES[key];
          const count = savedCounts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => openCategory(key)}
              // The tiles used to be filled with one of the six pastels, keyed
              // to the category's index. That was six saturated blocks on the
              // opening screen of the tab, and the colour meant nothing — the
              // pastels identify cities, not categories. Neutral now; the emoji
              // is the identity and the count is the information.
              className={cn(
                "flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-start shadow-soft transition-shadow",
                "hover:border-border-strong hover:shadow-lift",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <span className="text-display leading-none" aria-hidden="true">
                {meta.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold">{meta.label}</span>
                <span className="text-caption text-muted">
                  {count > 0 ? `${count} בטיול` : "לחיפוש"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // ---- One category --------------------------------------------------------
  const meta = PLACE_CATEGORIES[category];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={backToGrid}
        className="flex items-center gap-1 self-start rounded-control text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        חזרה לקטגוריות
      </button>

      <SectionHeading
        level="section"
        leading={<span aria-hidden="true">{meta.emoji}</span>}
      >
        {meta.label}
      </SectionHeading>

      {cities.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cities.map((option) => (
            <Chip
              key={option}
              active={option === city}
              onClick={() => {
                setCity(option);
                void search(category, option);
              }}
            >
              {option}
            </Chip>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search(category);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`חיפוש בתוך ${meta.label}`}
            className="ps-9"
          />
        </div>
        <Button type="submit" loading={status.kind === "searching"}>
          חיפוש
        </Button>
      </form>

      {status.kind === "searching" && (
        <p className="text-sm text-muted">מחפש ב־{city}…</p>
      )}

      {status.kind === "error" && (
        <Banner tone="danger">{status.message}</Banner>
      )}

      {status.kind === "results" && status.places.length === 0 && (
        <EmptyState
          icon="🔍"
          title="לא נמצאו תוצאות"
          description="נסו קטגוריה אחרת, עיר אחרת, או חיפוש רחב יותר."
        />
      )}

      {status.kind === "results" && status.places.length > 0 && (
        <ul className="grid gap-2 xl:grid-cols-2">
          {status.places.map((place) => {
            const days = added.get(place.id);
            return (
              <li key={place.id} className={cityToneClass(tones, city)}>
                <ListRow
                  accent="tone"
                  title={
                    <button
                      type="button"
                      onClick={() => setOpen(place)}
                      className="flex min-w-0 items-center gap-2 rounded text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate">{place.name}</span>
                      {place.notable && (
                        <Badge
                          tone="action"
                          title="למקום יש ערך בוויקיפדיה"
                          className="shrink-0"
                        >
                          מוכר
                        </Badge>
                      )}
                    </button>
                  }
                  subtitle={
                    [place.brand, place.cuisine, place.openingHours]
                      .filter(Boolean)
                      .join(" · ") ||
                    place.address ||
                    undefined
                  }
                  trailing={
                    days ? (
                      <Badge tone="success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {dayLabel(days)}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        onClick={() => void add(place)}
                        loading={adding === place.id}
                      >
                        הוספה
                      </Button>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <PlaceDetails place={open} city={city} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
