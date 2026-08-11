"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { TripRoute } from "../domain/route";

// Leaflet has no server rendering — it needs a real DOM. Loading the canvas
// only in the browser keeps the rest of the page server-rendered.
const RouteMapCanvas = dynamic(() => import("./route-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="h-[26rem] w-full animate-pulse rounded-2xl bg-surface-2" />
  ),
});

function nightsLabel(nights: number) {
  if (nights === 0) return "";
  return nights === 1 ? "לילה אחד" : `${nights} לילות`;
}

export function RouteMap({
  route,
  itinerary,
}: {
  route: TripRoute;
  itinerary: ItineraryDay[];
}) {
  if (route.stops.length === 0) {
    return (
      <Card className="flex h-[26rem] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-semibold">המפה תתמלא כשתבחרו יעדים</p>
        <p className="text-sm text-muted">
          הוסיפו דברים לטיול מתוך מדריכי הערים, והתחנות יופיעו כאן לפי הסדר.
        </p>
      </Card>
    );
  }

  // The schedule is numbered by stop, not by day, so the two halves of the tab
  // refer to the same thing.
  const stopNumberByCity = new Map(
    route.stops.map((stop, index) => [stop.city, index + 1]),
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Leaflet's zoom/attribution controls are laid out LTR; the map is a
            viewport, not text, so it opts out of the app's RTL direction. */}
        <div
          dir="ltr"
          className="overflow-hidden rounded-2xl border border-border shadow-soft"
        >
          <RouteMapCanvas stops={route.stops} />
        </div>

        {route.unlocatedCities.length > 0 && (
          <p className="text-sm text-muted">
            לא הצלחנו למקם על המפה: {route.unlocatedCities.join(", ")}
          </p>
        )}
      </div>

      <aside className="flex w-full flex-col gap-3 lg:max-w-xs">
        <ol className="flex flex-col gap-2">
          {route.stops.map((stop, index) => (
            <li key={stop.city}>
              <Card className="flex items-center gap-3 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{stop.city}</span>
                  <span className="text-xs text-muted">
                    {stop.days.length > 0
                      ? `ימים ${stop.days.join(", ")}${
                          stop.nights > 0
                            ? ` · ${nightsLabel(stop.nights)}`
                            : ""
                        }`
                      : "עוד לא בלו״ז"}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        {itinerary.length > 0 && (
          <div className="flex flex-col gap-3">
            {itinerary.map((day) => {
              // The stop a day belongs to is decided by where it ends — the
              // same rule the route uses (see cityByDay).
              const city = [...day.items]
                .reverse()
                .find((item) => item.city)?.city;
              const stopNumber = city ? stopNumberByCity.get(city) : undefined;

              return (
                <div key={day.day} className="flex flex-col gap-1">
                  <h3 className="flex items-baseline gap-2 text-sm font-bold">
                    יום {day.day}
                    {stopNumber && (
                      <span className="text-xs font-normal text-muted">
                        תחנה {stopNumber} · {city}
                      </span>
                    )}
                  </h3>
                  <ul className="flex flex-col gap-0.5 border-s border-border ps-3 text-sm">
                    {day.items.map((item) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="shrink-0 text-xs text-muted">
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
