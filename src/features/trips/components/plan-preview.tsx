"use client";

import { Clock, ListPlus, Map as MapIcon, Wand2, X } from "lucide-react";
import { categoryLabel } from "../domain/place";
import { PLAN_TWEAKS, planTotals } from "../domain/trip-plan";
import type { AiTripPlan } from "../domain/trip-plan";
import { PlacePhoto } from "./place-photo";

// What the conversation would add to the trip, drawn as a Pencil card (after
// the Stitch day-plan card): a teal tile and a title, a count chip, two photos
// side by side, the stops on a spine, the screen's one terracotta call to
// action and quiet outlined presses under it.
//
// Nothing is saved until the traveller presses — and the line under the
// button says the add only adds.
export function PlanPreview({
  plan,
  applying,
  onApply,
  onDismiss,
  onTweak,
  tweaking = null,
}: {
  plan: AiTripPlan;
  applying: boolean;
  // Optional so the preview harness, which renders on the server and cannot
  // pass a function, can still draw the card.
  onApply?: () => void;
  onDismiss?: () => void;
  // Ask for the same plan with one thing changed. Absent in the harness, and
  // then the tuning row is not drawn at all — a row of chips that do nothing
  // is worse than no row.
  onTweak?: (instruction: string) => void;
  // Which tweak is in flight, so its own chip can say so. A single string
  // rather than a boolean: four chips and one spinner somewhere else is a
  // spinner that belongs to nothing.
  tweaking?: string | null;
}) {
  const { cities, items } = planTotals(plan);

  if (cities === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-[20px] bg-surface p-5 shadow-card">
        <p className="text-base font-semibold">עוד אין מספיק בשיחה</p>
        <p className="text-sm text-muted">
          השיחה עדיין לא הגיעה ליעדים מוגדרים. המשיכו לדבר ונסו שוב.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          סגירה
        </button>
      </div>
    );
  }

  const stops = plan.cities.flatMap((city) =>
    city.items.map((item) => ({ ...item, city: city.name })),
  );
  const photos = stops.slice(0, 2);
  const cityNames = plan.cities.map((city) => city.name);

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-[20px] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-tint text-primary"
          >
            <MapIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg leading-6 font-semibold text-foreground">
              המסלול מהשיחה
            </h3>
            <span className="block truncate text-xs text-muted">
              {cityNames.join(" · ")}
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-xs font-semibold text-success-ink">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {items} תחנות
        </span>
      </div>

      {plan.summary && (
        <p className="text-sm leading-relaxed text-muted">{plan.summary}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((stop) => (
            <div
              key={stop.name}
              className="relative h-28 overflow-hidden rounded-[14px] bg-surface-2"
            >
              <PlacePhoto
                query={stop.name}
                near={stop.city}
                className="absolute inset-0 bg-transparent"
              />
              <span className="absolute bottom-1.5 start-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-scrim px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-white backdrop-blur-[2px]">
                {stop.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <ol className="relative flex flex-col gap-2 ps-4">
        <span
          aria-hidden="true"
          className="absolute bottom-3 start-[5px] top-2 w-0.5 rounded-full bg-border"
        />
        {stops.map((stop, index) => (
          <li key={`${stop.city}-${stop.name}`} className="relative flex items-start gap-2">
            <span
              aria-hidden="true"
              className={
                index % 3 === 2
                  ? "absolute -start-4 top-3.5 h-3 w-3 rounded-full bg-cta ring-4 ring-cta-tint"
                  : "absolute -start-4 top-3.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary-tint"
              }
            />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[14px] border border-border px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-[0.6875rem] leading-4 font-semibold text-primary">
                    {categoryLabel(stop.category)}
                  </span>
                  <span className="min-w-0 truncate text-[0.9375rem] leading-[1.375rem] font-semibold text-foreground">
                    {stop.name}
                  </span>
                </div>
                <p className="text-xs text-muted">{stop.description}</p>
              </div>
              <span className="shrink-0 text-[0.6875rem] font-medium text-outline">
                {stop.city}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1 pt-0.5">
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-cta px-4 py-2 text-[0.9375rem] font-semibold text-cta-foreground shadow-soft transition-all hover:bg-cta-hover active:scale-[0.98] disabled:opacity-60"
        >
          <ListPlus className="h-5 w-5" aria-hidden="true" />
          {applying
            ? "מוסיף…"
            : `הוסף למסלול שלי (${cities === 1 ? "עיר אחת" : `${cities} ערים`}, ${items} פריטים)`}
        </button>
        <div className="mt-0.5 flex items-center gap-1">
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-11 flex-1 items-center justify-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            לא עכשיו
          </button>
        </div>
        {/* The tuning row the export draws under the card — "swap the lunch
            place", "make it vegetarian".

            It is a revision and not a new plan, which is the whole point: the
            traveller has something they are broadly happy with and wants one
            thing different. See /api/ai/refine-plan, whose prompt says to
            return everything the request did not touch unchanged.

            Each press is a model round, so the chips disable together while one
            is running — four chips you can queue up is four calls against a
            twenty-a-day quota. */}
        {onTweak && (
          <div className="mt-1 flex flex-wrap gap-2">
            {PLAN_TWEAKS.map((tweak) => (
              <button
                key={tweak}
                type="button"
                onClick={() => onTweak(tweak)}
                disabled={tweaking !== null || applying}
                className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-60"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                {tweaking === tweak ? "מעדכן…" : tweak}
              </button>
            ))}
          </div>
        )}

        {/* The reassurance that makes the button safe to press. */}
        <p className="mt-1 text-[0.6875rem] leading-4 text-muted">
          ההוספה לא מוחקת כלום ממה שכבר בחרתם, וכל פריט ניתן להסרה.
        </p>
      </div>
    </div>
  );
}
