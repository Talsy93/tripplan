"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRadio,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addBooking, editBooking } from "../application/booking-actions";
import {
  BOOKING_KINDS,
  DEFAULT_REMINDER_DAYS,
  REMINDER_PRESETS,
  splitDuration,
  toDateTimeLocal,
} from "../domain/booking";
import { CURRENCIES, DEFAULT_CURRENCY } from "../domain/expenses";
import type {
  Booking,
  BookingFormState,
  BookingKind,
  CreateBookingInput,
} from "../domain/booking";
import { DomainIcon } from "./domain-icon";

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

// The values an existing booking pre-fills the form with, in the same
// camelCase shape `was()` below reads — so editing reuses the exact same
// defaulting path a rejected submission already uses, rather than a second
// one.
function bookingDefaults(booking: Booking | undefined): Partial<Record<Field, string>> {
  if (!booking) return {};
  return {
    title: booking.title,
    origin: booking.origin ?? "",
    destination: booking.destination ?? "",
    city: booking.city ?? "",
    startsAt: toDateTimeLocal(booking.starts_at),
    endsAt: booking.ends_at ? toDateTimeLocal(booking.ends_at) : "",
    address: booking.address ?? "",
    confirmation: booking.confirmation ?? "",
    note: booking.note ?? "",
    freeCancellationUntil: booking.free_cancellation_until ?? "",
    bookBy: booking.book_by ?? "",
    reminderDaysBefore:
      booking.reminder_days_before !== null
        ? String(booking.reminder_days_before)
        : String(DEFAULT_REMINDER_DAYS),
    costAmount: booking.cost_amount !== null ? String(booking.cost_amount) : "",
    durationMinutes:
      booking.duration_minutes !== null ? String(booking.duration_minutes) : "",
    costCurrency: booking.cost_currency ?? "",
  };
}

// The form changes shape with the kind: transport asks where from and where to,
// lodging asks for one address. Keeping it one form rather than three means one
// action and one validation path.
//
// Editing reuses this same form rather than a second component: `booking`
// present switches the action to editBooking and seeds every field from it —
// the shape of "describe a booking" doesn't change between adding one and
// correcting one.
export function BookingForm({
  tripId,
  cities,
  booking,
  onSuccess,
}: {
  tripId: string;
  // The trip's destinations, to attach a booking to one of them.
  cities: string[];
  // Present only when editing an existing row.
  booking?: Booking;
  // Fired after a successful save — the edit dialog closes itself with this.
  onSuccess?: () => void;
}) {
  const isEdit = booking !== undefined;
  const [state, action, pending] = useActionState<BookingFormState, FormData>(
    isEdit ? editBooking : addBooking,
    {},
  );
  const defaults = bookingDefaults(booking);
  const [kind, setKind] = useState<BookingKind>(booking?.kind ?? "flight");
  const isTransport = BOOKING_KINDS[kind].isTransport;

  // Whether this is a real reservation or something still to be booked. The
  // rejected-submission echo records it either way (see submittedValues), so a
  // validation error cannot quietly flip it back.
  const [booked, setBooked] = useState(() =>
    state.values ? state.values.booked === "on" : (booking?.booked ?? true),
  );
  const [leadChoice, setLeadChoice] = useState<string>(() => {
    const initial = defaults.reminderDaysBefore;
    if (initial === undefined) return String(DEFAULT_REMINDER_DAYS);
    return (REMINDER_PRESETS as readonly number[]).some((preset) => String(preset) === initial)
      ? initial
      : CUSTOM;
  });

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

  // Fired from an effect rather than during the render above: showToast
  // updates ToastProvider, an ancestor, and React does not allow one
  // component's render to schedule another component's state update. Keyed
  // off a true→false edge on `pending` rather than `state` itself, so the
  // identical initial state ({}, no error, no values) cannot be mistaken for
  // a just-completed submission on mount.
  const { showToast } = useToast();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error && !state.fieldErrors) {
      showToast(
        isEdit ? BOOKING_KINDS[kind].updatedLabel : BOOKING_KINDS[kind].addedLabel,
      );
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, kind, isEdit, showToast, onSuccess]);

  // React resets an uncontrolled form once its action finishes, failure
  // included. Feeding the submitted values back in as defaults is what makes a
  // rejected submission a correction rather than a retype. On success the
  // action returns no values, so the reset clears the form — which is right
  // for adding; an edit form closes on success instead (see onSuccess above),
  // so it never gets the chance to reset against a booking that's now stale.
  const was = (field: Field) => state.values?.[field] ?? defaults[field] ?? "";
  const errorFor = (field: Field) => state.fieldErrors?.[field]?.[0];
  const hasFieldErrors = Object.values(state.fieldErrors ?? {}).some(
    (messages) => (messages?.length ?? 0) > 0,
  );

  // Marks the field itself, so the message isn't the only clue to where the
  // problem is.
  const fieldClass = (field: Field) =>
    errorFor(field) ? "border-danger focus-visible:ring-danger" : undefined;

  // The duration is two boxes on screen and one figure everywhere else, so the
  // split happens here — against `was`, which already resolves the echo from a
  // rejected submit ahead of the booking being edited. Splitting the booking
  // directly would throw away what was typed on exactly the submission that
  // needs it kept.
  const durationParts = splitDuration(was("durationMinutes"));

  // Adding sits directly on the page and needs Card's own surface; editing
  // already lives inside a Dialog, which is a surface of its own — nesting
  // Card there would be a card inside a card.
  const Wrapper = isEdit ? Fragment : Card;

  return (
    <Wrapper>
      {/* noValidate on purpose. With native validation on, an empty required
          field blocks the submit before the action runs, so the server's Hebrew
          field errors never get to render — and the browser's own bubble is
          easy to miss, which read as "the button does nothing". One validation
          path now: Zod on the server, reported next to the field it belongs to.
          `required` stays for screen readers. */}
      <form action={action} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="kind" value={kind} />
        {isEdit && <input type="hidden" name="id" value={booking.id} />}

        {/* A summary at the top, because the field that failed can be below the
            fold on a phone — and a form that silently refuses to submit is the
            worst possible feedback. */}
        {hasFieldErrors && (
          <Banner tone="danger">
            יש שדות חסרים או שגויים. בדקו את המסומנים למטה.
          </Banner>
        )}

        <div className="flex flex-wrap gap-2">
          {KINDS.map((key) => (
            <Chip
              key={key}
              active={kind === key}
              onClick={() => setKind(key)}
            >
              <DomainIcon name={BOOKING_KINDS[key].icon} />
              {BOOKING_KINDS[key].label}
            </Chip>
          ))}
        </div>

        <label className="flex min-w-0 flex-col gap-1 text-sm">
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
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-muted">מ־</span>
              <Input
                name="origin"
                maxLength={120}
                defaultValue={was("origin")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-muted">אל־</span>
              <Input
                name="destination"
                maxLength={120}
                defaultValue={was("destination")}
              />
            </label>
          </div>
        ) : (
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">כתובת</span>
            <Input
              name="address"
              maxLength={300}
              defaultValue={was("address")}
            />
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
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
          <label className="flex min-w-0 flex-col gap-1 text-sm">
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

        {/* Transport only, and asked for rather than computed.

            The two fields above are read as wall-clock in one zone (see
            src/lib/datetime.ts), which is right for showing them back — the
            board at Narita says 16:30 and so does the app — and useless for
            subtraction: on TLV→NRT their difference is 18h45m against a real
            11h25m. Deriving it would need an airport-to-timezone table the app
            has no way to build from a free-text "NRT", so the number is taken
            from the ticket the user is already copying from. Blank shows no
            duration at all; a wrong one is worse than none. */}
        {isTransport && (
          // Hours and minutes, not one box of minutes.
          //
          // It was a single "משך הנסיעה בדקות" field, so a flight went in as
          // 685 — a figure no ticket prints and nobody divides by 60 in their
          // head to check. The column still stores total minutes and every
          // reader of it is unchanged; the two boxes are joined in the action
          // by combineDuration and split back apart here.
          //
          // A fieldset rather than a label, because two inputs cannot share
          // one: a <label> points at a single control, and wrapping both in it
          // makes clicking the word focus whichever the browser guesses.
          <fieldset className="flex min-w-0 flex-col gap-1 border-0 p-0 text-sm">
            <legend className="text-muted">משך הנסיעה (לא חובה)</legend>
            <div className="flex min-w-0 items-start gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-28">
                <Input
                  type="number"
                  name="durationHours"
                  min={0}
                  max={336}
                  step={1}
                  dir="ltr"
                  placeholder="11"
                  defaultValue={durationParts.hours}
                  aria-invalid={Boolean(errorFor("durationMinutes"))}
                  aria-label="שעות"
                  className={fieldClass("durationMinutes")}
                />
                <span className="text-caption text-muted">שעות</span>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-28">
                {/* Capped at 59 rather than left open: over that is an hour,
                    and splitDuration would hand it straight back normalised —
                    a box that silently rewrites what was typed. The cap says
                    so up front instead. */}
                <Input
                  type="number"
                  name="durationMinutes"
                  min={0}
                  max={59}
                  step={5}
                  dir="ltr"
                  placeholder="25"
                  defaultValue={durationParts.minutes}
                  aria-invalid={Boolean(errorFor("durationMinutes"))}
                  aria-label="דקות"
                  className={fieldClass("durationMinutes")}
                />
                <span className="text-caption text-muted">דקות</span>
              </label>
            </div>
            <FieldError message={errorFor("durationMinutes")} />
            <span className="text-caption text-muted">
              כמו שמופיע בכרטיס. לא מחושב משעות היציאה וההגעה, כי שתיהן נשמרות
              בשעון אחד ולכן ההפרש ביניהן אינו משך הטיסה.
            </span>
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">יעד בטיול (לא חובה)</span>
            <Select name="city" defaultValue={was("city")}>
              <option value="">—</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">מספר אישור (לא חובה)</span>
            <Input
              name="confirmation"
              maxLength={120}
              dir="ltr"
              defaultValue={was("confirmation")}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">עלות (לא חובה)</span>
            <Input
              type="number"
              name="costAmount"
              min={0}
              step="0.01"
              dir="ltr"
              placeholder="0.00"
              defaultValue={was("costAmount")}
              aria-invalid={Boolean(errorFor("costAmount"))}
              className={fieldClass("costAmount")}
            />
            <FieldError message={errorFor("costAmount")} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">מטבע</span>
            {/* A picker, not a text field: a typed code is a typo waiting to
                split one currency into two totals that never sum. Defaults to
                shekels, which is what most of this trip is priced in. */}
            <Select
              name="costCurrency"
              defaultValue={was("costCurrency") || DEFAULT_CURRENCY}
              aria-invalid={Boolean(errorFor("costCurrency"))}
              className={fieldClass("costCurrency")}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.label}
                </option>
              ))}
            </Select>
            <FieldError message={errorFor("costCurrency")} />
          </label>
        </div>

        <label className="flex min-w-0 flex-col gap-1 text-sm">
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
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
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
              <label className="flex min-w-0 flex-col gap-1 text-sm">
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

            <label className="flex min-w-0 flex-col gap-1 text-sm">
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
                return (
                  <ChipRadio
                    key={value}
                    name="reminderChoice"
                    value={value}
                    checked={leadChoice === value}
                    onChange={() => setLeadChoice(value)}
                    label={
                      preset === CUSTOM
                        ? "אחר"
                        : preset === 1
                          ? "יום לפני"
                          : `${preset} ימים`
                    }
                  />
                );
              })}
            </div>

            {leadChoice === CUSTOM ? (
              <label className="flex min-w-0 flex-col gap-1 text-sm">
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
          <Button type="submit" loading={pending}>
            {isEdit ? "שמירה" : "הוספה"}
          </Button>
        </div>

        {state.error && <Banner tone="danger">{state.error}</Banner>}
      </form>
    </Wrapper>
  );
}
