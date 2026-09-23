"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { HomeMap } from "./home-map";
import { HomePanel } from "./home-panel";
import type { MappedTrip } from "./trips-map-canvas";
import type { OpenItem } from "../domain/open-items";
import type { StandingTrip } from "../domain/trip-order";

// The home screen of the "מפה חיה" direction: the world map as the canvas, the
// panel floating over it, and — the whole reason this component exists — one
// piece of state shared between them.
//
// The map and the panel were siblings under a server component before, which
// meant neither could point at the other. Pressing a trip could only leave the
// screen, so the map behind the panel was a picture: it showed you that you had
// four trips and never which one was which. The selected trip is client state,
// and it has to be owned above both of them, so this is the thinnest possible
// client shell around the two: no data of its own, everything else still
// fetched and rendered on the server and handed down.
//
// `useState` and nothing else, per the project's standing note on Zustand —
// one boolean-ish value in one subtree is not a store.
export function HomeScreen({
  mapped,
  entries,
  featured,
  featuredCities,
  featuredDayCount,
  featuredOpen,
  dayCounts,
  footerAction,
}: {
  mapped: MappedTrip[];
  entries: StandingTrip[];
  featured: StandingTrip | null;
  featuredCities?: string[];
  featuredDayCount?: number;
  featuredOpen?: OpenItem[];
  dayCounts?: Map<string, number>;
  footerAction?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Nothing is selected at first, deliberately. Opening straight into the
  // featured trip would fly the map to one country before being asked, and
  // "where are all my trips" is the question this screen exists to answer.

  const locatedIds = useMemo(
    () => new Set(mapped.map((trip) => trip.id)),
    [mapped],
  );

  // A trip that was selected and then deleted, or that fell out of the list
  // when the server sent a new one, would otherwise keep the map dimmed around
  // a flag that is no longer there. Read during render rather than corrected in
  // an effect: the held id stays as it is, and what everything below sees is
  // the id only while it still names a trip.
  const selected =
    selectedId && entries.some((entry) => entry.trip.id === selectedId)
      ? selectedId
      : null;

  // Escape is the desktop way out, next to the map's own empty space and the
  // "כל הטיולים" button in the panel — a phone has neither a keyboard nor,
  // while the sheet is up, much map to press.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  // v6 (Stitch): a column of cards, not a map with a sheet over it. The trips
  // come first — the featured one as the lit card — and the world map is a
  // card of its own: under the list on a phone, beside it and sticky from lg.
  // Pressing a trip still marks it on the map, and a flag still selects a row.
  return (
    <main className="@container mx-auto grid w-full max-w-[66rem] flex-1 grid-cols-1 items-start gap-5 px-4 pb-12 pt-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-8 lg:pt-8">
      <div className="min-w-0">
        <HomePanel
          entries={entries}
          featured={featured}
          featuredCities={featuredCities}
          featuredDayCount={featuredDayCount}
          featuredOpen={featuredOpen}
          dayCounts={dayCounts}
          selectedId={selected}
          onSelect={select}
          locatedIds={locatedIds}
          footerAction={footerAction}
        />
      </div>

      {mapped.length > 0 && (
        <section
          aria-label="מפת הטיולים"
          className="relative h-72 min-w-0 overflow-hidden rounded-card bg-surface-2 shadow-card lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]"
        >
          <HomeMap trips={mapped} selectedId={selected} onSelect={select} />
        </section>
      )}
    </main>
  );
}
