"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addBooking } from "../application/booking-actions";
import {
  BOOKING_KINDS,
  DEFAULT_REMINDER_DAYS,
  REMINDER_PRESETS,
} from "../domain/booking";
import type {
  BookingFormState,
  BookingKind,
  CreateBookingInput,
} from "../domain/booking";

const KINDS = Object.keys(BOOKING_KINDS) as BookingKind[];

// "Custom" is not one of the presets — it is the escape hatch that reveals a
// number input, so it needs a value the preset list cannot collide with.
const CUSTOM = "custom";

type Field = keyof CreateBookingInput;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-xs text-danger-ink">
      {message}
    </span>
  );
}

// The form changes shape with the kind: transport asks where from and where to,
// lodging asks for one address. Keeping it one form rather than three means one
// action and one validation path.
export function BookingForm({
  tripId,
  cities,
}: {
  tripId: string;
  // The trip's destinations, to attach a booking to one of them.
  cities: string[];
}) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(
    addBooking,
    {},
  );
  const [kind, setKind] = useState<BookingKind>("flight");
  const isTransport = BOOKING_KINDS[kind].isTransport;

  // Whether this is a real reservation or something still to be booked. The
  // rejected-submission echo records it either way (see submittedValues), so a
  // validation error cannot quietly flip it back.
  const [booked, setBooked] = useState(() =>
    state.values ? state.values.booked === "on" : true,
  );
  const [leadChoice, setLeadChoice] = useState<string>(
    String(DEFAULT_REMINDER_DAYS),
  );

  // React resets the form's DOM once the action finishes, and a reset restores
  // each input from its `defaultChecked`/`defaultValue` *attribute* — which
  // React does not maintain for an input driven by `checked`. So a controlled
  // checkbox loses to the reset and drifts from the state behind it. The symptom
  // is quiet and bad: the box shows "already booked" while the form behaves as
  // unbooked, and the next submit sends the opposite of what is on screen.
  //
  // The fix is to let the DOM own the checkbox (`defaultChecked`, which a reset
  // honours) and remount it whenever an action result arrives, so its default is
  // re-applied from what was actually submitted. `booked` then exists only to
  // decide whether the booking-deadline field is shown.
  //
  // Synced during render — React's documented way to adjust state when incoming
  // input changes — rather than in an effect, so the two are never painted
  // disagreeing.
  const [seenState, setSeenState] = useState(state);
  const [formGeneration, setFormGeneration] = useState(0);
  if (state !== seenState) {
    setSeenState(state);
    setBooked(state.values ? state.values.booked === "on" : true);
    setFormGeneration((generation) => generation + 1);
  }

  // React resets an uncontrolled form once its action finishes, failure
  // included. Feeding the submitted values back in as defaults is what makes a
  // rejected submission a correction rather than a retype. On success the
  // action returns no values, so the reset clears the form — which is right.
  const was = (field: Field) => state.values?.[field] ?? "";
  const errorFor = (field: Field) => state.fieldErrors?.[field]?.[0];

  // Marks the field itself, so the message isn't the only clue to where the
  // problem is.
  const fieldClass = (field: Field) =>
    errorFor(field) ? "border-danger focus-visible:ring-danger" : undefined;

  return (
    <Card className="p-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="kind" value={kind} />

        <div className="flex flex-wrap gap-2">
          {KINDS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                kind === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary",
              )}
            >
              {BOOKING_KINDS[key].emoji} {BOOKING_KINDS[key].label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">
            {isTransport ? "מספר טיסה / רכבת" : "שם המלון"}
          </span>
          <Input
            name="title"
            required
            maxLength={120}
            defaultValue={was("title")}
            aria-invalid={Boolean(errorFor("title"))}
            className={fieldClass("title")}
          />
          <FieldError message={errorFor("title")} />
        </label>

        {isTransport ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">מ־</span>
              <Input
                name="origin"
                maxLength={120}
                defaultValue={was("origin")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">אל־</span>
              <Input
                name="destination"
                maxLength={120}
                defaultValue={was("destination")}
              />
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">כתובת</span>
            <Input
              name="address"
              maxLength={300}
              defaultValue={was("address")}
            />
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              {isTransport ? "יציאה" : "צ׳ק-אין"}
            </span>
            <Input
              type="datetime-local"
              name="startsAt"
              required
              dir="ltr"
              defaultValue={was("startsAt")}
              aria-invalid={Boolean(errorFor("startsAt"))}
              className={fieldClass("startsAt")}
            />
            <FieldError message={errorFor("startsAt")} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              {isTransport ? "הגעה (לא חובה)" : "צ׳ק-אאוט"}
            </span>
            <Input
              type="datetime-local"
              name="endsAt"
              dir="ltr"
              defaultValue={was("endsAt")}
              aria-invalid={Boolean(errorFor("endsAt"))}
              className={fieldClass("endsAt")}
            />
            <FieldError message={errorFor("endsAt")} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">יעד בטיול (לא חובה)</span>
            <select
              name="city"
              defaultValue={was("city")}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            >
              <option value="">—</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">מספר אישור (לא חובה)</span>
            <Input
              name="confirmation"
              maxLength={120}
              dir="ltr"
              defaultValue={was("confirmation")}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">הערות (לא חובה)</span>
          <Textarea
            name="note"
            rows={2}
            maxLength={1000}
            defaultValue={was("note")}
          />
        </label>

        {/* ---- Deadlines and reminders (0011) --------------------------------
            Separated by a rule because everything above describes the booking
            itself, and everything below is about what you have to *do* before
            the trip. */}
        <div className="flex flex-col gap-3 border-t border-dashed border-border pt-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              // Remounted on each action result so the reset-restored default
              // matches what was submitted. See the note above.
              key={formGeneration}
              type="checkbox"
              name="booked"
              defaultChecked={booked}
              onChange={(event) => setBooked(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              כבר הזמנתי
              <span className="block text-xs text-muted">
                בטלו את הסימון אם זה משהו שעוד צריך להזמין — למשל רכבת שדורשת
                הזמנה מראש.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Only meaningful while unbooked; the service drops it otherwise,
                and hiding it keeps the form from asking a question that has no
                answer for a ticket already in hand. */}
            {!booked && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">להזמין עד</span>
                <Input
                  type="date"
                  name="bookBy"
                  dir="ltr"
                  defaultValue={was("bookBy")}
                  aria-invalid={Boolean(errorFor("bookBy"))}
                  className={fieldClass("bookBy")}
                />
                <FieldError message={errorFor("bookBy")} />
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">
                ביטול חינם עד{" "}
                <span className="text-xs">(אם יש)</span>
              </span>
              {/* A date, not a datetime: the column is `date`, because no
                  time-of-day reads as the same calendar day everywhere. */}
              <Input
                type="date"
                name="freeCancellationUntil"
                dir="ltr"
                defaultValue={was("freeCancellationUntil")}
                aria-invalid={Boolean(errorFor("freeCancellationUntil"))}
                className={fieldClass("freeCancellationUntil")}
              />
              <FieldError message={errorFor("freeCancellationUntil")} />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-muted">
              להזכיר לי מראש
            </legend>
            <div className="flex flex-wrap gap-2">
              {[...REMINDER_PRESETS, CUSTOM].map((preset) => {
                const value = String(preset);
                const active = leadChoice === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-primary",
                    )}
                  >
                    <input
                      type="radio"
                      name="reminderChoice"
                      value={value}
                      checked={active}
                      onChange={() => setLeadChoice(value)}
                      className="sr-only"
                    />
                    {preset === CUSTOM
                      ? "אחר"
                      : preset === 1
                        ? "יום לפני"
                        : `${preset} ימים`}
                  </label>
                );
              })}
            </div>

            {leadChoice === CUSTOM ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">כמה ימים מראש</span>
                <Input
                  type="number"
                  name="reminderDaysBefore"
                  min={0}
                  max={60}
                  dir="ltr"
                  placeholder="למשל 10"
                  defaultValue={was("reminderDaysBefore")}
                  aria-invalid={Boolean(errorFor("reminderDaysBefore"))}
                  className={cn("sm:max-w-40", fieldClass("reminderDaysBefore"))}
                />
                <FieldError message={errorFor("reminderDaysBefore")} />
              </label>
            ) : (
              // The chosen preset travels in a hidden field, so the server sees
              // one field name whichever way the number was picked.
              <input
                type="hidden"
                name="reminderDaysBefore"
                value={leadChoice}
              />
            )}

            <p className="text-xs text-muted">
              התראה אחת בלבד, ביום שבחרתם — לא בכל יום עד המועד. כדי לקבל אותה
              כשהאפליקציה סגורה, הפעילו ״תזכורות למכשיר״ למטה.
            </p>
          </fieldset>
        </div>

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר…" : "הוסף"}
          </Button>
        </div>

        {state.error && <p className="text-sm text-danger-ink">{state.error}</p>}
      </form>
    </Card>
  );
}
