"use client";

import { useState } from "react";
import { Map as MapIcon, Navigation, X } from "lucide-react";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  SectionHeading,
  SegmentedControl,
  ToneDot,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/lib/maps";
import { withHebrewPrefix } from "@/lib/text";
import { deleteItineraryEntry } from "../application/itinerary-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { entryDestination, lodgingOrigin } from "../domain/directions";
import { DayTimeline } from "./day-timeline";
import { cityByDay } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";
import { dateOfDay, dayLabel, itineraryOverrun } from "../domain/trip-days";
import { NightStay } from "./night-stay";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";

// The graphic is the point of the feature, but a plain list stays available:
// it survives times the AI wrote in prose, and it's easier to scan on a phone.
type View = "timeline" | "list";

const VIEWS = [
  { id: "timeline", label: "ציר שעות" },
  { id: "list", label: "רשימה" },
] as const;

type ItineraryProps = {
  tripId: string;
  initialItinerary: ItineraryDay[];
  // Dates are derived, never stored — see domain/trip-days.ts. Null means the
  // trip has no departure date yet and days show as bare numbers.
  startDate?: string | null;
  endDate?: string | null;
  // Which lodging covers each day's night. Answers "where do I sleep on day 4"
  // — a hotel booked for five nights is a single booking with one check-in, so
  // listing bookings by their start date never told you.
  lodgingByDay?: Record<number, NightLodging>;
};

export function Itinerary({
  tripId,
  initialItinerary,
  startDate = null,
  endDate = null,
  lodgingByDay = {},
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
      if (!res.ok) {
        setError(await aiErrorFromResponse(res, 'בניית הלו"ז נכשלה. נסו שוב.'));
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
      <SectionHeading
        level="section"
        actions={
          <>
            {hasItinerary && (
              <SegmentedControl
                size="sm"
                aria-label="תצוגת הלוח"
                items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
                value={view}
                onChange={(id) => setView(id as View)}
              />
            )}
            <Button type="button" onClick={build} loading={building} size="sm">
              {hasItinerary ? "בנייה מחדש" : 'בנה לו"ז'}
            </Button>
          </>
        }
      >
        לו&quot;ז הטיול
      </SectionHeading>

      {error && <Banner tone="danger">{error}</Banner>}

      {/* An itinerary longer than the booked dates is a real planning error,
          so it is reported rather than clamped — clamping would make two days
          share a date and hide the problem. */}
      {overrun !== null && overrun > 0 && (
        <Banner tone="callout">
          הלו״ז נמשך {overrun === 1 ? "יום אחד" : `${overrun} ימים`} אחרי תאריך
          החזרה. אפשר לעדכן את התאריכים בטאב ״עוד״.
        </Banner>
      )}

      {!hasItinerary && !building && !error && (
        <EmptyState
          icon="🗓️"
          title='עוד אין לו"ז'
          description="אחרי שהוספתם פריטים לטיול, בנו לוח זמנים יומי בלחיצה אחת."
          action={
            <Button type="button" onClick={build} loading={building}>
              בניית לוח זמנים
            </Button>
          }
        />
      )}

      {/* Two panes from lg up: a day index that stays put, and the days
          themselves. Below that it is one column and the index is redundant,
          because the day headings are already the first thing you scroll past. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {hasItinerary && days.length > 1 && (
          <nav
            aria-label="ניווט בין ימי הטיול"
            className="sticky top-20 hidden w-44 shrink-0 flex-col gap-1 lg:flex"
          >
            {days.map((day) => {
              const city = [...day.items].reverse().find((it) => it.city)?.city;
              return (
                <a
                  key={day.day}
                  href={`#day-${day.day}`}
                  className={cn(
                    "flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors hover:bg-surface-2",
                    cityToneClass(tones, city ?? null),
                  )}
                >
                  <ToneDot className="h-2 w-2" />
                  <span className="truncate">
                    <span className="font-semibold">יום {day.day}</span>
                    {city && <span className="text-muted"> · {city}</span>}
                  </span>
                </a>
              );
            })}
          </nav>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {days.map((day) => {
            // A day belongs to the city it ends in — the same rule the route uses.
            const city = [...day.items].reverse().find((it) => it.city)?.city;

            // Directions start from wherever you slept that night, so both views
            // below offer the same route from the same origin.
            const stay = lodgingByDay[day.day] ?? null;
            const origin = stay ? lodgingOrigin(stay.booking) : null;

            return (
              <div
                key={day.day}
                id={`day-${day.day}`}
                // Clears the sticky header when the day index jumps here.
                className={cn(
                  "flex scroll-mt-20 flex-col gap-2",
                  cityToneClass(tones, city ?? null),
                )}
              >
                <SectionHeading level="sub" leading={<ToneDot />}>
                  {dayLabel(day.day, dateOfDay(startDate, day.day))}
                  {city && (
                    <span className="font-normal text-muted"> · {city}</span>
                  )}
                </SectionHeading>

                <NightStay stay={stay} />

                {view === "timeline" ? (
                  <DayTimeline day={day} onRemove={remove} origin={origin} />
                ) : (
                  <div className="flex flex-col gap-2">
                    {day.items.map((item) => {
                      const destination = entryDestination(item);
                      return (
                        <Card key={item.id} className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold">
                              {item.title}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="text-caption tabular-nums text-muted">
                                {item.startLabel}–{item.endLabel}
                              </span>
                              <IconButton
                                label="הסרה מהלוח"
                                size="sm"
                                variant="danger"
                                className="h-6 w-6"
                                onClick={() => remove(item.id)}
                              >
                                <X
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </IconButton>
                            </div>
                          </div>
                          {item.note && (
                            <p className="text-sm text-muted">{item.note}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
                            <a
                              href={googleMapsSearchUrl(item.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                            >
                              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              פתיחה ב-Google Maps
                            </a>
                            {origin && destination && (
                              <a
                                href={googleMapsDirectionsUrl(
                                  origin,
                                  destination,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 font-semibold text-primary-ink hover:underline"
                              >
                                <Navigation
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                איך מגיעים{" "}
                                {withHebrewPrefix(
                                  "מ",
                                  stay?.booking.title ?? "",
                                )}
                              </a>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
