import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { Map as MapIcon, RefreshCw } from "lucide-react";
import type {
  AiCitySuggestion,
  CityGuideData,
  SelectedItem,
} from "../domain/ai-suggestion";
import type { AddedPlace } from "../infrastructure/place-service";
import type { CityDayPlan } from "../domain/city-days";
import type { SchedulingPlan } from "../domain/schedule-new";
import { CityDaysEditor } from "./city-days-editor";
import { EmptyDaysSection, PlanDayCard } from "./plan-day-card";
import { PlanSwitch } from "./plan-switch";
import { ManualPlaceForm } from "./manual-place-form";
import { PlaceSearch } from "./place-search";
import { RecommendedPlaces } from "./recommended-places";
import { PlanningPanel } from "./planning-panel";
import { SelectedList } from "./selected-list";
import { ScheduleButton } from "./schedule-button";

// "תכנון הטיול" — the יעדים view of the תכנון tab (2026-09-25). It was
// "הוספת מקומות", a screen you reached from מסלול; now it is a tab of its own
// and holds the whole plan: where the trip goes and for how long, which days are
// still empty, what was picked, and the ways to find more.
//
// A component rather than JSX in the page, for the reason TodayBefore gives: the
// harness cannot render the page — the page reads the database — so a
// composition left there is one no scene can check.
//
// Order, top to bottom: the view switch; the title with the manual-add pill; the
// day card when מסלול sent you here for one day (`?day=N`); the search and the
// category grid; the AI box; "מומלצים ב<עיר>"; then the trip as it stands — the
// route, the empty days, the picked list under its map — and the sticky
// scheduling bar at the foot.
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
  // Nights per city, for "המסלול כולו" — the same plan מסלול used to draw.
  cityDays = [],
  tripDayCount = null,
  // What is waiting to be scheduled and every day it could go to.
  plan = EMPTY_PLAN,
  // `?day=N` from מסלול's empty day.
  focusDay = null,
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
  cityDays?: CityDayPlan[];
  tripDayCount?: number | null;
  plan?: SchedulingPlan;
  focusDay?: number | null;
}) {
  const focused =
    focusDay !== null ? plan.days.find((day) => day.day === focusDay) : undefined;

  // Picked places per city, in the order the cities were first picked — the
  // one-line answer to "how much do we have in each place" above the list.
  const perCity = new Map<string, number>();
  for (const item of selected) {
    if (item.city) perCity.set(item.city, (perCity.get(item.city) ?? 0) + 1);
  }

  const waiting = plan.pending.length;

  // PN20 (Pencil desktop): from @4xl of the panel the trip as it stands — the
  // route and the empty days — moves into a sticky pane beside the search, and
  // the search keeps the wide column. A phone keeps the old single column, in
  // the old order, without rendering anything twice: both columns are
  // `display: contents` below @4xl, so their children are items of the outer
  // flex column and `order` interleaves them (search 1, route 2, picked 3,
  // the scheduling bar 4). From @4xl the columns are real boxes and `order`
  // only acts inside each.
  const routePane = cityDays.length > 0 || plan.days.some((day) => day.items.length === 0);

  return (
    <div
      className={cn(
        "enter-skip mx-auto flex w-full min-w-0 max-w-main flex-col gap-6",
        routePane &&
          "@4xl:grid @4xl:max-w-none @4xl:grid-cols-[minmax(0,1fr)_23.25rem] @4xl:items-start",
      )}
    >
      <div className="enter-children contents @4xl:flex @4xl:min-w-0 @4xl:max-w-main @4xl:flex-col @4xl:gap-6">
      <div className="contents [&>*]:order-1">
      {/* The tab's two views. */}
      <PlanSwitch tripId={tripId} active="explore" />

      {/* The title and, at its far end, the manual form as a compact pill —
          one press from arrival for the one person who needs it. No back
          chevron any more: this is a tab, not a screen pushed from מסלול. */}
      <header className="-mt-2 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 text-[1.625rem] font-bold leading-8 wrap-anywhere">
          תכנון הטיול
        </h1>
        <ManualPlaceForm tripId={tripId} cities={knownCities} />
      </header>

      {/* Keyed by day, so a place checked on day 3 is not still checked when
          the card switches to day 5. */}
      {focused && (
        <PlanDayCard
          key={focused.day}
          tripId={tripId}
          day={focused}
          pending={plan.pending}
        />
      )}

      <section id="search" className="flex min-w-0 scroll-mt-20 flex-col">
        <PlaceSearch
          tripId={tripId}
          cities={searchCities}
          addedPlaces={addedPlaces}
        />
      </section>

      {/* The AI box sits straight under the grid, as the export draws it. Its
          own question is the heading. The id stays — other screens link to
          #discover. */}
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

      </div>

      {/* What was picked, under the map it is the pins of — every saved
          destination, with a count per city above the rows. */}
      <section className="order-3 flex min-w-0 flex-col gap-3">
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
        {perCity.size > 1 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="לפי עיר">
            {[...perCity].map(([city, count]) => (
              <li
                key={city}
                className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-caption"
              >
                <span className="font-semibold">{city}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
        {selected.length > 0 && map}
        <SelectedList tripId={tripId} items={selected} />
      </section>

      {/* The sticky bottom bar: how many are still waiting for a day, and the
          one orange call on the screen, which asks how to schedule them
          (ScheduleButton). Sticky rather than fixed, so it rides at the end of
          the column and never covers the last card, lifted clear of the phone
          tab bar. Only once something is chosen. */}
      {selected.length > 0 && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 order-4 lg:bottom-4">
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-[20px] bg-surface py-3 pe-3 ps-4 shadow-lift">
            <div className="flex min-w-0 flex-col">
              <span className="min-w-0 text-base font-bold wrap-anywhere">
                {waiting === 0
                  ? "הכול משובץ"
                  : waiting === 1
                    ? "מקום אחד ממתין"
                    : `${waiting} מקומות ממתינים`}
              </span>
              <span className="min-w-0 text-caption text-muted wrap-anywhere">
                {waiting === 0
                  ? `${selected.length} מקומות בטיול`
                  : plan.hasItinerary
                    ? "לשיבוץ ביום"
                    : "הלו״ז עוד לא נבנה"}
              </span>
            </div>
            <ScheduleButton tripId={tripId} plan={plan} />
          </div>
        </div>
      )}
      </div>

      <div className="enter-children contents @4xl:sticky @4xl:top-16 @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-6 [&>*]:order-2">
      {/* "המסלול כולו", moved here from מסלול's pane: the cities and how long
          in each, with the steppers. The full rebuild stays on מסלול, where the
          schedule it replaces is on screen — here it is a quiet link there,
          and nothing on this page calls the model to rebuild. */}
      {cityDays.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="route-heading">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2 id="route-heading" className="text-lg font-bold leading-6">
              המסלול כולו
            </h2>
            <Link
              href={`/trips/${tripId}/days`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-caption font-semibold text-primary-ink transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              בנייה מחדש במסלול
            </Link>
          </div>
          <CityDaysEditor tripId={tripId} plan={cityDays} tripDayCount={tripDayCount} />
        </section>
      )}

      <EmptyDaysSection tripId={tripId} days={plan.days} />
      </div>
    </div>
  );
}

const EMPTY_PLAN: SchedulingPlan = { pending: [], days: [], hasItinerary: false };
