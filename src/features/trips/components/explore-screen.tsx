import type { ReactNode } from "react";
import { TwoPane } from "@/components/layout";
import { Map as MapIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui";
import { savedCountsByCategory } from "../domain/place";
import type {
  AiCitySuggestion,
  CityGuideData,
  SelectedItem,
} from "../domain/ai-suggestion";
import type { AddedPlace } from "../infrastructure/place-service";
import { MoreBackLink } from "./more-back-link";
import { ManualPlaceForm } from "./manual-place-form";
import { PlaceSearch } from "./place-search";
import { RecommendedPlaces } from "./recommended-places";
import { PlanningPanel } from "./planning-panel";
import { SelectedList } from "./selected-list";

// The "תכנון" screen, in the design's order.
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
  cityGuide = null,
}: {
  tripId: string;
  searchCities: string[];
  knownCities: string[];
  selected: SelectedItem[];
  addedPlaces: AddedPlace[];
  savedCities: AiCitySuggestion[];
  map: ReactNode;
  // The saved guide for the first destination, for "מומלצים ב<עיר>". Null when
  // nothing has been generated for it yet.
  cityGuide?: CityGuideData | null;
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
          {/* v5: the workspace keeps the route map beside the panel at all
              times, so the small map that used to sit here is gone — a second
              copy of the same map, one column over, said nothing new. The
              `map` slot stays on the props for the callers still passing it. */}
          {map ? null : null}

          {/* Under the map, which is where the design puts it: these rows are
              the pins above them. On a phone the pane falls into the flow and
              this lands after the discovery panel — grid, then suggestions, then
              what you picked, which is the mockup's order exactly. */}
          {/* _4's header for this section, one to one: the title, a filled
              count pill beside it, and — at the far end — the quiet green note
              that these are the pins on the map. */}
          <section className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 text-lg font-semibold leading-6">
                נבחרו לטיול
              </h2>
              {selected.length > 0 && (
                <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-caption font-bold text-primary-ink">
                  {selected.length} מקומות
                </span>
              )}
              {selected.length > 0 && (
                <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-caption font-medium text-success-ink">
                  <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  מופיעים על המפה
                </span>
              )}
            </div>
            <SelectedList tripId={tripId} items={selected} />
          </section>
        </>
      }
    >
      {/* The band above names the trip and the app bar names the tab, so the
          screen needs no visible title of its own — and the design's first
          element under the search is the category grid. */}
      {/* v6: this screen is no longer a tab — "הוסף יעד" on the itinerary
          opens it — so it names itself and says the way back. */}
      <header className="flex min-w-0 flex-col gap-2">
        <MoreBackLink tripId={tripId} href={`/trips/${tripId}/days`} label="למסלול" />
        <h1 className="min-w-0 text-[1.75rem] font-bold leading-9 wrap-anywhere">
          הוספת מקומות ויעדים
        </h1>
        {/* The export's own sentence, and it names the city. "Search, browse by
            category, or get suggestions" described the three controls under it,
            which the controls already do; this says what the screen is for. */}
        <p className="min-w-0 max-w-measure text-sm text-muted">
          {searchCities[0]
            ? `כאן הטיול מתמלא בתוכן. בחרו מה לעשות, איפה לאכול ומה לראות ב${searchCities[0]}.`
            : "כאן הטיול מתמלא בתוכן. בחרו יעדים, ואז מה לעשות בכל אחד מהם."}
        </p>
      </header>

      <PlaceSearch
        tripId={tripId}
        cities={searchCities}
        addedPlaces={addedPlaces}
        savedCounts={savedCountsByCategory(selected)}
      />

      {/* _4 opens its results with "מומלצים ב<עיר>". Fed from the saved city
          guide, so what is recommended here is what was generated for that
          city rather than a second, unrelated list. */}
      {searchCities[0] && (
        <RecommendedPlaces
          tripId={tripId}
          city={searchCities[0]}
          guide={cityGuide}
        />
      )}

      <section id="discover" className="flex scroll-mt-20 flex-col gap-4">
        <SectionHeading
          level="section"
          tone="action"
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
