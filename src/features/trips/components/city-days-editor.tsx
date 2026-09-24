"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { Banner, ToneDot } from "@/components/ui";
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
// Showing the source is the point. "לפי הלינה" under a city tells the user the
// app read their hotel booking, which is the difference between a number they
// trust and a number that appeared for no reason.
//
// Pencil (phase PN) draws the override as a −/+ stepper on each row rather
// than a pencil that opens a field. A stay is changed a day at a time — "one
// more night in Rome" — and a stepper says that in one press where the field
// took four. Each press is its own write, shown optimistically so the number
// moves under the finger rather than after the round trip.
//
// No heading of its own: both callers already say what this is — the empty
// state's "בואו נבנה את הלו״ז", and the pane's "המסלול כולו".
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(
    plan,
    (current, change: { city: string; days: number | null }) =>
      current.map((entry) =>
        entry.city === change.city
          ? {
              ...entry,
              days: change.days,
              // A cleared override falls back to whatever the server decides;
              // "unset" is the honest thing to show until it answers.
              source: change.days === null ? ("unset" as const) : ("override" as const),
            }
          : entry,
      ),
  );

  const tones = cityToneMap(plan.map((entry) => entry.city));
  const totals = cityDayTotals(shown, tripDayCount);

  if (plan.length === 0) return null;

  function save(city: string, days: number | null) {
    setError(null);
    startTransition(async () => {
      setShown({ city, days });
      const result = await setCityDays(tripId, { city, days });
      if (!result.ok) setError(result.error ?? "השמירה נכשלה");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {shown.map((entry) => {
          const days = entry.days;
          return (
            <li
              key={entry.city}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-[16px] bg-surface px-4 py-2 shadow-card",
                cityToneClass(tones, entry.city),
              )}
            >
              <ToneDot />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.9375rem] font-semibold">
                  {entry.city}
                </span>
                <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
                  {entry.source === "lodging"
                    ? "לפי הלינה"
                    : entry.source === "override"
                      ? "נקבע ידנית"
                      : "ה-AI יחליט"}
                  {/* The way back to the booking's number. Only on a manual
                      value — the other two already are the default. */}
                  {entry.source === "override" && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => save(entry.city, null)}
                        disabled={pending}
                        className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        איפוס
                      </button>
                    </>
                  )}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <StepButton
                  label={`יום נוסף ב${entry.city}`}
                  disabled={pending || (days ?? 0) >= 60}
                  onClick={() => save(entry.city, (days ?? 0) + 1)}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </StepButton>
                <span
                  className="min-w-[3.25rem] text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {days === null ? "—" : days === 1 ? "יום אחד" : `${days} ימים`}
                </span>
                <StepButton
                  label={`יום אחד פחות ב${entry.city}`}
                  disabled={pending || days === null || days <= 1}
                  onClick={() => days !== null && save(entry.city, days - 1)}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </StepButton>
              </span>
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
        <p className="flex items-baseline justify-between gap-2 px-1 pt-1 text-caption">
          <span className="text-muted">סה״כ</span>
          <span className="font-semibold text-success tabular-nums">
            {totals.plannedDays} ימים
            {tripDayCount !== null && ` מתוך ${tripDayCount}`}
            {totals.undecidedCities > 0 &&
              ` · ${totals.undecidedCities} ערים ללא מספר`}
          </span>
        </p>
      )}
    </div>
  );
}

// The round −/+ of the stepper. Outlined, because it is a secondary control
// beside a number rather than an action of its own.
function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-[background-color,transform] duration-press ease-snap hover:bg-surface-2 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
