"use client";

import { Bell } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isOverdue, reminderProgress } from "../domain/day-reminders";
import type { DayReminder } from "../domain/day-reminders";
import { AddReminderButton, ReminderRow } from "./reminder-dialog";

// The day's reminders as a to-do list, on the "היום" tab.
//
// Asked for as exactly that: "on the today tab make the reminders list a kind
// of to-do list of reminders that need doing."
//
// They were slotted into the day's timeline at their hour, between the museum
// and the restaurant. That is the right shape on the "ימים" tab, where the
// subject is the schedule and a reminder is one more thing that happens at a
// time — but "היום" is not about the shape of the day, it is about what you
// still have to do in it, and a task scattered among five other rows is a task
// you scroll past.
//
// So on this tab they are gathered: one card, a count of what is left, and the
// ones whose hour has gone by marked as late. The timeline on this tab no
// longer carries them — two copies of the same three reminders on one screen is
// the mistake the hotel made before it came off the timeline.
export function DayReminders({
  tripId,
  reminders,
  dayCount,
  // Minutes since midnight in the trip's zone, or null when the day on screen
  // is not the day being lived. Only used to mark a reminder late, which is
  // meaningless on any other day.
  nowMinutes = null,
}: {
  tripId: string;
  reminders: DayReminder[];
  dayCount: number;
  nowMinutes?: number | null;
}) {
  const progress = reminderProgress(reminders);
  const late = reminders.filter((reminder) =>
    isOverdue(reminder, nowMinutes),
  ).length;

  // Nothing to do is not an empty state worth drawing — the button that adds
  // the first one is already in the row of day actions above this.
  if (progress.total === 0) return null;

  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-callout-tint text-callout-ink">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-bold">לעשות היום</h3>

        {/* The late count leads when there is one: it is the reason to look at
            this card at all, and "2 מתוך 5" does not say that anything is
            wrong. */}
        {late > 0 && (
          <Badge tone="callout">
            {late === 1 ? "אחת עבר הזמן" : `${late} עבר הזמן`}
          </Badge>
        )}
        <Badge tone={progress.done === progress.total ? "success" : "neutral"}>
          {progress.done}/{progress.total}
        </Badge>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {reminders.map((reminder) => (
          <ReminderRow
            key={reminder.id}
            tripId={tripId}
            reminder={reminder}
            dayCount={dayCount}
            compact
            overdue={isOverdue(reminder, nowMinutes)}
          />
        ))}
      </div>

      {/* Adding from inside the list, as well as from the day's action row.
          A checklist you are working through is exactly when the next thing to
          remember occurs to you, and sending you back up to a button above the
          schedule to write it down is how it gets forgotten. */}
      <div className={cn("border-t border-border px-3 py-2")}>
        <AddReminderButton
          tripId={tripId}
          dayNumber={reminders[0].day_number}
          dayCount={dayCount}
        />
      </div>
    </Card>
  );
}
