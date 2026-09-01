import type { ReactNode } from "react";
import { TwoPane } from "@/components/layout";
import { SectionHeading } from "@/components/ui";
import { savedCountsByCategory } from "../domain/place";
import type { AiCitySuggestion, SelectedItem } from "../domain/ai-suggestion";
import type { AddedPlace } from "../infrastructure/place-service";
import { ManualPlaceForm } from "./manual-place-form";
import { PlaceSearch } from "./place-search";
import { PlanningPanel } from "./planning-panel";
import { SelectedList } from "./selected-list";

// The "מה עושים?" screen, in the design's order.
//
// A component rather than JSX in the page, for the reason TodayBefore gives: the
// harness cannot render the page — the page reads the database — so a
// composition left there is one no scene can check.
//
// The order is the whole of T3's layout change. It was: a "לאן עכשיו?" heading,
// the search, the manual form, everything picked, then discovery. The design
// leads with the category grid, follows it with the one lit thing on the screen,
// and puts what you picked in the pane beside the map — because those rows are
// the pins on it.
export function ExploreScreen({
  tripId,
  // Destinations the search can look around: the cities things were already
  // added in.
  searchCities,
  // A wider set for the manual form — a city that was only *suggested* is still
  // somewhere the user is likely to be typing a place for.
  knownCities,
  selected,
  addedPlaces,
  savedCities,
  // The route map. A node rather than the trip, because resolving the route can
  // need to geocode a city — the page owns that boundary, and passing it in is
  // what lets a scene draw this layout without going to Nominatim.
  map,
}: {
  tripId: string;
  searchCities: string[];
  knownCities: string[];
  selected: SelectedItem[];
  addedPlaces: AddedPlace[];
  savedCities: AiCitySuggestion[];
  map: ReactNode;
}) {
  return (
    <TwoPane
      aside={
        <>
          {/* xl only, which is the width the pane itself appears at. Below it
              the pane's contents fall into the flow, and a map here would sit
              between the AI's offer and what you picked — while the מפה tab is
              one tap away and does the same job full-screen. The pane exists
              because a desktop can show results beside the map they are results
              on; a phone cannot, and stacking them is not the same thing. */}
          <section className="hidden flex-col gap-3 xl:flex">
            <SectionHeading level="section">איפה זה</SectionHeading>
            {map}
          </section>

          {/* Under the map, which is where the design puts it: these rows are
              the pins above them. On a phone the pane falls into the flow and
              this lands after the discovery panel — grid, then suggestions, then
              what you picked, which is the mockup's order exactly. */}
          <section className="flex flex-col gap-3">
            <SectionHeading
              level="section"
              actions={
                selected.length > 0 ? (
                  <span className="text-caption text-muted">
                    {selected.length} מקומות
                  </span>
                ) : undefined
              }
            >
              נבחרו לטיול
            </SectionHeading>
            <SelectedList tripId={tripId} items={selected} />
          </section>
        </>
      }
    >
      {/* The band above names the trip and the app bar names the tab, so the
          screen needs no visible title of its own — and the design's first
          element under the search is the category grid. */}
      <h1 className="sr-only">מה עושים?</h1>

      <PlaceSearch
        tripId={tripId}
        cities={searchCities}
        addedPlaces={addedPlaces}
        savedCounts={savedCountsByCategory(selected)}
      />

      <section className="flex flex-col gap-4">
        <SectionHeading
          level="section"
          description="תארו את הטיול ותקבלו יעדים להתחיל מהם"
        >
          גילוי יעדים
        </SectionHeading>
        <PlanningPanel tripId={tripId} initialCities={savedCities} />
      </section>

      {/* Last, not under the search. It used to sit directly below it so that a
          trip with no cities had a way forward at all — but for that trip the
          way forward is discovery above, not hand-typing a place into a city
          that does not exist yet. This is the escape hatch, and an escape hatch
          belongs at the bottom. */}
      <ManualPlaceForm tripId={tripId} cities={knownCities} />
    </TwoPane>
  );
}
