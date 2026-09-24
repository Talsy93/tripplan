"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarPlus,
  CalendarX2,
  ChevronDown,
  ChevronLeft,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { TwoPane } from "@/components/layout";
import { Banner, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BookingDetails } from "./booking-details";
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
import { EmptyDays } from "./route-cities";
import { DayRouteMapCard } from "./route-map-card";
import { TripCalendar } from "./trip-calendar";
import { withEmptyDays } from "../domain/itinerary-plan";
import { cityToneClass, cityToneMap } from "../domain/tone";
import {
  clampDay,
  dateOfDay,
  itineraryOverrun,
  nightStayLabel,
} from "../domain/trip-days";
import type { Booking } from "../domain/booking";
import type { CityDayPlan } from "../domain/city-days";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";

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
  // The first of them the AI can suggest for — it needs a city to suggest in.
  const firstSuggestableDay =
    emptyDayNumbers.find((dayNumber) => cityOfDay.has(dayNumber)) ?? null;

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
            "flex min-w-0 flex-col gap-6",
            building && "opacity-45 transition-opacity duration-settle",
          )}
        >
          {error && <Banner tone="danger">{error}</Banner>}

          {/* Pencil's "before a schedule" screen: one teal disc, one line of
              invitation, the nights per city, and the build as the screen's
              single terracotta action. The question comes first because the
              numbers under it are the input the build uses. */}
          <div className="flex flex-col items-center gap-2 pt-4 text-center">
            <span
              className="mb-2 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary-tint text-primary"
              aria-hidden="true"
            >
              <CalendarPlus className="h-8 w-8" />
            </span>
            <h2 className="text-[1.375rem] leading-7 font-bold">
              בואו נבנה את הלו״ז
            </h2>
            <p className="max-w-measure text-sm text-muted">
              {cityDays.length > 0
                ? "כמה ימים בכל עיר? המקומות ששמרתם יתחלקו לימים לפי זה."
                : "אחרי שהוספתם פריטים לטיול, בנו לוח זמנים יומי בלחיצה אחת."}
            </p>
          </div>

          <CityDaysEditor
            tripId={tripId}
            plan={cityDays}
            tripDayCount={tripDayCount}
          />

          {/* Sticky above the tab bar, where the design parks it: the one
              thing to do here should not scroll away under a long city list. */}
          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 pt-2 lg:bottom-4">
            <Button
              type="button"
              size="lg"
              onClick={build}
              loading={building}
              className="h-[3.25rem] w-full rounded-full text-base shadow-lift"
            >
              {!building && (
                <WandSparkles className="h-5 w-5" aria-hidden="true" />
              )}
              בניית לוח זמנים
            </Button>
          </div>
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

          {/* The route, open. Pencil draws "המסלול כולו" as a plain section of
              the pane — a heading with "בנייה מחדש" beside it and the nights
              per city under it — rather than a fold, and with the steppers the
              editor is now one row per city instead of a form, so it earns the
              room. The list, the numbers and the rebuild are still one subject
              in one place, which is what merging them was for.

              The day-by-day stop list stays folded under it: it answers "when
              are we where" and selects days, which the calendar above and the
              strip already do — the second way in, not the first. */}
          <section className="flex flex-col gap-3" aria-labelledby="route-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="route-heading" className="text-base font-bold">
                המסלול כולו
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={build}
                loading={building}
                className="h-8 px-2 text-xs"
              >
                בנייה מחדש
              </Button>
            </div>

            <CityDaysEditor
              tripId={tripId}
              plan={cityDays}
              tripDayCount={tripDayCount}
            />

          </section>

          {/* The empty days, as one compact card — Pencil's "2 ימים עדיין
              ריקים". Folded to the count; opening it lists the days. */}
          {emptyDayNumbers.length > 0 && (
            <EmptyDaysBox
              dayNumbers={emptyDayNumbers}
              startDate={startDate}
              onSelect={setChosenDay}
              onSuggest={
                firstSuggestableDay !== null
                  ? () => {
                      setChosenDay(firstSuggestableDay);
                      setSuggestingDay(firstSuggestableDay);
                    }
                  : null
              }
            />
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

      {/* The day on the map: every located place of the day, numbered in
          timeline order. A day with nothing to pin shows the whole route. */}
      <DayRouteMapCard tripId={tripId} day={active} fallback={map} />

      {/* The day itself: its name, then everything that happens in it. One
          section so the heading, the day's controls and the schedule sit a
          row apart rather than a section apart. */}
      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="day-heading">
        {/* Pencil's section head: the day written out, and a count beside it.
            The strip above names the day in 10px; this is where it is read. */}
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <h2 id="day-heading" className="min-w-0 truncate text-[1.0625rem] leading-6 font-bold">
            {longDayLabel(activeDate) ?? `יום ${active.day}`}
          </h2>
          <span className="shrink-0 text-xs text-muted">
            {[
              active.items.length === 0
                ? "יום פנוי"
                : active.items.length === 1
                  ? "מקום אחד"
                  : `${active.items.length} מקומות`,
              activeCity,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>

        {/* What is true of the whole day, above everything that happens in it.
            A holiday changes what the rest of the day should hold, so it is
            read first. */}
        <DayNotes
          tripId={tripId}
          notes={notesForDay(dayNotes, active.day)}
          dayCount={dayCount}
        />

        {/* The day's own controls — mark it, remind yourself, pin its hours,
            and on a landing day plan the ride in. Not in the Pencil screen,
            which has no room for them; kept as a row of quiet outlined pills
            that scrolls sideways rather than wrapping into a block, so they
            read as tools on the day and not as a second toolbar. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-2 [&>button]:h-9 [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-surface [&>button]:px-3.5 [&>button]:text-xs [&>button]:font-medium [&>button]:text-foreground [&>button]:shadow-none [&>button:hover]:bg-surface-2 [&_svg]:text-primary">
            {/* Only on a day that lands. It is the one day whose first hours
                are a problem to be solved rather than a choice to be made. */}
            {arrival && (
              <AirportTransferButton
                tripId={tripId}
                dayNumber={active.day}
                dayCount={dayCount}
                airport={arrival.place}
                landingMinutes={arrival.minutes}
                // Offered as choices, not as one pre-filled string — the
                // default has to be something you can *press*.
                //
                // Both nights, because a late landing moves the transfer to
                // the next day and the hotel you reach may be that day's, not
                // this one's. Usually the same booking, in which case the
                // dedupe leaves one chip.
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
        </div>

        {/* The wide presentation: a time column and a card per item. The
            compact one belongs to the היום tab — one screen, one presentation.
            Removal lives in the edit dialog the card opens, never as an icon at
            rest in a row. The wrapper carries the day's city tone, which the
            card tiles read for their tint. */}
        <div className={cityToneClass(tones, activeCity)}>
          <DayTimeline
            day={active}
            tripId={tripId}
            reminders={remindersForDay(reminders, active.day)}
            dayCount={dayCount}
            onEdit={setEditingId}
            bookings={bookingsByDay[active.day] ?? []}
            date={activeDate}
          />
        </div>
      </section>

      {/* Where you sleep tonight — Pencil's teal-tinted card under the day. */}
      {stay && <TonightCard stay={stay} />}

      {/* The day's to-do count. DayTiles also draws the bed, but the card above
          says that now, so it is handed no stay and shows the reminders alone. */}
      <DayTiles
        tripId={tripId}
        stay={null}
        reminders={remindersForDay(reminders, active.day)}
        dayNumber={active.day}
        dayCount={dayCount}
      />

      {/* Pencil's foot: who plans this with you, and the screen's one
          terracotta action. Sticky, so it rides above the tab bar while the
          day scrolls under it. */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 pt-2 lg:bottom-4">
        {collaborators.length > 1 && (
          <span
            className="flex shrink-0 -space-x-2 space-x-reverse"
            aria-label={`${collaborators.length} מטיילים`}
          >
            {collaborators.slice(0, 3).map((initial, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground ring-2 ring-background",
                  ["bg-primary", "bg-success", "bg-cat-hidden-ink"][index],
                )}
              >
                {initial}
              </span>
            ))}
          </span>
        )}
        <Link
          href={`/trips/${tripId}/explore`}
          className="inline-flex h-[3.25rem] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-semibold text-cta-foreground shadow-lift transition-[background-color,transform] duration-press ease-snap hover:bg-cta-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:ms-auto lg:flex-none"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          הוספת יעד
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

// "יום שלישי, 13 באפריל" — the day written out for the section head. Null
// without dates, and the caller falls back to the day number. UTC on both ends,
// because the date is a calendar date and not an instant: formatted in the
// browser's zone, a trip day could print as the day before.
function longDayLabel(date: string | null): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}


// The days with nothing on them, as one white card that carries just the
// count. Folded by default: the design draws it as a line in the pane, and a
// fortnight with six free days unfolded was a wall of date chips above the
// route. Opening it lists the days — each jumps to its day — and the design's
// "רעיונות ליום ריק", which opens the suggestions dialog only when pressed.
function EmptyDaysBox({
  dayNumbers,
  startDate,
  onSelect,
  onSuggest,
}: {
  dayNumbers: number[];
  startDate: string | null;
  onSelect: (dayNumber: number) => void;
  onSuggest: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col rounded-[20px] bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="empty-days-list"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-[20px] p-4 text-start text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarX2 className="h-5 w-5 shrink-0 text-cta" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {dayNumbers.length === 1
            ? "יום אחד עדיין ריק"
            : `${dayNumbers.length} ימים עדיין ריקים`}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-press",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id="empty-days-list" className="flex flex-col gap-3 px-4 pb-4">
          <EmptyDays
            dayNumbers={dayNumbers}
            startDate={startDate}
            onSelect={onSelect}
            bare
          />
          {onSuggest && (
            <Button
              type="button"
              variant="soft"
              size="sm"
              className="self-start rounded-full"
              onClick={onSuggest}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              רעיונות ליום ריק
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Where you sleep tonight, as Pencil draws it under the day: a teal-tinted
// card, a bed on a white tile, the hotel's name and what tonight is for it
// (check-in, the last night). The whole card opens the booking.
function TonightCard({ stay }: { stay: NightLodging }) {
  const [open, setOpen] = useState(false);
  const where = stay.booking.address ?? stay.booking.city;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`פרטי הלינה ${stay.booking.title}`}
        className="flex w-full min-w-0 items-center gap-3 rounded-[20px] bg-primary-tint p-4 text-start transition-colors hover:bg-primary-tint/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface text-primary"
          aria-hidden="true"
        >
          <BedDouble className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="min-w-0 truncate text-[0.9375rem] font-bold text-primary-ink">
            {stay.booking.title}
          </span>
          <span className="min-w-0 truncate text-xs text-primary-ink/80">
            {[
              stay.isCheckIn || stay.isLastNight
                ? nightStayLabel(stay)
                : "לינה הלילה",
              where,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
      </button>
      {open && (
        <BookingDetails
          booking={stay.booking}
          open
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
