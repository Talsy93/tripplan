"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { deleteItineraryEntry } from "../application/itinerary-actions";
import type { ItineraryDay } from "../domain/ai-suggestion";

type ItineraryProps = {
  tripId: string;
  initialItinerary: ItineraryDay[];
};

export function Itinerary({ tripId, initialItinerary }: ItineraryProps) {
  const [days, setDays] = useState<ItineraryDay[]>(initialItinerary);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItinerary = days.some((day) => day.items.length > 0);

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
        <h2 className="text-lg font-bold">לו&quot;ז הטיול</h2>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasItinerary && !building && !error && (
        <p className="text-sm text-muted">
          אחרי שהוספתם פריטים לטיול, בנו לו&quot;ז יומי בלחיצה אחת.
        </p>
      )}

      {days.map((day) => (
        <div key={day.day} className="flex flex-col gap-2">
          <h3 className="font-bold">יום {day.day}</h3>
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
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
