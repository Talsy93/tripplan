"use client";

import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cityByDay } from "../domain/route";
import { cityToneClass, cityToneMap } from "../domain/tone";
import { dateOfDay } from "../domain/trip-days";
import { DayTimeline } from "./day-timeline";
import { AddReminderButton } from "./reminder-dialog";
import { AnchorsButton } from "./anchors-dialog";
import { RescheduleButton } from "./reschedule-button";
import { minutesOfDay, remindersForDay } from "../domain/day-reminders";
import { DayTiles } from "./day-tiles";
import { notesForDay } from "../domain/day-notes";
import { AddDayNoteButton, DayNotes } from "./day-note";
import type { DayReminder } from "../domain/day-reminders";
import type { DayNote } from "../domain/day-notes";
import type { Booking } from "../domain/booking";
import type { NightLodging } from "../domain/trip-days";
import type { ItineraryDay } from "../domain/ai-suggestion";
import { CalendarDays } from "lucide-react";

// One day — the one you are in — and nothing about the others.
//
// It was a pager: arrows to the previous and next day, the city and "day 3 of
// 14" between them, and a strip of every day in the trip under that. Reported
// as the duplication it was: "on the today tab do not show the schedule with
// all the other days, only what belongs to that day. It creates duplication
// like the route tab and there is no need for it."
//
// Right, and the two tabs had drifted into the same screen. "מסלול" is the tab
// about the shape of the trip — every day, a calendar, the cities, how long in
// each — and this one is about the day you are standing in. Paging through the
// whole trip from here made it a worse copy of the other, and it is also the
// wrong question: the day you want on this tab is today.
//
// What is left is what belongs to today: what it is marked with, where you
// sleep and what is left to do, the things you add to *this* day, and its
// schedule.
export function DayPanel({
  tripId,
  days,
  dayNumber,
  startDate,
  currentDay,
  bookingsByDay,
  lodgingByDay,
  reminders = [],
  dayNotes = [],
  nowIso,
}: {
  tripId: string;
  // Reminders for the whole trip (migration 0024); filtered per day here.
  reminders?: DayReminder[];
  // What each day is marked with (migration 0025) — a holiday, a rest day.
  // Same shape and the same reason: one query for the trip, filtered per day.
  dayNotes?: DayNote[];
  // When given, the day can be re-timed around "we are here now" — the
  // reschedule button appears. Only the running trip passes it.
  nowIso?: string;
  days: ItineraryDay[];
  // Which day this is. Decided by the page from the trip's phase — the day
  // being lived, or the last one once it is over.
  dayNumber: number;
  startDate: string | null;
  // The day the calendar says it is, or null outside the trip. Only used to
  // decide whether "late" means anything: a reminder for Thursday is not
  // overdue on Tuesday.
  currentDay: number | null;
  bookingsByDay: Record<number, Booking[]>;
  // Where you sleep on each night, which bookingsByDay cannot tell you: it
  // buckets a booking by its check-in alone, so a five-night hotel appears on
  // one day and nowhere else.
  lodgingByDay: Record<number, NightLodging>;
}) {
  const dayCount = days.length;
  const active = days.find((d) => d.day === dayNumber) ?? days[0];
  const tones = cityToneMap([...cityByDay(days).values()]);

  if (!active) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="עוד אין לו״ז"
        description="בנו לו״ז יומי בטאב ״ימים״, והוא יופיע כאן לפי התאריך."
      />
    );
  }

  const city = [...active.items].reverse().find((it) => it.city)?.city ?? null;
  const date = dateOfDay(startDate, active.day);
  const bookings = bookingsByDay[active.day] ?? [];

  // Always shown. This used to be suppressed on the check-in day, because
  // the timeline below was also listing the hotel as a row at its check-in hour
  // and two of them read as the same thing twice. The timeline no longer lists
  // lodging at all (see day-timeline), so the strip is the single statement of
  // where you sleep — and the day it was most worth having was exactly the day
  // it used to disappear on.
  const stay = lodgingByDay[active.day] ?? null;

  // The clock, but only on the day being lived. `nowIso` is passed by the
  // running trip alone, and "late" is meaningless on a day you are not in — a
  // reminder for Thursday is not overdue on Tuesday.
  const nowMinutes =
    nowIso && active.day === currentDay ? minutesOfDay(nowIso) : null;

  return (
    <div className={cn("flex flex-col gap-4", cityToneClass(tones, city))}>
      {/* The bookings used to be listed here as well as on the timeline
          below. They are the timeline's now — it is the component that knows
          where they sit in the day, and it was rendering the same three facts
          (emoji, title, time) a second time directly underneath.
          The time was also read with getHours(), i.e. the *viewer's* clock,
          while the timeline resolves it in the trip's zone. Two different
          answers for one departure was the real reason to pick one. */}
      {/* Above the schedule and above where you sleep, because it is true of
          the whole day rather than of a moment in it. */}
      <DayNotes
        tripId={tripId}
        notes={notesForDay(dayNotes, active.day)}
        dayCount={dayCount}
      />



      {/* One row, scrolling sideways rather than wrapping. Asked for as
          "a note/reminder for quick adding to that day, and updating the
          schedule — one row of buttons that scrolls".

          Wrapping was the alternative and it is worse here: four buttons at
          375px wrapped to two lines, and which two depended on how long the
          labels were, so the row changed height between days. A scroller keeps
          it one line always, and the fourth button peeking off the edge is what
          says there is more. */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [&>*]:shrink-0">
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
        {nowIso && (
          <RescheduleButton tripId={tripId} day={active} nowIso={nowIso} />
        )}
      </div>

      {/* Directions run from where you slept, so the timeline can offer a
          route to each of the day's places. */}
      {/* The bookings are listed above as cards already, so the timeline gets
          them only to place them on the axis — `bookings` there also widens
          the axis so an early departure is not clamped to the top edge. */}
      {/* The compact list — this is the screen the design draws it for: a
          reference you glance at after the card above has said what to do.
          scroll-mt clears the sticky app bar when NowCard's "הבא בתור" jumps
          here, so the first row does not land underneath it. */}
      {/* The day's reminders as a checklist, above the schedule and no longer
          inside it. On this tab the question is what you still have to do, not
          when in the day it sits — see DayReminders. */}
      {/* The bed and the to-do list, side by side. They were a full-width row
          and a full-width card stacked above the schedule; both answer a
          question one number wide. See DayTiles. */}
      <DayTiles
        tripId={tripId}
        stay={stay}
        reminders={remindersForDay(reminders, active.day)}
        dayNumber={active.day}
        dayCount={dayCount}
        nowMinutes={nowMinutes}
      />

      <div id="day-schedule" className="scroll-mt-20">
        <DayTimeline
          day={active}
          tripId={tripId}
          // Deliberately not passed here. They are the card above now, and the
          // same three reminders in both places is the duplication the hotel
          // had before it came off the timeline. The ימים tab still slots them
          // into the axis, where the subject is the shape of the day.
          dayCount={dayCount}
          variant="compact"
          bookings={bookings}
          date={date}
          // The ימים tab, not this one: adding to a day is an edit, and editing
          // a day happens where the day is the subject rather than where it is
          // the reference under the "now" card.
          addHref={`/trips/${tripId}/days`}
        />
      </div>
    </div>
  );
}
