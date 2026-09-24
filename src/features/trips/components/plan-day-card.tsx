"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarX2, Check, ChevronLeft, Plus, X } from "lucide-react";
import { buttonClasses, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { schedulePlaceOnDay } from "../application/itinerary-actions";
import { formatShortDate } from "../domain/trip";
import type { SchedulingDay, SchedulingPlan } from "../domain/schedule-new";
import { CategoryTile } from "./category-tile";

// "יום 4 · 18.9 · קיוטו", as one line.
function dayTitle(day: SchedulingDay): string {
  return [`יום ${day.day}`, day.date && formatShortDate(day.date), day.city]
    .filter(Boolean)
    .join(" · ");
}

// The day the route tab sent you here for (`?day=N`), at the top of the page.
//
// מסלול links an empty day here because this is where places are added — so the
// card answers the question the tap asked: what could go on this day. It lists
// the saved places of the day's city that are not on any day yet, each one tap
// from landing on it, and points at the search for anything else. A day that is
// not empty still gets the card, compactly, with what is already on it.
export function PlanDayCard({
  tripId,
  day,
  pending,
}: {
  tripId: string;
  day: SchedulingDay;
  pending: SchedulingPlan["pending"];
}) {
  const { showToast } = useToast();
  // Placed from this card, by name — shown checked until the server's refresh
  // takes them off the pending list.
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [saving, startSaving] = useTransition();
  const [busyName, setBusyName] = useState<string | null>(null);

  const candidates = pending.filter((place) => day.city && place.city === day.city);
  // Placed here but not yet in the refreshed day the server sends back.
  const extra = [...placed].filter((name) => !day.items.includes(name)).length;
  const count = day.items.length + extra;
  const empty = count === 0;

  function place(item: SchedulingPlan["pending"][number]) {
    setBusyName(item.name);
    startSaving(async () => {
      const result = await schedulePlaceOnDay(tripId, {
        name: item.name,
        city: item.city,
        dayNumber: day.day,
      });
      setBusyName(null);
      if (!result.ok) {
        showToast("השיבוץ נכשל. נסו שוב.", "danger");
        return;
      }
      setPlaced((prev) => new Set(prev).add(item.name));
      showToast(`${item.name} שובץ ליום ${day.day}`);
    });
  }

  return (
    <section
      aria-label={`יום ${day.day}`}
      className="flex min-w-0 flex-col gap-3 rounded-[22px] bg-primary-tint p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface",
            empty ? "text-cta" : "text-primary",
          )}
          aria-hidden="true"
        >
          {empty ? <CalendarX2 className="h-5 w-5" /> : <CalendarCheck2 className="h-5 w-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-bold text-primary-ink wrap-anywhere">{dayTitle(day)}</h2>
          <p className="text-caption text-primary-ink/80">
            {empty
              ? "עדיין ריק — מה נכניס אליו?"
              : count === 1
                ? "פריט אחד ביום"
                : `${count} פריטים ביום`}
          </p>
        </div>
        <Link
          href={`/trips/${tripId}/explore`}
          scroll={false}
          aria-label="סגירת היום"
          className="-me-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-ink transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {/* What is already on it, as one quiet line of names. */}
      {day.items.length > 0 && (
        <p className="rounded-[16px] bg-surface/70 px-3 py-2 text-caption text-foreground wrap-anywhere">
          {day.items.join(" · ")}
        </p>
      )}

      {candidates.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary-ink">
            שמורים ב{day.city} ועוד לא שובצו
          </p>
          <ul className="flex flex-col overflow-hidden rounded-[18px] bg-surface shadow-card">
            {candidates.map((item) => {
              const done = placed.has(item.name);
              return (
                <li
                  key={item.name}
                  className="flex min-w-0 items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
                >
                  <CategoryTile category={item.category} className="h-9 w-9 rounded-[12px]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {item.name}
                  </span>
                  {done ? (
                    <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-caption font-semibold text-success">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      שובץ
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => place(item)}
                      disabled={saving}
                      aria-busy={busyName === item.name || undefined}
                      className={buttonClasses("soft", "sm", "min-h-11 shrink-0 rounded-full px-3")}
                    >
                      שיבוץ ליום הזה
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        day.city && (
          <p className="text-caption text-primary-ink/80">
            אין ב{day.city} מקומות שמורים שעוד לא שובצו.
          </p>
        )
      )}

      <a
        href="#search"
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {day.city ? `חיפוש מקומות נוספים ב${day.city}` : "חיפוש מקומות נוספים"}
      </a>
    </section>
  );
}

// The days with nothing on them — moved here from מסלול, where they were a
// folded count. Each row opens the day card above (`?day=N`), which is the
// thing you would do about an empty day: find something for it.
export function EmptyDaysSection({
  tripId,
  days,
}: {
  tripId: string;
  days: SchedulingDay[];
}) {
  const empty = days.filter((day) => day.items.length === 0);
  if (empty.length === 0) return null;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="empty-days-heading">
      <h2 id="empty-days-heading" className="text-lg font-bold leading-6">
        {empty.length === 1 ? "יום אחד עדיין ריק" : `${empty.length} ימים עדיין ריקים`}
      </h2>
      <ul className="flex flex-col overflow-hidden rounded-[20px] bg-surface shadow-card">
        {empty.map((day) => (
          <li key={day.day} className="border-b border-border last:border-b-0">
            <Link
              href={`/trips/${tripId}/explore?day=${day.day}`}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <CalendarX2 className="h-5 w-5 shrink-0 text-cta" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold tabular-nums">
                  יום {day.day}
                  {day.date && ` · ${formatShortDate(day.date)}`}
                </span>
                <span className="truncate text-caption text-muted">
                  {day.city ?? "עוד לא ידוע באיזו עיר"}
                </span>
              </span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
