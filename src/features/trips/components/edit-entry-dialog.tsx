"use client";

import { useState, useTransition } from "react";
import {
  Banner,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { updateItineraryEntry } from "../application/itinerary-actions";
import type { ItineraryEntry } from "../domain/ai-suggestion";

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
}: {
  entry: ItineraryEntry;
  dayNumber: number;
  // Days the itinerary currently has. The picker offers one past the end so an
  // entry can be pushed onto a new day.
  dayCount: number;
  open: boolean;
  onClose: () => void;
}) {
  const [start, setStart] = useState(entry.startLabel);
  const [end, setEnd] = useState(entry.endLabel);
  const [day, setDay] = useState(String(dayNumber));
  const [note, setNote] = useState(entry.note);
  const [travelNote, setTravelNote] = useState(entry.travelNote ?? "");
  const [travelMinutes, setTravelMinutes] = useState(
    entry.travelMinutes === null ? "" : String(entry.travelMinutes),
  );
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
      });

      if (result.ok) {
        onClose();
        return;
      }
      if (result.errors) setErrors(result.errors);
      if (result.message) setMessage(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={entry.title}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="שעת התחלה"
            hint="בפורמט 09:30"
            error={errors.startLabel}
          >
            <Input
              value={start}
              onChange={(event) => setStart(event.target.value)}
              placeholder="09:30"
              dir="ltr"
              className="text-center"
              aria-invalid={Boolean(errors.startLabel)}
            />
          </Field>
          <Field label="שעת סיום" error={errors.endLabel}>
            <Input
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              placeholder="11:00"
              dir="ltr"
              className="text-center"
              aria-invalid={Boolean(errors.endLabel)}
            />
          </Field>
        </div>

        <Field
          label="יום בטיול"
          hint="העברה ליום אחר מזיזה את הפריט בלוח."
          error={errors.dayNumber}
        >
          <Select value={day} onChange={(event) => setDay(event.target.value)}>
            {Array.from({ length: Math.max(dayCount, dayNumber) + 1 }, (_, i) => {
              const value = i + 1;
              return (
                <option key={value} value={value}>
                  יום {value}
                  {value > dayCount ? " (יום חדש)" : ""}
                </option>
              );
            })}
          </Select>
        </Field>

        <Field label="הערה" error={errors.note}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>

        {/* The two fields the app cannot fill in for you. */}
        <Field
          label="איך מגיעים"
          hint="קו, תחנה, כמה הליכה — מה שלא תרצו לחפש שוב ביום עצמו."
          error={errors.travelNote}
        >
          <Textarea
            value={travelNote}
            onChange={(event) => setTravelNote(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="מטרו קו A עד Ottaviano, ואז 8 דקות הליכה"
          />
        </Field>

        <Field
          label="זמן הגעה בדקות"
          hint="מוצג בלוח כדי שתדעו מתי לצאת."
          error={errors.travelMinutes}
        >
          <Input
            type="number"
            min={0}
            max={1440}
            inputMode="numeric"
            value={travelMinutes}
            onChange={(event) => setTravelMinutes(event.target.value)}
            placeholder="25"
            dir="ltr"
            className="max-w-32 text-center"
            aria-invalid={Boolean(errors.travelMinutes)}
          />
        </Field>

        {message && <Banner tone="danger">{message}</Banner>}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            שמירה
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
