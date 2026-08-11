"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addPlace } from "../application/place-actions";
import { PLACE_CATEGORIES } from "../domain/place";
import type { Place, PlaceCategory } from "../domain/place";
import { PlaceDetails } from "./place-details";

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[];

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: Place[] }
  | { kind: "error"; message: string };

export function PlaceSearch({
  tripId,
  cities,
  addedIds,
}: {
  tripId: string;
  // The trip's destinations, in route order — the filter's options.
  cities: string[];
  // OSM ids already in the trip, so results can say so instead of offering to
  // add them twice.
  addedIds: string[];
}) {
  const [city, setCity] = useState(cities[0] ?? "");
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState<Place | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set(addedIds));
  const [adding, setAdding] = useState<string | null>(null);

  async function add(place: Place) {
    setAdding(place.id);
    // Optimistic: the row is written server-side, and a failure rolls it back.
    setAdded((prev) => new Set(prev).add(place.id));

    const ok = await addPlace(tripId, city, place);
    if (!ok) {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
    }
    setAdding(null);
  }

  async function search(nextCategory: PlaceCategory | null) {
    if (!city) return;
    setCategory(nextCategory);
    setStatus({ kind: "searching" });

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          city,
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
          message: `לא הצלחנו לאתר את ${city} על המפה, אז אין סביב מה לחפש.`,
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

  if (cities.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-semibold">קודם בחרו יעדים</p>
        <p className="text-sm text-muted">
          החיפוש עובד סביב ערי הטיול, אז הוסיפו יעד אחד לפחות.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">יעד</span>
          <select
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setStatus({ kind: "idle" });
            }}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
          >
            {cities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search(category);
          }}
          className="flex min-w-48 flex-1 gap-2"
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש חופשי (למשל: ראמן)"
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={status.kind === "searching"}
          >
            חפש
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_KEYS.map((key) => {
          const isActive = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => void search(isActive ? null : key)}
              aria-pressed={isActive}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary",
              )}
            >
              {PLACE_CATEGORIES[key].emoji} {PLACE_CATEGORIES[key].label}
            </button>
          );
        })}
      </div>

      {status.kind === "searching" && (
        <p className="text-sm text-muted">מחפש ב־{city}…</p>
      )}

      {status.kind === "error" && (
        <p className="text-sm text-red-600">{status.message}</p>
      )}

      {status.kind === "results" && status.places.length === 0 && (
        <p className="text-sm text-muted">
          לא נמצאו תוצאות. נסו קטגוריה אחרת או חיפוש רחב יותר.
        </p>
      )}

      {status.kind === "results" && status.places.length > 0 && (
        <ul className="flex flex-col gap-2">
          {status.places.map((place) => (
            <li key={place.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setOpen(place)}
                  className="min-w-0 flex-1 text-start"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{place.name}</span>
                    {place.notable && (
                      <span
                        title="למקום יש ערך בוויקיפדיה"
                        className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        מוכר
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[place.brand, place.cuisine, place.openingHours]
                      .filter(Boolean)
                      .join(" · ") || place.address}
                  </span>
                </button>

                {added.has(place.id) ? (
                  <span className="shrink-0 text-sm text-muted">✓ בטיול</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void add(place)}
                    disabled={adding === place.id}
                    className="shrink-0"
                  >
                    הוסף
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <PlaceDetails place={open} city={city} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
