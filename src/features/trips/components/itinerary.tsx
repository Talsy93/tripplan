"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Sparkles } from "lucide-react";
import { TwoPane } from "@/components/layout";
import {
  Banner,
  Button,
  EmptyState,
  SectionHeading,
  ToneDot,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { deleteItineraryEntry } from "../application/itinerary-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { CityDaysEditor } from "./city-days-editor";
import { DayStrip } from "./day-strip";
import { DaySuggestionsDialog } from "./day-suggestions-dialog";
import { DayTimeline } from "./day-timeline";
import { EditEntryDialog } from "./edit-entry-dialog";
import { EmptyDays, RouteCities } from "./route-cities";
import { TripCalendar } from "./trip-calendar";
import { withEmptyDays } from "../domain/itinerary-plan";
import { cityToneClass, cityToneMap } from "../domain/tone";
import {
  clampDay,
  dateOfDay,
  itineraryOverrun,
  weekdayAfterDayNumber,
} from "../domain/trip-days";
import { NightStay } from "./night-stay";
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
}: ItineraryProps) {
  const [scheduled, setScheduled] = useState<ItineraryDay[]>(initialItinerary);
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
  const suggestingCity =
    suggestingDay !== null
      ? (lodgingByDay[suggestingDay]?.booking.city ?? null)
      : null;

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
      <div className="mx-auto flex w-full max-w-main flex-col gap-4">
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
    );
  }

  const activeCity = cityOfDay.get(active.day) ?? null;
  const activeDate = dateOfDay(startDate, active.day);
  const stay = lodgingByDay[active.day] ?? null;
  const isEmpty = active.items.length === 0;

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

          {stops.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading level="section">הערים במסלול</SectionHeading>
              <RouteCities
                stops={stops}
                startDate={startDate}
                tones={tones}
                activeDay={active.day}
                currentDay={currentDay}
                onSelect={setChosenDay}
              />
            </section>
          )}

          <EmptyDays
            dayNumbers={emptyDayNumbers}
            startDate={startDate}
            onSelect={setChosenDay}
          />

          {/* The controls about the whole itinerary rather than about the day on
              screen: how many days each city gets, and the build that consumes
              it. They used to sit above the days, where they were the first two
              things on a screen whose subject is the schedule. */}
          <section className="flex flex-col gap-3">
            <SectionHeading level="section">הלו&quot;ז כולו</SectionHeading>
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
          </section>
        </>
      }
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
      />

      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2.5 gap-y-1",
          cityToneClass(tones, activeCity),
        )}
      >
        <h2 className="flex min-w-0 items-center gap-2 text-title font-black">
          <ToneDot />
          <span className="min-w-0 truncate">
            יום {active.day}
            {activeCity && ` · ${activeCity}`}
          </span>
        </h2>
        {activeDate && (
          <span className="text-sm text-muted">
            {weekdayAfterDayNumber(activeDate)}
          </span>
        )}
        <span className="ms-auto shrink-0 text-caption font-semibold text-muted">
          מתוך {dayCount}
        </span>
      </div>

      <NightStay stay={stay} />

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
        onEdit={setEditingId}
        bookings={bookingsByDay[active.day] ?? []}
        date={activeDate}
      />

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
