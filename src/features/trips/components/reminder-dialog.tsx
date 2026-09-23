"use client";

import { useState, useTransition } from "react";
import { Bell, Check, Pencil, Trash2 } from "lucide-react";
import { Banner, Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { DayReminder } from "../domain/day-reminders";
import {
  addDayReminder,
  editDayReminder,
  removeDayReminder,
  toggleDayReminder,
} from "../application/reminder-actions";

// The form, once, for both ways in.
//
// Adding and correcting a reminder ask the same three questions, so they are
// the same three fields — extracted when editing arrived rather than copied,
// because two forms that must agree is how a `maxLength` ends up on one of them
// and not the other.
//
// The caller owns the action; this owns the fields, the errors and the pending
// state. `open` remounts it by key from each caller, which is what resets a
// half-typed edit that was cancelled.
function ReminderFormDialog({
  open,
  onClose,
  heading,
  submitLabel,
  dayCount,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  submitLabel: string;
  dayCount: number;
  initial: { dayNumber: number; timeLabel: string; title: string };
  onSubmit: (values: {
    dayNumber: number;
    timeLabel: string;
    title: string;
  }) => Promise<{
    ok: boolean;
    errors?: Record<string, string>;
    message?: string;
  }>;
}) {
  const [day, setDay] = useState(String(initial.dayNumber));
  const [time, setTime] = useState(initial.timeLabel);
  const [title, setTitle] = useState(initial.title);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({
        dayNumber: Number(day),
        timeLabel: time,
        title,
      });
      if (result.ok) {
        onClose();
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={heading}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="יום" error={errors.dayNumber}>
            <Select value={day} onChange={(event) => setDay(event.target.value)}>
              {Array.from(
                { length: Math.max(dayCount, initial.dayNumber) },
                (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    יום {i + 1}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="שעה" error={errors.timeLabel}>
            <Input
              type="time"
              dir="ltr"
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="text-center"
              aria-invalid={Boolean(errors.timeLabel)}
            />
          </Field>
        </div>
        <Field label="מה להזכיר" error={errors.title}>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="להתקשר למלון על צ׳ק-אין מאוחר"
            maxLength={120}
            aria-invalid={Boolean(errors.title)}
          />
        </Field>
        <p className="text-caption text-muted">
          התזכורת תופיע בתוך הלו״ז של אותו יום, בשעה שקבעתם.
        </p>
        {message && <Banner tone="danger">{message}</Banner>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// "At 17:30 on day 3, call the hotel." The button opens the form above; the
// reminder then shows up inside that day's timeline at its hour (see
// ReminderRow below), where it is ticked off like a task.
export function AddReminderButton({
  tripId,
  dayNumber,
  dayCount,
  size = "sm",
  className,
}: {
  tripId: string;
  // The day the form opens on.
  dayNumber: number;
  dayCount: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Bumped on every open, which remounts the form and so clears whatever was
  // typed into the last one that was cancelled.
  const [generation, setGeneration] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={className}
        onClick={() => {
          setGeneration((current) => current + 1);
          setOpen(true);
        }}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        תזכורת
      </Button>

      {open && (
        <ReminderFormDialog
          key={generation}
          open
          onClose={() => setOpen(false)}
          heading="תזכורת ביום"
          submitLabel="הוספה"
          dayCount={dayCount}
          initial={{ dayNumber, timeLabel: "", title: "" }}
          onSubmit={(values) => addDayReminder(tripId, values)}
        />
      )}
    </>
  );
}

// A reminder inside the day's timeline. Amber like everything that says
// "now/attention", with a check that ticks it off and a trash that removes it.
export function ReminderRow({
  tripId,
  reminder,
  compact = false,
  readOnly = false,
  // How many days the trip has, for the day picker in the edit form. Defaults
  // to the reminder's own day, which makes the picker a single option — right
  // for a caller that does not know the trip's length, and never wrong.
  dayCount,
  // Its hour has gone by and it is not ticked off. Decided by the caller, which
  // is the only place that knows whether the day on screen is the day being
  // lived — see isOverdue.
  overdue = false,
}: {
  tripId: string;
  reminder: DayReminder;
  compact?: boolean;
  readOnly?: boolean;
  dayCount?: number;
  overdue?: boolean;
}) {
  const [done, setDone] = useState(reminder.done);
  const [gone, setGone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  if (gone) return null;

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      if (!(await toggleDayReminder(tripId, reminder.id, next))) {
        setDone(!next);
        showToast("העדכון נכשל. נסו שוב.", "danger");
      }
    });
  }

  function remove() {
    setGone(true);
    startTransition(async () => {
      if (!(await removeDayReminder(tripId, reminder.id))) {
        setGone(false);
        showToast("ההסרה נכשלה. נסו שוב.", "danger");
      }
    });
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        compact ? "px-4 py-2.5" : "rounded-card border border-callout/40 bg-callout-tint/40 px-3.5 py-2.5",
        done && "opacity-60",
      )}
    >
      {compact && (
        <span
          className={cn(
            "w-11 shrink-0 text-caption font-bold tabular-nums",
            // The hour is where "late" belongs: it is the hour that is late,
            // and colouring the title instead would say the task is wrong
            // rather than the clock.
            overdue ? "text-danger-ink" : "text-muted",
          )}
        >
          {reminder.time_label}
        </span>
      )}
      {/* Not in the compact list. In a card whose heading is a bell and whose
          every row carries an hour, a bell per row identifies nothing — and it
          is 44px of a 375px row, taken from the only column that has something
          to say. Measured: the titles in the list were wrapping to four lines
          with this in place. It stays in the standalone row, which appears on
          its own inside a timeline and does have to say what it is. */}
      {!compact && (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
            done ? "bg-surface-2 text-muted" : "bg-callout-tint text-callout-ink",
          )}
          aria-hidden="true"
        >
          <Bell className="h-4 w-4" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {!compact && (
          <span className="text-caption font-bold tabular-nums text-muted">
            {reminder.time_label} · תזכורת
          </span>
        )}
        <span
          className={cn(
            "min-w-0 text-sm font-semibold wrap-anywhere",
            done && "line-through",
          )}
        >
          {reminder.title}
        </span>
        {overdue && (
          <span className="text-caption font-semibold text-danger-ink">
            עבר הזמן
          </span>
        )}
      </span>
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={done}
            aria-label={done ? "סמנו כלא בוצע" : "סמנו כבוצע"}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              done
                ? "border-success bg-success text-white"
                : "border-border-strong bg-surface text-transparent hover:border-success hover:text-success",
            )}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          {/* A reminder is typed in a hurry, on a phone, while something else
              is happening — "17:30" when you meant "19:30" is the ordinary
              case, and before this the only way to correct it was to delete it
              and type the whole thing again. */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            aria-label={`עריכת התזכורת ״${reminder.title}״`}
            className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="הסרת התזכורת"
            className="rounded-control p-1.5 text-muted hover:bg-danger-tint hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>

          {editing && (
            <ReminderFormDialog
              open
              onClose={() => setEditing(false)}
              heading="עריכת תזכורת"
              submitLabel="שמירה"
              dayCount={dayCount ?? reminder.day_number}
              initial={{
                dayNumber: reminder.day_number,
                timeLabel: reminder.time_label,
                title: reminder.title,
              }}
              onSubmit={(values) =>
                editDayReminder(tripId, reminder.id, values)
              }
            />
          )}
        </>
      )}
    </div>
  );
}
