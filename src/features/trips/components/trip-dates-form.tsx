"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { Banner, Button, Dialog, Field, Input } from "@/components/ui";
import { formatShortDate } from "../domain/trip";
import { setTripDates } from "../application/date-actions";
import type { TripDatesFormState } from "../domain/trip";

// The trip's dates, read as a row and changed behind a press.
//
// Asked for as "there is no need for a permanent edit display — show the name
// and the dates with an option to change them by pressing edit", and the form
// was the whole of the display: two date inputs and a save button, standing
// open on a screen where the dates are changed roughly once. The name already
// worked this way (TripNameButton), so this is the two of them agreeing.
//
// The form itself is unchanged and simply moved inside a dialog — same action,
// same fields, same validation. The dialog closes itself when the action comes
// back ok, which is the one thing a form that used to live on the page did not
// have to do.
export function TripDatesForm({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TripDatesFormState, FormData>(
    setTripDates,
    undefined,
  );

  // Closed by the result, not by the click that submitted it — a dialog that
  // closes on submit hides the error when the save fails.
  //
  // Synced during render rather than in an effect, which is React's documented
  // way to adjust state from changed input and the shape selected-list and
  // booking-form already use here. An effect would also paint the dialog once
  // more before closing it, and the lint rule that forbids it is right.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOpen(false);
  }

  const label = startDate
    ? endDate
      ? `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`
      : `יוצאים ב-${formatShortDate(startDate)}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-card bg-surface shadow-card px-4 py-3 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarDays
          className="h-5 w-5 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          {label ? (
            <span className="block min-w-0 truncate text-base font-semibold">
              {label}
            </span>
          ) : (
            // Not an empty row. A trip with no dates cannot build a schedule,
            // so this is the one state where the row is a prompt.
            <span className="block min-w-0 truncate text-base font-semibold text-primary-ink">
              הוסיפו תאריכים
            </span>
          )}
          {label && !endDate && (
            <span className="block text-caption text-muted">
              עוד לא נקבע תאריך חזרה
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-ink">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {label ? "שינוי" : "הוספה"}
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="תאריכי הטיול"
      >
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="tripId" value={tripId} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="תאריך יציאה">
              <Input
                type="date"
                name="start_date"
                defaultValue={startDate ?? ""}
                required
                dir="ltr"
              />
            </Field>
            <Field
              label={
                <>
                  תאריך חזרה{" "}
                  <span className="font-normal text-muted">(לא חובה)</span>
                </>
              }
            >
              <Input
                type="date"
                name="end_date"
                defaultValue={endDate ?? ""}
                dir="ltr"
              />
            </Field>
          </div>

          {state?.error && <Banner tone="danger">{state.error}</Banner>}

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
              שמירה
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
