"use client";

import dynamic from "next/dynamic";
import { Globe } from "lucide-react";
import { Badge, Banner, EmptyState, ListRow, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/cn";
import { stopsByCountry } from "../domain/route";
import { ResetLocationsButton } from "./reset-locations-button";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { TripRoute } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";

// The map's height at each window class. It used to be a flat h-[26rem] at
// every width, repeated in four places — a phone-sized map centred in a 1440px
// screen. The canvas fills its frame now, so this is the only place it is set.
const MAP_HEIGHT = "h-[20rem] sm:h-[24rem] lg:h-[calc(100dvh-14rem)] lg:min-h-[26rem]";

// Leaflet has no server rendering — it needs a real DOM. Loading the canvas
// only in the browser keeps the rest of the page server-rendered.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

function nightsLabel(nights: number) {
  if (nights === 0) return "";
  return nights === 1 ? "לילה אחד" : `${nights} לילות`;
}

export function RouteMap({
  tripId,
  route,
  itinerary,
}: {
  tripId: string;
  route: TripRoute;
  itinerary: ItineraryDay[];
}) {
  if (route.stops.length === 0) {
    return (
      <EmptyState
        icon="🗺️"
        title="המפה תתמלא כשתבחרו יעדים"
        description="הוסיפו דברים לטיול מתוך מדריכי הערים, והתחנות יופיעו כאן לפי הסדר."
        className={MAP_HEIGHT + " justify-center"}
      />
    );
  }

  // The schedule is numbered by stop, not by day, so the two halves of the tab
  // refer to the same thing.
  const stopNumberByCity = new Map(
    route.stops.map((stop, index) => [stop.city, index + 1]),
  );
  const tones = cityToneMap(route.stops.map((stop) => stop.city));

  // Numbers stay global across the groups below — a stop's number matches its
  // pin on the map, and restarting the count per country would break that.
  const countryGroups = stopsByCountry(route.stops);
  const showCountries = countryGroups.length > 1;

  return (
    // Two real panes from lg: the map holds still and the schedule scrolls
    // beside it, which is the layout the tab was always describing and never
    // had. Below lg it stacks, map first.
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Leaflet's zoom/attribution controls are laid out LTR; the map is a
            viewport, not text, so it opts out of the app's RTL direction. */}
        <div
          dir="ltr"
          className={cn(
            "overflow-hidden rounded-card border border-border shadow-soft",
            MAP_HEIGHT,
          )}
        >
          <RouteMapCanvas stops={route.stops} />
        </div>

        {/* A pin that quietly moves between two visits is its own kind of
            broken, so a correction is announced rather than just applied. */}
        {route.repairedCities.length > 0 && (
          <Banner tone="info">
            תיקנו את המיקום של {route.repairedCities.join(", ")} — הסיכה נחתה
            במדינה אחרת מכל שאר התחנות.
          </Banner>
        )}

        {route.unlocatedCities.length > 0 && (
          <p className="text-sm text-muted">
            לא הצלחנו למקם על המפה: {route.unlocatedCities.join(", ")}
          </p>
        )}

        <ResetLocationsButton tripId={tripId} />
      </div>

      <aside
        className={cn(
          "flex w-full flex-col gap-4 lg:w-pane lg:shrink-0",
          // Scrolls independently of the map, which is what makes this a pane
          // rather than a long column next to a short one.
          "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto lg:pe-1",
        )}
      >
        <div className="flex flex-col gap-2">
          <SectionHeading level="sub">התחנות</SectionHeading>
          {/* Grouped by country only when the trip actually crosses one. A
              single heading over every stop is a label that says nothing, and
              it costs a line of vertical space on a phone. */}
          <ol className="flex flex-col gap-2">
            {countryGroups.map((group, groupIndex) => (
              <li key={`${group.country ?? "unknown"}-${groupIndex}`}>
                {showCountries && (
                  <h4 className="flex items-center gap-1.5 pb-1.5 pt-1 text-caption font-bold text-muted">
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    {group.country ?? "יעדים ללא מיקום"}
                  </h4>
                )}
                <ol className="flex flex-col gap-2">
                  {group.stops.map((stop) => (
                    <li key={stop.city} className={cityToneClass(tones, stop.city)}>
                      <ListRow
                        leading={
                          <Badge
                            tone="tone"
                            variant="solid"
                            className="h-6 w-6 justify-center p-0 tabular-nums"
                          >
                            {stopNumberByCity.get(stop.city)}
                          </Badge>
                        }
                        title={stop.city}
                        subtitle={
                          stop.days.length > 0
                            ? `ימים ${stop.days.join(", ")}${
                                stop.nights > 0
                                  ? ` · ${nightsLabel(stop.nights)}`
                                  : ""
                              }`
                            : "עוד לא בלו״ז"
                        }
                      />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </div>

        {itinerary.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeading level="sub">הלוח, לפי תחנה</SectionHeading>
            {itinerary.map((day) => {
              // The stop a day belongs to is decided by where it ends — the
              // same rule the route uses (see cityByDay).
              const city = [...day.items]
                .reverse()
                .find((item) => item.city)?.city;
              const stopNumber = city ? stopNumberByCity.get(city) : undefined;

              return (
                <div
                  key={day.day}
                  className={cn(
                    "flex flex-col gap-1",
                    cityToneClass(tones, city ?? null),
                  )}
                >
                  <h4 className="flex items-baseline gap-2 text-sm font-bold">
                    יום {day.day}
                    {stopNumber && (
                      <span className="font-normal text-muted">
                        תחנה {stopNumber} · {city}
                      </span>
                    )}
                  </h4>
                  <ul className="flex flex-col gap-0.5 border-s-2 border-tone-dot ps-3 text-sm">
                    {day.items.map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="shrink-0 text-caption tabular-nums text-muted">
                          {item.startLabel}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
