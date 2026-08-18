"use client";

import { useState, useTransition } from "react";
import { BedDouble, Check, Pencil } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  IconButton,
  Input,
  SectionHeading,
  Surface,
  ToneDot,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { setCityDays } from "../application/itinerary-actions";
import { cityDayTotals } from "../domain/city-days";
import { cityToneClass, cityToneMap } from "../domain/tone";
import type { CityDayPlan } from "../domain/city-days";

// How long the trip stays in each city — the number that decides the itinerary.
//
// The plan arrives computed from the server (see domain/city-days.ts for why it
// is not recomputed here) and this screen does two things: show where each
// number came from, and let it be overridden.
//
// Showing the source is the point. "4 ימים · מהלינה" tells the user the app read
// their hotel booking, which is the difference between a number they trust and a
// number that appeared for no reason.
export function CityDaysEditor({
  tripId,
  plan,
  tripDayCount,
}: {
  tripId: string;
  plan: CityDayPlan[];
  // Days the trip's own dates allow, or null when it has no dates yet.
  tripDayCount: number | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tones = cityToneMap(plan.map((entry) => entry.city));
  const totals = cityDayTotals(plan, tripDayCount);

  if (plan.length === 0) return null;

  function save(city: string) {
    setError(null);
    const trimmed = draft.trim();
    // An empty field clears the override and hands the city back to its booking.
    const days = trimmed === "" ? null : Number(trimmed);

    if (days !== null && !Number.isFinite(days)) {
      setError("צריך מספר");
      return;
    }

    startTransition(async () => {
      const result = await setCityDays(tripId, { city, days });
      if (!result.ok) {
        setError(result.error ?? "השמירה נכשלה");
        return;
      }
      setEditing(null);
    });
  }

  return (
    <Surface tone="quiet" className="flex flex-col gap-3">
      <SectionHeading
        level="sub"
        description="הבסיס לבניית הלוח. ברירת המחדל היא הלינה שהזמנתם."
      >
        ימים בכל עיר
      </SectionHeading>

      <ul className="flex flex-col gap-1.5">
        {plan.map((entry) => {
          const isEditing = editing === entry.city;

          return (
            <li
              key={entry.city}
              className={cn(
                "flex items-center gap-2 rounded-control bg-surface px-3 py-2",
                cityToneClass(tones, entry.city),
              )}
            >
              <ToneDot />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {entry.city}
              </span>

              {isEditing ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    inputMode="numeric"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        save(entry.city);
                      }
                      if (event.key === "Escape") setEditing(null);
                    }}
                    placeholder="ריק = לפי הלינה"
                    autoFocus
                    dir="ltr"
                    className="h-8 w-32 text-center"
                  />
                  <Button
                    size="sm"
                    onClick={() => save(entry.city)}
                    loading={pending}
                  >
                    שמירה
                  </Button>
                </>
              ) : (
                <>
                  {entry.days === null ? (
                    <Badge tone="neutral">ה-AI יחליט</Badge>
                  ) : (
                    <>
                      <span className="text-sm tabular-nums">
                        {entry.days === 1 ? "יום אחד" : `${entry.days} ימים`}
                      </span>
                      {entry.source === "lodging" ? (
                        <Badge tone="action">
                          <BedDouble
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          מהלינה
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          נקבע ידנית
                        </Badge>
                      )}
                    </>
                  )}
                  <IconButton
                    label={`עריכת מספר הימים ב${entry.city}`}
                    size="sm"
                    onClick={() => {
                      setEditing(entry.city);
                      setDraft(entry.days === null ? "" : String(entry.days));
                      setError(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {error && <Banner tone="danger">{error}</Banner>}

      {/* Reported and not clamped, the same way itineraryOverrun is: shrinking a
          city on the user's behalf would hide the conflict they need to fix. */}
      {totals.overBy > 0 && (
        <Banner tone="callout">
          הערים מבקשות {totals.plannedDays} ימים, אבל התאריכים שהגדרתם נותנים{" "}
          {tripDayCount}. צריך להוריד {totals.overBy}{" "}
          {totals.overBy === 1 ? "יום" : "ימים"}, או להאריך את הטיול ב״עוד ←
          פרטי הטיול״.
        </Banner>
      )}

      {totals.plannedDays !== null && totals.overBy === 0 && (
        <p className="text-caption text-muted">
          סך הכול {totals.plannedDays} ימים מתוכננים
          {totals.undecidedCities > 0 &&
            ` · ${totals.undecidedCities} ערים ללא מספר`}
          .
        </p>
      )}
    </Surface>
  );
}
