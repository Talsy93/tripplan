"use client";

import { useState, useTransition } from "react";
import { CalendarHeart, X } from "lucide-react";
import { Banner, Button, Dialog, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  DAY_NOTE_KINDS,
  DAY_NOTE_KINDS_INFO,
  type DayNote,
  type DayNoteKind,
} from "../domain/day-notes";
import { addDayNote, removeDayNote } from "../application/day-note-actions";
import { DomainIcon } from "./domain-icon";

// Migration 0025. "A point to mark on that day regardless of the schedule."
//
// Two pieces: the button that adds one, and the band that shows what a day has.
// They are in one file because the band is the only thing the button produces,
// and splitting them would mean two files that only make sense read together.

export function AddDayNoteButton({
  tripId,
  dayNumber,
  dayCount,
  size = "sm",
  className,
}: {
  tripId: string;
  dayNumber: number;
  dayCount: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(String(dayNumber));
  const [kind, setKind] = useState<DayNoteKind>("holiday");
  const [label, setLabel] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setDay(String(dayNumber));
    setKind("holiday");
    setLabel("");
    setErrors({});
    setMessage(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addDayNote(tripId, {
        dayNumber: Number(day),
        kind,
        label,
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
        <CalendarHeart className="h-4 w-4" aria-hidden="true" />
        ציון ליום
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="מה מיוחד ביום הזה?"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-caption text-muted">
            משהו שנכון לכל היום ולא לשעה מסוימת. זה גם ייכנס לבניית הלו&quot;ז —
            ביום חג, למשל, הרבה מקומות סגורים.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="יום" error={errors.dayNumber}>
              <Select
                value={day}
                onChange={(event) => setDay(event.target.value)}
              >
                {Array.from(
                  { length: Math.max(dayCount, dayNumber) },
                  (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      יום {index + 1}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="סוג" error={errors.kind}>
              <Select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as DayNoteKind)
                }
              >
                {DAY_NOTE_KINDS.map((key) => (
                  <option key={key} value={key}>
                    {DAY_NOTE_KINDS_INFO[key].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="מה לציין"
            error={errors.label}
            hint="במילים שלכם — זה מה שהמודל יקרא"
          >
            <Input
              autoFocus
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="יום כיפור — הכול סגור"
              maxLength={80}
              aria-invalid={Boolean(errors.label)}
            />
          </Field>

          {message && <Banner tone="danger">{message}</Banner>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
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

// What a day is marked with, above its schedule.
//
// Above and not inside: a note has no hour, so it has nowhere to sit on a
// timeline — and putting it at the top with a fabricated 00:00 is exactly the
// thing domain/day-notes.ts explains this is not.
export function DayNotes({
  tripId,
  notes,
  // Absent on the share page, where the band shows and does nothing.
  editable = true,
}: {
  tripId?: string;
  notes: DayNote[];
  editable?: boolean;
}) {
  if (notes.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {notes.map((note) => (
        <li key={note.id}>
          <DayNoteBand
            tripId={tripId}
            note={note}
            editable={editable && Boolean(tripId)}
          />
        </li>
      ))}
    </ul>
  );
}

function DayNoteBand({
  tripId,
  note,
  editable,
}: {
  tripId?: string;
  note: DayNote;
  editable: boolean;
}) {
  const info = DAY_NOTE_KINDS_INFO[note.kind];
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-control border px-3 py-2",
        info.tone === "callout" && "border-callout bg-callout-tint text-callout-ink",
        info.tone === "primary" && "border-primary bg-primary-tint text-primary-ink",
        info.tone === "neutral" && "border-border bg-surface-2 text-foreground",
        pending && "opacity-50",
      )}
    >
      <DomainIcon name={info.icon} className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="text-caption font-bold">{info.label}</span>
        <span className="min-w-0 text-sm wrap-anywhere">{note.label}</span>
      </span>
      {editable && tripId && (
        // At rest rather than revealed, unlike a list row's bin: this band is
        // one line the traveller added themselves and the whole of it is the
        // control's context, so there is no row of content for a red icon to
        // compete with. Also the reason it is an X and not a bin — it removes
        // a label, it does not delete a thing.
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeDayNote(tripId, note.id);
            })
          }
          aria-label={`הסרת הציון ״${note.label}״`}
          className="shrink-0 rounded-control p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
