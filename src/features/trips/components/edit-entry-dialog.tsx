"use client";

import { useState, useTransition } from "react";
import { Clock, Lock, Trash2 } from "lucide-react";
import {
  Banner,
  Button,
  Dialog,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { updateItineraryEntry } from "../application/itinerary-actions";
import type { ItineraryEntry } from "../domain/ai-suggestion";
import { DomainIcon } from "./domain-icon";

// Editing one entry of the itinerary.
//
// Until now the schedule was read-only apart from deletion: the AI's answer was
// the only answer, and a wrong hour meant rebuilding the whole itinerary and
// losing every other correction along with it.
//
// The travel fields are here rather than computed because the app genuinely
// cannot compute them — a straight-line distance needs coordinates at both ends,
// which only OSM-sourced items have, and free public-transport routing does not
// exist as an API. So this is where you write down what you looked up once.
export function EditEntryDialog({
  entry,
  dayNumber,
  dayCount,
  open,
  onClose,
  onRemove,
}: {
  entry: ItineraryEntry;
  dayNumber: number;
  // Days the itinerary currently has. The picker offers one past the end so an
  // entry can be pushed onto a new day.
  dayCount: number;
  open: boolean;
  onClose: () => void;
  // Removing the entry. It lives here rather than on the row because the row is
  // a list item people scroll past, and this is a dialog they opened on purpose
  // — the same move the trips list made with its delete.
  onRemove?: (entryId: string) => void;
}) {
  const [start, setStart] = useState(entry.startLabel);
  const [end, setEnd] = useState(entry.endLabel);
  const [day, setDay] = useState(String(dayNumber));
  const [note, setNote] = useState(entry.note);
  const [travelNote, setTravelNote] = useState(entry.travelNote ?? "");
  const [travelMinutes, setTravelMinutes] = useState(
    entry.travelMinutes === null ? "" : String(entry.travelMinutes),
  );
  const [fixed, setFixed] = useState(entry.fixed ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  // Covers the revalidation as well as the write, so the dialog cannot close
  // onto a list that has not caught up yet.
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const result = await updateItineraryEntry({
        id: entry.id,
        startLabel: start,
        endLabel: end,
        dayNumber: Number(day),
        note: note.trim() || null,
        travelNote: travelNote.trim() || null,
        travelMinutes: travelMinutes.trim() === "" ? null : Number(travelMinutes),
        fixed,
      });

      if (result.ok) {
        onClose();
        return;
      }
      if (result.errors) setErrors(result.errors);
      if (result.message) setMessage(result.message);
    });
  }

  // Days the picker offers: every day of the itinerary, plus one past the end
  // so an entry can be pushed onto a new day.
  const dayOptions = Array.from(
    { length: Math.max(dayCount, dayNumber) + 1 },
    (_, i) => i + 1,
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      // Pencil's sheet head: the place's tile, its name, and where it sits in
      // the trip on the line under it. Spans only — this renders inside the
      // dialog's <h2>.
      title={
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-cat-mustsee-tint text-cat-mustsee-ink"
            aria-hidden="true"
          >
            <DomainIcon name="attraction" className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xl leading-7 font-bold">
              {entry.title}
            </span>
            <span className="truncate text-xs font-normal text-muted">
              {[`יום ${dayNumber}`, entry.city].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Which day, as Pencil's segmented track rather than a <select>: the
            days are few and short, and seeing them all is how you pick one.
            Scrolls sideways on a long trip instead of wrapping. */}
        <div className="flex min-w-0 flex-col gap-2" role="group" aria-labelledby="entry-day-label">
          <span id="entry-day-label" className="text-sm font-semibold">
            באיזה יום
          </span>
          <div className="overflow-x-auto rounded-[14px] bg-surface-sunken p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-1">
              {dayOptions.map((value) => {
                const selected = day === String(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDay(String(value))}
                    className={cn(
                      "h-10 min-w-16 shrink-0 rounded-[10px] px-3 text-sm transition-[background-color,box-shadow] duration-press ease-snap",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "bg-surface font-bold text-foreground shadow-card"
                        : "font-medium text-muted hover:text-foreground",
                    )}
                  >
                    {value > dayCount ? "יום חדש" : `יום ${value}`}
                  </button>
                );
              })}
            </div>
          </div>
          {errors.dayNumber && (
            <span className="text-caption text-danger-ink">
              {errors.dayNumber}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="משעה" error={errors.startLabel}>
            <TimeInput
              value={start}
              onChange={setStart}
              placeholder="09:30"
              invalid={Boolean(errors.startLabel)}
            />
          </Field>
          <Field label="עד" error={errors.endLabel}>
            <TimeInput
              value={end}
              onChange={setEnd}
              placeholder="11:00"
              invalid={Boolean(errors.endLabel)}
            />
          </Field>
        </div>

        {/* Anchoring, as Pencil's toggle row. When the day is re-timed around
            an early or late arrival (the "הגענו" button, or the GPS prompt), a
            fixed entry keeps its hour and everything planned after it stays
            put too. */}
        <div className="flex items-center gap-3 rounded-[16px] bg-surface-2 p-3.5">
          <Lock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span id="entry-fixed-label" className="text-sm font-semibold">
              עיגון השעה
            </span>
            <span className="text-caption text-muted">
              שולחן שהוזמן, כרטיס לשעה מסוימת — השעה לא תזוז כשמעדכנים את
              הלו״ז לפי איפה שאתם.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={fixed}
            aria-labelledby="entry-fixed-label"
            onClick={() => setFixed((current) => !current)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-press ease-snap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              fixed ? "bg-primary" : "bg-border-strong",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-surface shadow-card transition-[inset-inline-start] duration-press ease-snap",
                fixed ? "start-6" : "start-1",
              )}
            />
          </button>
        </div>

        {/* The two fields the app cannot fill in for you. Pencil draws a
            walk / transit / taxi choice here; the entry stores free text and
            minutes rather than a mode, so the words stay words. */}
        <div className="flex flex-col gap-3">
          <Field
            label="איך מגיעים מהתחנה הקודמת"
            hint="קו, תחנה, כמה הליכה — מה שלא תרצו לחפש שוב ביום עצמו."
            error={errors.travelNote}
          >
            <Textarea
              value={travelNote}
              onChange={(event) => setTravelNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="מטרו קו A עד Ottaviano, ואז 8 דקות הליכה"
              className="rounded-[14px]"
            />
          </Field>
          <Field label="כמה זמן בדרך" error={errors.travelMinutes}>
            <span className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={1440}
                inputMode="numeric"
                value={travelMinutes}
                onChange={(event) => setTravelMinutes(event.target.value)}
                placeholder="25"
                dir="ltr"
                className="h-12 max-w-28 rounded-[14px] text-center"
                aria-invalid={Boolean(errors.travelMinutes)}
              />
              <span className="text-sm text-muted">דקות</span>
            </span>
          </Field>
        </div>

        <Field label="הערה" error={errors.note}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={1000}
            className="rounded-[14px]"
          />
        </Field>

        {message && <Banner tone="danger">{message}</Banner>}

        {/* Pencil's foot: the save as the sheet's one terracotta action, and
            removal as a red word at the far end — far from the save, where a
            mis-tap does not land. Closing is the sheet's own ×. */}
        <div className="flex items-center gap-4 pt-1">
          <Button
            type="submit"
            size="lg"
            loading={pending}
            className="h-[3.25rem] flex-1 rounded-full text-base"
          >
            שמירה
          </Button>
          {onRemove && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onRemove(entry.id);
                onClose();
              }}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              הסרה
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

// A time field with the clock at its start, as the sheet draws it. Still a
// text input taking "09:30" — the server validates the label, and a native
// time picker would hand back the browser's locale format instead.
function TimeInput({
  value,
  onChange,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid: boolean;
}) {
  return (
    <span className="relative flex">
      <Clock
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="h-12 rounded-[14px] px-9 text-center text-base font-semibold tabular-nums"
        aria-invalid={invalid}
      />
    </span>
  );
}
