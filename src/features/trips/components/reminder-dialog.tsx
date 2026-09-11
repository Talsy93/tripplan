"use client";

import { useState, useTransition } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Banner, Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { DayReminder } from "../domain/day-reminders";
import {
  addDayReminder,
  removeDayReminder,
  toggleDayReminder,
} from "../application/reminder-actions";

// "At 17:30 on day 3, call the hotel." The button opens a small form; the
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
  const [day, setDay] = useState(String(dayNumber));
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setDay(String(dayNumber));
    setTime("");
    setTitle("");
    setErrors({});
    setMessage(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addDayReminder(tripId, {
        dayNumber: Number(day),
        timeLabel: time,
        title,
      });
      if (result.ok) {
        setOpen(false);
        reset();
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={className}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        תזכורת
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="תזכורת ביום"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="יום" error={errors.dayNumber}>
              <Select value={day} onChange={(event) => setDay(event.target.value)}>
                {Array.from({ length: Math.max(dayCount, dayNumber) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    יום {i + 1}
                  </option>
                ))}
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
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ביטול
            </Button>
            <Button type="submit" loading={pending}>
              הוספה
            </Button>
          </div>
        </form>
      </Dialog>
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
}: {
  tripId: string;
  reminder: DayReminder;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const [done, setDone] = useState(reminder.done);
  const [gone, setGone] = useState(false);
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
        <span className="w-11 shrink-0 text-caption font-bold tabular-nums text-muted">
          {reminder.time_label}
        </span>
      )}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
          done ? "bg-surface-2 text-muted" : "bg-callout-tint text-callout-ink",
        )}
        aria-hidden="true"
      >
        <Bell className="h-4 w-4" />
      </span>
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
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="הסרת התזכורת"
            className="rounded-control p-1.5 text-muted hover:bg-danger-tint hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
