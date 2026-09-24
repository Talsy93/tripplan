import type { ReactNode } from "react";
import { TwoPane } from "@/components/layout";
import Link from "next/link";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import type {
  AiCitySuggestion,
  CityGuideData,
  SelectedItem,
} from "../domain/ai-suggestion";
import type { AddedPlace } from "../infrastructure/place-service";
import { ManualPlaceForm } from "./manual-place-form";
import { PlaceSearch } from "./place-search";
import { RecommendedPlaces } from "./recommended-places";
import { PlanningPanel } from "./planning-panel";
import { SelectedList } from "./selected-list";
import { ScheduleButton } from "./schedule-button";

// "הוספת מקומות", in the Pencil design's order.
//
// A component rather than JSX in the page, for the reason TodayBefore gives: the
// harness cannot render the page — the page reads the database — so a
// composition left there is one no scene can check.
//
// The design's order: the search pill, the category grid, the AI box, then
// "מומלצים ב<עיר>", with a sticky bar at the foot. The picked list under its
// map, which the frame does not draw, follows the recommendations; the manual
// form is a compact pill in the title row.
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
    <TwoPane>
      {/* The Pencil header: a round back button and the title on one line.
          v6: this screen is no longer a tab — "הוסף יעד" on the itinerary opens
          it — so it names itself and says the way back. The sentence that used
          to sit under the title went with the design; the search pill below
          names the city, which was the one fact it carried. */}
      <header className="flex min-w-0 items-center gap-1">
        <Link
          href={`/trips/${tripId}/days`}
          aria-label="חזרה למסלול"
          className="-ms-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* RTL: "back" points the way the text runs. */}
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 text-[1.625rem] font-bold leading-8 wrap-anywhere">
          הוספת מקומות
        </h1>
        {/* The escape hatch, moved up from the foot of the screen: a small
            pill at the far end of the title row, one press from arrival, that
            opens the same form in a sheet. It used to be a whole card below
            the picked list, where the one person who needed it had to scroll
            past everything else first. */}
        <ManualPlaceForm tripId={tripId} cities={knownCities} />
      </header>

      <PlaceSearch
        tripId={tripId}
        cities={searchCities}
        addedPlaces={addedPlaces}
      />

      {/* The AI box sits straight under the grid, as the export draws it. It
          used to hang under a "גילוי יעדים" heading; its own question is the
          heading now. The id stays — other screens link to #discover. */}
      <section id="discover" className="flex scroll-mt-20 flex-col">
        <PlanningPanel
          tripId={tripId}
          initialCities={savedCities}
          city={searchCities[0] ?? null}
        />
      </section>

      {/* Fed from the saved city guide, so what is recommended here is what was
          generated for that city rather than a second, unrelated list. */}
      {searchCities[0] && (
        <RecommendedPlaces
          tripId={tripId}
          city={searchCities[0]}
          guide={cityGuide}
        />
      )}

      {/* What was picked, under the map it is the pins of. Not in the Pencil
          frame, which ends at the recommendations — but the list is how a pick
          is undone and the map is where it lands, so both stay, in the same
          header language as "מומלצים" above: a title, and a quiet note at the
          far end. */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <h2 className="min-w-0 text-lg font-bold leading-6">
            נבחרו לטיול
            {selected.length > 0 && (
              <span className="ms-1.5 text-base font-medium tabular-nums text-muted">
                {selected.length}
              </span>
            )}
          </h2>
          {selected.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-caption text-muted">
              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
              מופיעים על המפה
            </span>
          )}
        </div>
        {/* The map above the list, which is the reason the note says "on the
            map": a list of six names beside nothing is not pins. */}
        {selected.length > 0 && map}
        <SelectedList tripId={tripId} items={selected} />
      </section>

      {/* The design's sticky bottom bar: how many are waiting, and the one
          orange call on the screen. It places what is new into the days that
          already exist (ScheduleButton → scheduleNewPlaces, no model call) and
          then shows the result on מסלול.

          Sticky rather than fixed, so it rides at the end of the column and
          never covers the last card, and lifted clear of the floating phone tab
          bar by the offset the itinerary's own sticky bar uses. Only once
          something is chosen — before that it would offer to distribute nothing
          across the days. */}
      {selected.length > 0 && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-[20px] bg-surface py-3 pe-3 ps-4 shadow-lift">
            <div className="flex min-w-0 flex-col">
              <span className="min-w-0 text-base font-bold wrap-anywhere">
                {selected.length === 1
                  ? "מקום אחד נבחר"
                  : `${selected.length} מקומות נבחרו`}
              </span>
              <span className="min-w-0 text-caption text-muted wrap-anywhere">
                ממתינים לשיבוץ ביום
              </span>
            </div>
            <ScheduleButton tripId={tripId} />
          </div>
        </div>
      )}
    </TwoPane>
  );
}
