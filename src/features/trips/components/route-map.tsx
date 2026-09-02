"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair, Globe, Map as MapIcon, Route } from "lucide-react";
import {
  Badge,
  Banner,
  EmptyState,
  glassClasses,
  ListRow,
  SectionHeading,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsRouteUrl } from "@/lib/maps";
import { stopsByCountry } from "../domain/route";
import { MapSheet } from "./map-sheet";
import { ResetLocationsButton } from "./reset-locations-button";
import { UnlocatedCities } from "./unlocated-cities";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { TripRoute } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";

// The map's height at each window class. It used to be a flat h-[26rem] at
// every width, repeated in four places — a phone-sized map centred in a 1440px
// screen. The canvas fills its frame now, so this is the only place it is set.
//
// Three numbers, and each one is the sum of what actually sits above the map at
// that width. All three were measured in the browser rather than reasoned about,
// because two of them were wrong:
//
//   < md   3.5rem  — the app bar, and nothing else. This tab *is* the map: the
//                    chips float on it and the stops arrive on a sheet over it.
//   md–lg  7.375rem — the app bar, plus the tab pill row (2.875rem) and the
//                    1rem above it. Measured at 768×900 the map overshot the
//                    window by exactly 62px, which is that row: the height had
//                    only ever counted the app bar.
//   ≥ lg   4.75rem  — the app bar plus the content column's own 1.25rem of top
//                    padding; the pill row is gone and the rail is beside, not
//                    above. This was 14rem, calibrated against the frame T0
//                    replaced, and at 1920×1000 it left the map ending 148px
//                    short of the bottom with nothing in the gap.
//
// Below the fold at every width: the reset button and any location warnings.
// That is where a maintenance action belongs.
//
// min-h so a short window (a laptop with devtools open) gets a usable map rather
// than a 200px strip.
const MAP_HEIGHT =
  "h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-7.375rem)] lg:h-[calc(100dvh-4.75rem)] lg:min-h-[26rem]";

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
  // Passed to the geocoder as context when the user re-names a city that could
  // not be placed.
  tripName,
}: {
  tripId: string;
  route: TripRoute;
  itinerary: ItineraryDay[];
  tripName?: string;
}) {
  const [focusCity, setFocusCity] = useState<string | null>(null);

  if (route.stops.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<MapIcon />}
          title="המפה תתמלא כשתבחרו יעדים"
          description="הוסיפו דברים לטיול מתוך מדריכי הערים, והתחנות יופיעו כאן לפי הסדר."
          className={MAP_HEIGHT + " justify-center"}
        />
        {/* The case where every city failed to resolve: without this the screen
            says "add some destinations" to somebody who already has several, and
            offers no way out of it. */}
        <UnlocatedCities
          tripId={tripId}
          cities={route.unlocatedCities}
          tripName={tripName}
        />
      </div>
    );
  }

  // The schedule is numbered by stop, not by day, so the two halves of the tab
  // refer to the same thing.
  const stopNumberByCity = new Map(
    route.stops.map((stop, index) => [stop.city, index + 1]),
  );
  const tones = cityToneMap(route.stops.map((stop) => stop.city));

  // Which city the map is looking at. Null is "the whole route", which is where
  // it starts and what the first chip goes back to.
  //
  // Held as a city name rather than a coordinate pair so the chip that is lit
  // and the place the map flew to cannot disagree — a pair would have to be
  // compared by value to work out which chip is active.
  const focus =
    focusCity === null
      ? null
      : (() => {
          const stop = route.stops.find(
            (candidate) => candidate.city === focusCity,
          );
          return stop
            ? ([stop.latitude, stop.longitude] as [number, number])
            : null;
        })();

  // Numbers stay global across the groups below — a stop's number matches its
  // pin on the map, and restarting the count per country would break that.
  // The whole route as one Google Maps link. Null under two stops, where a
  // "route" is a single pin.
  const walkingRouteUrl = googleMapsRouteUrl(
    route.stops.map((stop) => stop.city),
  );

  const countryGroups = stopsByCountry(route.stops);
  const showCountries = countryGroups.length > 1;

  return (
    // Two real panes from lg: the map holds still and the schedule scrolls
    // beside it, which is the layout the tab was always describing and never
    // had. Below lg it stacks, map first.
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Full-bleed on a phone: the negative margins undo AppShell's padding
            at each of its breakpoints, and -mt-5 cancels the top padding so the
            map meets the app bar. The band above it is hidden on this tab —
            see TripBandSlot. From lg it is a card in a column again. */}
        <div className="relative -mx-4 -mt-5 md:-mx-6 lg:mx-0 lg:mt-0">
          {/* Leaflet's zoom and attribution controls are laid out LTR; the map
              is a viewport rather than text, so it opts out of the app's RTL
              direction. The chips above it do not — they are text. */}
          <div
            dir="ltr"
            className={cn(
              "overflow-hidden border-border lg:rounded-card lg:border lg:shadow-soft",
              // Marks this as the map that reaches the window edges, which is
              // the only one whose attribution lands underneath the floating
              // phone bar. globals.css lifts it clear; the small maps inside cards
              // must not get that lift, because 6rem is most of their height.
              "map-fullbleed",
              MAP_HEIGHT,
            )}
          >
            <RouteMapCanvas
              stops={route.stops}
              places={route.places}
              focus={focus}
            />
          </div>

          {/* Floating over the map rather than sitting above it, and that is the
              point: the map is the content on this tab, so the controls belong
              on top of it. Glass because there is a moving photographic surface
              underneath — this is one of the three places in the app where
              translucency does something an opaque fill cannot.

              z-[500] no longer has to out-rank Leaflet: the canvas isolates its
              own stacking context (see route-map-canvas.tsx), so the whole map
              is one z-auto box and anything positive above it wins. The number
              stays because these chips also sit above the card's own shadow. */}
          {route.stops.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex gap-1.5 overflow-x-auto p-2">
              <button
                type="button"
                onClick={() => setFocusCity(null)}
                className={cn(
                  glassClasses("light"),
                  "pointer-events-auto shrink-0 rounded-full px-3.5 py-1.5 text-caption font-bold",
                  focusCity === null && "bg-foreground text-surface",
                )}
              >
                כל המסלול
              </button>
              {route.stops.map((stop) => (
                <button
                  key={stop.city}
                  type="button"
                  onClick={() => setFocusCity(stop.city)}
                  className={cn(
                    glassClasses("light"),
                    "pointer-events-auto min-w-0 shrink-0 rounded-full px-3.5 py-1.5 text-caption font-bold",
                    focusCity === stop.city && "bg-foreground text-surface",
                  )}
                >
                  <span className="block max-w-32 truncate">{stop.city}</span>
                </button>
              ))}
            </div>
          )}

          {/* The stops, on a sheet over the map — phone only. From lg they are
              the pane on the right, which is the same list and does not need a
              second presentation on the same screen. */}
          <MapSheet
            title={`התחנות של ${tripName ?? "הטיול"}`}
            action={
              walkingRouteUrl ? (
                <a
                  href={walkingRouteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-caption font-bold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  // The header is a button that toggles the sheet, and this sits
                  // inside it. Without this a tap on the link also toggles.
                  onClick={(event) => event.stopPropagation()}
                >
                  <Route className="h-3.5 w-3.5" aria-hidden="true" />
                  המסלול במפות
                </a>
              ) : null
            }
            items={route.stops.map((stop) => (
              <div
                key={stop.city}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 py-2",
                  cityToneClass(tones, stop.city),
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tone-dot text-caption font-black tabular-nums text-white">
                  {stopNumberByCity.get(stop.city)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="min-w-0 truncate text-sm font-bold">
                    {stop.city}
                  </span>
                  <span className="min-w-0 truncate text-caption text-muted">
                    {stop.days.length > 0
                      ? `ימים ${stop.days.join(", ")}${stop.nights > 0 ? ` · ${nightsLabel(stop.nights)}` : ""}`
                      : "עוד לא בלו״ז"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFocusCity(stop.city)}
                  aria-label={`הצג את ${stop.city} במפה`}
                  className="shrink-0 rounded-control p-1 text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          />
        </div>

        {/* A pin that quietly moves between two visits is its own kind of
            broken, so a correction is announced rather than just applied. */}
        {route.repairedCities.length > 0 && (
          <Banner tone="info">
            תיקנו את המיקום של {route.repairedCities.join(", ")} — הסיכה נחתה
            במדינה אחרת מכל שאר התחנות.
          </Banner>
        )}

        {/* Replaced a grey dead-end sentence that named the cities and offered
            nothing to do about them. See UnlocatedCities for why the question it
            asks is about the spelling rather than the coordinates. */}
        <UnlocatedCities
          tripId={tripId}
          cities={route.unlocatedCities}
          tripName={tripName}
        />

        <ResetLocationsButton tripId={tripId} />
      </div>

      <aside
        className={cn(
          "hidden w-full flex-col gap-4 lg:flex lg:w-pane lg:shrink-0",
          // Scrolls independently of the map, which is what makes this a pane
          // rather than a long column next to a short one. Same 4.75rem as
          // MAP_HEIGHT above, so the pane's top edge lines up with the map's
          // and both end at the bottom of the window.
          "lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-4.75rem)] lg:overflow-y-auto lg:pe-1",
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
                    <li
                      key={stop.city}
                      className={cityToneClass(tones, stop.city)}
                    >
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
                        <span className="min-w-0 truncate">{item.title}</span>
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
