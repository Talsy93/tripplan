"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsSearchUrl } from "@/lib/maps";
import { deleteItineraryEntry } from "../application/itinerary-actions";
import { DayTimeline } from "./day-timeline";
import { cityByDay } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";
import { dateOfDay, dayLabel, itineraryOverrun } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";

// The graphic is the point of the feature, but a plain list stays available:
// it survives times the AI wrote in prose, and it's easier to scan on a phone.
type View = "timeline" | "list";

type ItineraryProps = {
  tripId: string;
  initialItinerary: ItineraryDay[];
  // Dates are derived, never stored — see domain/trip-days.ts. Null means the
  // trip has no departure date yet and days show as bare numbers.
  startDate?: string | null;
  endDate?: string | null;
};

export function Itinerary({
  tripId,
  initialItinerary,
  startDate = null,
  endDate = null,
}: ItineraryProps) {
  const [days, setDays] = useState<ItineraryDay[]>(initialItinerary);
  const [view, setView] = useState<View>("timeline");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItinerary = days.some((day) => day.items.length > 0);

  // Cities in visiting order — cityByDay is keyed by day, and day order is
  // route order, so this produces the same assignment the map and the hero use.
  const tones = cityToneMap([...cityByDay(days).values()]);
  const overrun = itineraryOverrun(startDate, endDate, days.length);

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (res.status === 400) {
        setError("צריך קודם להוסיף פריטים לטיול (בקטגוריות של העיר).");
        return;
      }
      if (res.status === 429) {
        setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError('בניית הלו"ז נכשלה. נסו שוב.');
        return;
      }

      const data: { days: ItineraryDay[] } = await res.json();
      setDays(data.days ?? []);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setBuilding(false);
    }
  }

  function remove(entryId: string) {
    setDays((prev) =>
      prev
        .map((day) => ({
          ...day,
          items: day.items.filter((item) => item.id !== entryId),
        }))
        .filter((day) => day.items.length > 0),
    );
    void deleteItineraryEntry(entryId);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg">לו&quot;ז הטיול</h2>

        {hasItinerary && (
          <div className="flex gap-1 rounded-full border border-border bg-surface-2 p-0.5 text-xs">
            {(
              [
                ["timeline", "ציר שעות"],
                ["list", "רשימה"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors",
                  view === id
                    ? "bg-surface text-foreground shadow-soft"
                    : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          onClick={build}
          disabled={building}
          className="ms-auto"
          size="sm"
        >
          {building ? "בונה…" : hasItinerary ? "בנה מחדש" : 'בנה לו"ז'}
        </Button>
      </div>

      {error && <p className="text-sm text-danger-ink">{error}</p>}

      {/* An itinerary longer than the booked dates is a real planning error,
          so it is reported rather than clamped — clamping would make two days
          share a date and hide the problem. */}
      {overrun !== null && overrun > 0 && (
        <p className="rounded-control bg-warning-tint px-3 py-2 text-sm text-warning-ink">
          הלו״ז נמשך {overrun === 1 ? "יום אחד" : `${overrun} ימים`} אחרי תאריך
          החזרה. אפשר לעדכן את התאריכים בטאב ״עוד״.
        </p>
      )}

      {!hasItinerary && !building && !error && (
        <p className="text-sm text-muted">
          אחרי שהוספתם פריטים לטיול, בנו לו&quot;ז יומי בלחיצה אחת.
        </p>
      )}

      {days.map((day) => {
        // A day belongs to the city it ends in — the same rule the route uses.
        const city = [...day.items].reverse().find((it) => it.city)?.city;

        return (
        <div
          key={day.day}
          className={`flex flex-col gap-2 ${cityToneClass(tones, city ?? null)}`}
        >
          <h3 className="flex items-center gap-2 font-bold">
            <span className="h-2.5 w-2.5 rounded-full bg-tone-dot" />
            {dayLabel(day.day, dateOfDay(startDate, day.day))}
            {city && (
              <span className="text-xs font-normal text-tone-ink">{city}</span>
            )}
          </h3>
          {view === "timeline" ? (
            <DayTimeline day={day} onRemove={remove} />
          ) : (
            <div className="flex flex-col gap-2">
              {day.items.map((item) => (
                <Card key={item.id} className="flex flex-col gap-1 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{item.title}</span>
                    <div className="flex shrink-0 items-baseline gap-3">
                      <span className="text-xs text-muted">
                        {item.startLabel}–{item.endLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label="הסר מהלו״ז"
                        className="text-muted transition-colors hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {item.note && (
                    <p className="text-sm text-muted">{item.note}</p>
                  )}
                  <a
                    href={googleMapsSearchUrl(item.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start text-xs text-primary hover:underline"
                  >
                    🗺️ פתח ב-Google Maps
                  </a>
                </Card>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </section>
  );
}
