"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Compass, MapPinPlus, Route, Sparkles } from "lucide-react";
import { TwoPane } from "@/components/layout";
import {
  Badge,
  Banner,
  Button,
  Disclosure,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { deleteItineraryEntry } from "../application/itinerary-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { BuildingItinerary } from "./building-itinerary";
import { CityDaysEditor } from "./city-days-editor";
import { DayStrip } from "./day-strip";
import { DaySuggestionsDialog } from "./day-suggestions-dialog";
import { DayTiles } from "./day-tiles";
import { DayTimeline } from "./day-timeline";
import { AddReminderButton } from "./reminder-dialog";
import { AnchorsButton } from "./anchors-dialog";
import { remindersForDay } from "../domain/day-reminders";
import { notesForDay } from "../domain/day-notes";
import { arrivalOnDay } from "../domain/airport-transfer";
import {
  AirportTransferButton,
  transferDestinations,
} from "./airport-transfer";
import { APP_TIME_ZONE } from "../domain/weather";
import { AddDayNoteButton, DayNotes } from "./day-note";
import type { DayReminder } from "../domain/day-reminders";
import type { DayNote } from "../domain/day-notes";
import { EditEntryDialog } from "./edit-entry-dialog";
import { EmptyDays, RouteCities } from "./route-cities";
import { TripCalendar } from "./trip-calendar";
import { withEmptyDays } from "../domain/itinerary-plan";
import { cityToneMap } from "../domain/tone";
import {
  clampDay,
  dateOfDay,
  itineraryOverrun,
  weekdayAfterDayNumber,
} from "../domain/trip-days";
import type { Booking } from "../domain/booking";
import type { CityDayPlan } from "../domain/city-days";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";
import type { RouteCity } from "./route-cities";
import { CalendarDays } from "lucide-react";

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
  // How long the trip stays in each city, computed on the server. This is the
  // input the itinerary builder was missing entirely — see domain/city-days.ts.
  cityDays?: CityDayPlan[];
  // Days the trip's own dates allow, or null when it has no dates yet.
  tripDayCount?: number | null;
  // The day's flights, trains and check-ins. Bucketed on the server (see
  // bookingsByDay) so both renders agree on which calendar day a 23:40
  // departure belongs to.
  bookingsByDay?: Record<number, Booking[]>;
  // The day the calendar says it is, or null outside the trip. Decides which
  // day the screen opens on, and marks "today" in the strip and the calendar.
  currentDay?: number | null;
  // Reminders pinned to days (migration 0024), shown inside each day.
  reminders?: DayReminder[];
  // What each day is marked with (migration 0025) — a holiday, a rest day.
  // Above the schedule rather than in it: a note has no hour.
  dayNotes?: DayNote[];
  // v6 (Stitch): the route map card, drawn between the day selector and the
  // day — a node, because resolving the route belongs to the page's boundary.
  map?: ReactNode;
  // Initials of the people on the trip, for the "עריכה משותפת" pill.
  collaborators?: string[];
};

export function Itinerary({
  tripId,
  initialItinerary,
  startDate = null,
  endDate = null,
  lodgingByDay = {},
  cityDays = [],
  tripDayCount = null,
  bookingsByDay = {},
  currentDay = null,
  reminders = [],
  dayNotes = [],
  map,
  collaborators = [],
}: ItineraryProps) {
  const [scheduled, setScheduled] = useState<ItineraryDay[]>(initialItinerary);

  // Re-seeded when the server sends a different itinerary, for the reason
  // selected-list explains at length: `useState(prop)` reads the prop once, so
  // every server revalidation after mount was thrown away.
  //
  // Here that showed up as an edit not sticking. EditEntryDialog saves through
  // updateItineraryEntry, which revalidates the route, and then closes — and
  // the day underneath went on showing the old time until the page was
  // reloaded, which reads as a save that failed.
  //
  // Safe for the build, which sets this state from the API's own response: that
  // path does not change the prop, so there is nothing for this to overwrite.
  const [seenItinerary, setSeenItinerary] = useState(initialItinerary);
  if (initialItinerary !== seenItinerary) {
    setSeenItinerary(initialItinerary);
    setScheduled(initialItinerary);
  }

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The entry whose edit dialog is open, by id.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The empty day whose suggestions dialog is open.
  const [suggestingDay, setSuggestingDay] = useState<number | null>(null);
  // The day on screen. Opens on the day you are living, and on day 1 before the
  // trip — the same rule the היום tab's pager uses, because it is the same
  // question: of fourteen days, which one is this person actually in.
  //
  // Client state and not a URL param, for the reason DayPager gives: the whole
  // itinerary arrives in one query, so paging costs nothing, while ?day= would
  // spend a server round trip on every tap.
  const [chosenDay, setChosenDay] = useState<number | null>(null);

  const hasItinerary = scheduled.some((day) => day.items.length > 0);

  // Every day the trip covers, not only the ones that have something on them.
  // A week in Tokyo with three days planned used to render three days, which
  // reads as a shorter trip rather than as four free days.
  const days = hasItinerary
    ? (withEmptyDays(scheduled, tripDayCount) as ItineraryDay[])
    : scheduled;
  const dayCount = days.length;

  // Which city each day belongs to — the day it *ends* in, the same rule the
  // route uses. An empty day has no item to read that off, so it falls back to
  // where the trip sleeps that night, which is the only thing that knows where
  // a blank day is.
  //
  // Not domain/route.ts's cityByDay, which reads items alone: a city whose days
  // are all still empty would vanish from the route entirely, and those are
  // exactly the days this screen is trying to draw attention to.
  //
  // A day that knows neither carries the previous day's city forward. You do
  // not teleport: an empty day after three days in Tokyo is a day in Tokyo. The
  // only day this gets wrong is the one you actually move on, and that day
  // almost always has the train or the flight on it, which names the new city
  // itself. Measured before this: an empty day with no hotel booked broke the
  // Tokyo run in half and the route pane reported three nights for five days.
  const cityOfDay = new Map<number, string>();
  let carried: string | null = null;
  for (const day of days) {
    // Annotated: without it `city` is inferred from an expression that reads
    // `carried`, which is assigned from `city` — a circular inference.
    const city: string | null =
      [...day.items].reverse().find((item) => item.city)?.city ??
      lodgingByDay[day.day]?.booking.city ??
      carried;
    if (city) {
      cityOfDay.set(day.day, city);
      carried = city;
    }
  }

  // Cities in visiting order — day order is route order, so this produces the
  // same assignment the map and the hero use.
  const tones = cityToneMap([...cityOfDay.values()]);
  const overrun = itineraryOverrun(startDate, endDate, dayCount);

  // Clamped rather than stored clamped: a rebuild can shorten the trip while
  // day 12 is on screen, and a day number past the end would render nothing.
  const activeDay = clampDay(chosenDay ?? currentDay ?? 1, dayCount);
  const active = days.find((day) => day.day === activeDay) ?? days[0];

  const emptyDayNumbers = days
    .filter((day) => day.items.length === 0)
    .map((day) => day.day);

  // The route, grouped from cityOfDay. Consecutive days in the same city are one
  // stop; a city revisited later in the trip gets a second one, which is the
  // truth about the route rather than a tidier summary of it.
  //
  // Nights come from first-to-last rather than from how many days were recorded:
  // a night is a transition between two days, so a stop from day 6 to day 9 is
  // three nights whether or not day 8 had anything on it. Counting the days
  // instead is what made a five-day stay with one blank day report four.
  const stops: RouteCity[] = [];
  for (const day of days) {
    const city = cityOfDay.get(day.day);
    if (!city) continue;
    const last = stops[stops.length - 1];
    if (last && last.city === city) {
      last.days.push(day.day);
      last.nights = day.day - (last.days[0] ?? day.day);
    } else {
      stops.push({ city, days: [day.day], nights: 0 });
    }
  }

  // Resolved from the id rather than held as an object, so the dialog always
  // edits the current row: a rebuild replaces every entry, and a stashed copy
  // would go on showing the old times.
  const editing = editingId
    ? days.flatMap((day) =>
        day.items
          .filter((item) => item.id === editingId)
          .map((entry) => ({ entry, day: day.day })),
      )[0]
    : undefined;

  // Resolved here rather than captured when the button was clicked, for the
  // same reason `editing` is: a rebuild while the dialog is open replaces
  // every day, and a stashed city could name one the trip no longer visits.
  //
  // 🐞 Read `lodgingByDay` directly until now, while the button that opens this
  // renders on `activeCity` — which comes from `cityOfDay` and forward-fills
  // from the previous day. So an empty day with no hotel booked *for that day*
  // got the button (carried city) and no dialog (no lodging row): pressing it
  // did nothing at all, silently.
  //
  // That is the exact case cityOfDay was built for — see the comment on it. The
  // two now read the same map, so the offer and what it opens cannot disagree.
  const suggestingCity =
    suggestingDay !== null ? (cityOfDay.get(suggestingDay) ?? null) : null;

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
      setScheduled(data.days ?? []);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setBuilding(false);
    }
  }

  function remove(entryId: string) {
    setScheduled((prev) =>
      prev
        .map((day) => ({
          ...day,
          items: day.items.filter((item) => item.id !== entryId),
        }))
        .filter((day) => day.items.length > 0),
    );
    void deleteItineraryEntry(entryId);
  }

  // Nothing built yet. A different shape rather than the same screen with a
  // strip of one day and an empty card in it: the only thing to do here is
  // build, and the day-at-a-time layout has no day to be at.
  if (!hasItinerary || !active) {
    return (
      // The same centred measure TwoPane falls back to with no pane. Left full
      // width, the city-days rows stretched across 1180px at 1920 — a form as
      // wide as the whole app to hold four numbers.
      <div className="relative mx-auto flex w-full max-w-main flex-col gap-4">
        <div
          inert={building}
          className={cn(
            "flex min-w-0 flex-col gap-4",
            building && "opacity-45 transition-opacity duration-settle",
          )}
        >
          {error && <Banner tone="danger">{error}</Banner>}

          {/* Above the build, because it is the input the build uses. */}
          <CityDaysEditor
            tripId={tripId}
            plan={cityDays}
            tripDayCount={tripDayCount}
          />

          <EmptyState
            icon={<CalendarDays />}
            title='עוד אין לו"ז'
            description="אחרי שהוספתם פריטים לטיול, בנו לוח זמנים יומי בלחיצה אחת."
            action={
              <Button type="button" onClick={build} loading={building}>
                בניית לוח זמנים
              </Button>
            }
          />
        </div>

        {/* The same cover on the first build as on a rebuild. There is no old
            schedule to protect here, but the wait is the same wait and it
            should look like it. */}
        {building && <BuildingItinerary dayCount={tripDayCount ?? 4} />}
      </div>
    );
  }

  const activeCity = cityOfDay.get(active.day) ?? null;
  const activeDate = dateOfDay(startDate, active.day);
  const stay = lodgingByDay[active.day] ?? null;
  const isEmpty = active.items.length === 0;

  // The arrival this day begins with, if it begins with one.
  //
  // A transport booking whose *end* falls on this day — which is what
  // bookingsByDay now buckets it under, and the reason the landing day knows
  // anything at all. `arrival` is null on every other day, and the offer below
  // simply does not appear.
  const arrival = arrivalOnDay(
    bookingsByDay[active.day] ?? [],
    activeDate,
    APP_TIME_ZONE,
  );

  return (
    <TwoPane
      aside={
        <>
          {/* Only from xl. Below it the strip is already the day control and
              this would be a second one stacked underneath the day it selects —
              see the note on TripCalendar itself. */}
          <div className="hidden xl:block">
            <TripCalendar
              startDate={startDate}
              dayCount={dayCount}
              activeDay={active.day}
              currentDay={currentDay}
              cityByDay={cityOfDay}
              tones={tones}
              onSelect={setChosenDay}
            />
          </div>

          {/* One section, not two. "In the route tab, merge the display of
              the cities in the route and the whole schedule so they open
              together after one press."

              They were two blocks with two headings, and they are one subject:
              the route. Which cities, for how many days each, and the build
              that turns that into a schedule — you open them to answer one
              question, and answering it used to mean opening one and scrolling
              past the other. The list reads the plan and the editor writes it,
              so they belong in the same body in that order.

              Still closed. The reason the city list was folded in the first
              place has not changed — it is the tallest block in the pane, one
              row per city — and now the summary is the route itself: the city
              names and how many. */}
          <Disclosure
            leading={<Route className="h-4 w-4" />}
            title="המסלול כולו"
            // The count and nothing else. The names were in here and they
            // defeated the fold: six cities joined by dots is the list again,
            // wrapped to three lines, sitting under a heading whose whole job
            // is to stand in for it. "A closed section does not need the whole
            // list of cities, just a heading with the count."
            detail="כמה ימים בכל עיר, ובנייה מחדש של הלו״ז"
            meta={
              stops.length > 0 ? (
                <Badge tone="neutral">{stops.length}</Badge>
              ) : undefined
            }
          >
            {stops.length > 0 && (
              <RouteCities
                stops={stops}
                startDate={startDate}
                tones={tones}
                activeDay={active.day}
                currentDay={currentDay}
                onSelect={setChosenDay}
              />
            )}

            {/* How many days each city gets, and the build that consumes it.
                Under the list rather than above it, because the list is what
                you check before deciding to change anything. */}
            <CityDaysEditor
              tripId={tripId}
              plan={cityDays}
              tripDayCount={tripDayCount}
            />
            <Button
              type="button"
              onClick={build}
              loading={building}
              variant="outline"
              size="sm"
              className="self-start"
            >
              בנייה מחדש
            </Button>
          </Disclosure>

          {/* Behind a press, like everything else in this pane. The count is
              the part that matters — "3 days still empty" is the whole message,
              and the dates you would jump to are what you open it for. */}
          {emptyDayNumbers.length > 0 && (
            <Disclosure
              leading={<CalendarDays className="h-4 w-4" />}
              title="ימים ריקים"
              meta={<Badge tone="neutral">{emptyDayNumbers.length}</Badge>}
            >
              <EmptyDays
                dayNumbers={emptyDayNumbers}
                startDate={startDate}
                onSelect={setChosenDay}
                bare
              />
            </Disclosure>
          )}
        </>
      }
    >
      {/* The cover goes here, over the days, and takes them out of reach while
          a new schedule is on its way — see BuildingItinerary for why that is
          not just a nicety.

          `enter-skip` on the wrapper and `enter-children` on the column inside
          it, so the load sequence is exactly what it was before the wrapper
          existed: the wrapper is a positioning box and nothing else, and the
          real children keep their own staggered entrance. One level of motion
          at a time, which is the rule enter-skip is there to enforce. */}
      <div className="enter-skip relative min-w-0">
        <div
          // The platform's own switch rather than `pointer-events-none`: that
          // stops a mouse and lets a Tab walk straight into the schedule
          // underneath.
          inert={building}
          className={cn(
            "enter-children flex min-w-0 flex-col gap-6",
            building && "opacity-45 transition-opacity duration-settle",
          )}
        >
      {error && <Banner tone="danger">{error}</Banner>}

      {/* An itinerary longer than the booked dates is a real planning error, so
          it is reported rather than clamped — clamping would make two days share
          a date and hide the problem. */}
      {overrun !== null && overrun > 0 && (
        <Banner tone="callout">
          הלו״ז נמשך {overrun === 1 ? "יום אחד" : `${overrun} ימים`} אחרי תאריך
          החזרה. אפשר לעדכן את התאריכים בטאב ״עוד״.
        </Banner>
      )}

      {/* The screen opens on one day with the strip above it, which is the
          change T2 is about. It used to render all fourteen in sequence with a
          sticky day index beside them on lg — an index into a list is what you
          need when the list is the problem. */}
      <DayStrip
        dayNumbers={days.map((day) => day.day)}
        startDate={startDate}
        activeDay={active.day}
        currentDay={currentDay}
        onSelect={setChosenDay}
        labels={Object.fromEntries(
          days.map((day) => [
            day.day,
            cityOfDay.get(day.day) ?? day.items[0]?.title ?? null,
          ]),
        )}
      />

      {map}

      {/* The day's name lives on its card in the selector above, which is
          where Stitch puts it; the screen carries no second heading for it. */}
      <h2 className="sr-only">
        יום {active.day}
        {activeCity && ` · ${activeCity}`}
        {activeDate && ` · ${weekdayAfterDayNumber(activeDate)}`}
      </h2>

      {/* What is true of the whole day, above everything that happens in it.
          A holiday changes what the rest of the day should hold, so it is read
          first. */}
      <DayNotes
        tripId={tripId}
        notes={notesForDay(dayNotes, active.day)}
        dayCount={dayCount}
      />

      {/* Pin an hour, lock the booked ones — the same two controls the היום
          tab has, so a day is shaped the same wherever it is looked at. */}
      {/* Stitch's "פעולות מהירות" bar: a lavender strip with the day's controls. */}
      <div className="flex flex-wrap items-center gap-2 rounded-card bg-surface-2 p-2 [&>button]:h-7 [&>button]:rounded-lg [&>button]:bg-surface [&>button]:px-2 [&>button]:text-xs [&>button]:font-medium [&>button]:text-primary [&>button]:shadow-none">
        <span className="text-xs font-medium text-muted">פעולות מהירות:</span>
        {/* Only on a day that lands. It is the one day whose first hours are a
            problem to be solved rather than a choice to be made. */}
        {arrival && (
          <AirportTransferButton
            tripId={tripId}
            dayNumber={active.day}
            dayCount={dayCount}
            airport={arrival.place}
            landingMinutes={arrival.minutes}
            // Offered as choices, not as one pre-filled string — the default
            // has to be something you can *press*.
            //
            // Both nights, because a late landing moves the transfer to the
            // next day and the hotel you reach may be that day's, not this
            // one's. Usually the same booking, in which case the dedupe below
            // leaves one chip.
            suggestions={transferDestinations([
              stay?.booking,
              lodgingByDay[active.day + 1]?.booking,
            ])}
            city={activeCity}
          />
        )}
        <AddDayNoteButton
          tripId={tripId}
          dayNumber={active.day}
          dayCount={dayCount}
        />
        <AddReminderButton
          tripId={tripId}
          dayNumber={active.day}
          dayCount={dayCount}
        />
        <AnchorsButton tripId={tripId} day={active} />
      </div>

      {/* An entirely free day gets the offer to fill it, right here — the point
          of showing empty days at all. Asking the AI is one click, and it opens
          beside the day rather than sending the user off to another tab and
          back. Needs a city: with nowhere to be there is nothing to suggest, so
          that day falls through to the link below. */}
      {isEmpty && activeCity && (
        <Banner tone="info">
          <span className="flex flex-wrap items-center gap-x-2">
            היום הזה פנוי.
            <button
              type="button"
              onClick={() => setSuggestingDay(active.day)}
              className="flex items-center gap-1 rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              מה אפשר לעשות ב{activeCity}?
            </button>
          </span>
        </Banner>
      )}

      {/* Marked, and pointed somewhere — not filled in automatically. A day the
          AI could only put one thing on usually means the city has more days
          than it has chosen places, and the fix is to go and choose more. */}
      {active.items.length < 2 && !(isEmpty && activeCity) && (
        <Banner tone="info">
          <span className="flex flex-wrap items-center gap-x-2">
            {isEmpty ? "היום הזה פנוי." : "היום הזה כמעט ריק."}
            <Link
              href={`/trips/${tripId}/explore`}
              className="flex items-center gap-1 font-semibold underline"
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              הוספת פעילויות{activeCity ? ` ב${activeCity}` : ""}
            </Link>
          </span>
        </Banner>
      )}

      {/* The wide presentation: a card per item, led by its category tile, with
          the time as a caption over the title and a chevron saying the row
          opens. The compact one belongs to the היום tab — one screen, one
          presentation, which is why the ציר שעות / רשימה toggle is gone.
          The list it toggled to was also the last place in the app with a
          delete icon sitting at rest in a row, which the design forbids;
          removal lives in the edit dialog the chevron opens. */}
      <DayTimeline
        day={active}
        tripId={tripId}
        reminders={remindersForDay(reminders, active.day)}
        dayCount={dayCount}
        onEdit={setEditingId}
        bookings={bookingsByDay[active.day] ?? []}
        date={activeDate}
        // The dashed row the mockup ends the day with. It goes to the tab where
        // things are chosen, because that is where a day gains an item —
        // scheduling happens on the build.
      />

      {/* The bed and the to-do list, as two tiles rather than two full-width
          blocks. See DayTiles. */}
      <DayTiles
        tripId={tripId}
        stay={stay}
        reminders={remindersForDay(reminders, active.day)}
        dayNumber={active.day}
        dayCount={dayCount}
      />

      {/* Stitch's floating foot: who edits this with you, and the one
          terracotta action — add a destination. Sticky, so it rides above the
          tab bar while the day scrolls under it. */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-2 pt-2 lg:bottom-4">
        {collaborators.length > 1 ? (
          <span className="flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 shadow-md backdrop-blur-xl">
            <span className="flex -space-x-1.5 space-x-reverse">
              {collaborators.slice(0, 3).map((initial, index) => (
                <span
                  key={index}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[0.625rem] font-bold ring-2 ring-surface",
                    ["bg-primary-tint text-primary-ink", "bg-cta-tint text-cta-deep", "bg-success-bright text-success-ink"][index],
                  )}
                >
                  {initial}
                </span>
              ))}
            </span>
            <span className="text-[0.625rem] font-medium text-muted">עריכה משותפת</span>
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/trips/${tripId}/explore`}
          className="inline-flex items-center gap-1 rounded-full bg-cta-bright px-6 py-2 text-base font-semibold text-cta-foreground shadow-lg shadow-cta/30 transition-transform hover:bg-cta active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MapPinPlus className="h-5 w-5" aria-hidden="true" />
          הוסף יעד
        </Link>
      </div>
        </div>

        {building && <BuildingItinerary dayCount={dayCount} />}
      </div>

      {/* One dialog for the whole list rather than one per row: only a single
          entry can be open at a time, and mounting a <dialog> per item would put
          hundreds of them in the DOM on a two-week trip. */}
      {editing && (
        <EditEntryDialog
          key={editing.entry.id}
          entry={editing.entry}
          dayNumber={editing.day}
          dayCount={days.length}
          open
          onClose={() => setEditingId(null)}
          onRemove={remove}
        />
      )}

      {suggestingDay !== null && suggestingCity && (
        <DaySuggestionsDialog
          key={suggestingDay}
          tripId={tripId}
          city={suggestingCity}
          dayNumber={suggestingDay}
          // Everything the trip already holds in that city, so the model is
          // not asked to suggest what is already scheduled elsewhere.
          alreadyInTrip={days
            .flatMap((day) => day.items)
            .filter((item) => item.city === suggestingCity)
            .map((item) => item.title)}
          open
          onClose={() => setSuggestingDay(null)}
        />
      )}
    </TwoPane>
  );
}
