"use client";

import { Fragment, useActionState, useEffect, useId, useRef, useState } from "react";
import {
  Banner,
  Button,
  Chip,
  ChipRadio,
  Dialog,
  Disclosure,
  InfoTip,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { Plus, X } from "lucide-react";
import { addBooking, editBooking } from "../application/booking-actions";
import {
  BOOKING_KINDS,
  DEFAULT_REMINDER_DAYS,
  REMINDER_PRESETS,
  bookingDetails,
  bookingStops,
  parseDetailsInput,
  splitDuration,
  toDateTimeLocal,
  type BookingDetails,
} from "../domain/booking";
import { AIRLINES } from "../domain/airlines";
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

// 0023. One stop as the editor holds it: five strings, all of them possibly
// blank, in the camelCase shape parseStopsInput reads. Blank rather than
// optional so every box is an ordinary uncontrolled-to-controlled input with a
// string value and never `undefined`.
type StopRow = {
  place: string;
  arrivesAt: string;
  departsAt: string;
  flight: string;
  airline: string;
};

const EMPTY_STOP: StopRow = {
  place: "",
  arrivesAt: "",
  departsAt: "",
  flight: "",
  airline: "",
};

// The route the editor should start from: what was just submitted and rejected
// if there is such a thing, otherwise the booking being edited, otherwise
// nothing.
//
// The echo comes back as the same JSON that was posted, so a rejected
// submission restores the route exactly — including a half-typed stop, which is
// usually the reason it was rejected.
function stopRowsFrom(echo: string | undefined, booking: Booking | undefined): StopRow[] {
  if (echo) {
    try {
      const raw: unknown = JSON.parse(echo);
      if (Array.isArray(raw)) {
        return raw.map((entry) => ({
          ...EMPTY_STOP,
          ...(entry as Partial<StopRow>),
        }));
      }
    } catch {
      // Not JSON at all. Falling through to the booking is better than an
      // empty editor: the user has a route on screen either way.
    }
  }

  return bookingStops(booking ?? { stops: null }).map((stop) => ({
    place: stop.place,
    arrivesAt: stop.arrives_at ? toDateTimeLocal(stop.arrives_at) : "",
    departsAt: stop.departs_at ? toDateTimeLocal(stop.departs_at) : "",
    flight: stop.flight ?? "",
    airline: stop.airline ?? "",
  }));
}

// 0026. The details the form should start from: a rejected submission's echo,
// else the booking being edited, else nothing.
function detailsFrom(
  echo: string | undefined,
  booking: Booking | undefined,
): BookingDetails {
  if (echo) {
    const parsed = parseDetailsInput(echo);
    if (parsed) return parsed;
  }
  return booking ? bookingDetails(booking) : {};
}

function DetailInput({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value: string | undefined;
  placeholder: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <Input
        name={name}
        maxLength={name === "detailBaggage" ? 20 : 12}
        dir="auto"
        placeholder={placeholder}
        defaultValue={value ?? ""}
      />
    </label>
  );
}

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
    airline: booking.airline ?? "",
    standby: booking.standby ? "on" : "off",
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
  // Same remount-and-echo dance as `booked` above, for the same reason: a
  // controlled checkbox loses to React's form reset, so the DOM owns it and the
  // echo is what survives a rejected submission.
  const [standby, setStandby] = useState(() =>
    state.values ? state.values.standby === "on" : (booking?.standby ?? false),
  );
  // 0023. The stops live in React state and reach the action as one hidden
  // JSON field. They cannot be uncontrolled inputs like the rest of this form:
  // rows are added and removed, and a `name="stopPlace"` repeated five times
  // comes back as five parallel arrays that have to be zipped by position — one
  // blank box and every later field lands on the wrong stop.
  const [stops, setStops] = useState<StopRow[]>(() =>
    stopRowsFrom(state.values?.stops, booking),
  );

  // 0024. Whether the folded block below starts open: only when there is
  // already something in it worth seeing, which on a new booking there never
  // is. `useState` with no setter rather than a plain const, so this is worked
  // out once on mount — a value that changed between renders would re-apply the
  // `open` attribute and undo a press on the summary.
  const [extrasOpen] = useState(
    () =>
      booking !== undefined &&
      (booking.booked === false ||
        booking.standby ||
        booking.book_by !== null ||
        booking.free_cancellation_until !== null),
  );

  // The same trick for the optional block. A new booking never has any of it;
  // an edit opens it when there is something in there to edit, because a field
  // you filled in last week must not vanish behind a chevron you did not press.
  const [optionalOpen] = useState(
    () =>
      booking !== undefined &&
      (Boolean(booking.city) ||
        Boolean(booking.confirmation) ||
        booking.cost_amount !== null ||
        Boolean(booking.note)),
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
    setStandby(state.values ? state.values.standby === "on" : false);
    // Same reason the two checkboxes above are re-seeded here: the form's DOM
    // is reset once the action finishes, and this state has to be reset with
    // it. On a rejected submission that restores what was typed; on a
    // successful add the action returns no values, so the route clears exactly
    // as every other field does.
    setStops(stopRowsFrom(state.values?.stops, booking));
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

  // 0026. The echo first, then the booking — the same order `was` resolves in.
  const details = detailsFrom(state.values?.details, booking);

  // The datalist needs an id, and two of these forms can be on one page — the
  // add form on the bookings screen and the edit dialog over it.
  const cityListId = useId();

  // 0024. Both ways in are a dialog now — adding through AddBookingButton
  // below, editing through the pencil on a card — so there is no surface to
  // supply. This used to be `isEdit ? Fragment : Card`, for an add form that
  // sat open on the page.
  return (
    <>
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
        {/* 0023. The whole route in one field. Rendered for lodging too, as an
            empty array, so switching a booking's kind to "hotel" clears the
            stops it had as a flight rather than leaving them behind in the
            column. */}
        <input
          type="hidden"
          name="stops"
          value={JSON.stringify(isTransport ? stops : [])}
        />

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
          {/* 0024. Only once there is a connection, because until then there is
              only one leg and saying "the first" about it is noise. */}
          {isTransport && stops.length > 0 && (
            <span className="text-caption text-muted">
              של הקטע הראשון. המספר של כל קטע נוסף נכנס בעצירה שהוא יוצא ממנה.
            </span>
          )}
        </label>

        {/* Flights only. A train has an operator too, but the list in
            domain/airlines.ts is airlines, and offering it on a train row would
            be a picker that cannot contain the right answer. */}
        {kind === "flight" && (
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:max-w-72">
            <span className="text-muted">חברת תעופה (לא חובה)</span>
            <Select
              name="airline"
              defaultValue={was("airline")}
              aria-invalid={Boolean(errorFor("airline"))}
              className={fieldClass("airline")}
            >
              {/* The blank stays first and stays selectable: the list is
                  curated and therefore incomplete, so "not one of these" has to
                  remain an answer rather than something you can only give by
                  never touching the field. */}
              <option value="">ללא</option>
              {AIRLINES.map((airline) => (
                <option key={airline.code} value={airline.code}>
                  {airline.name} · {airline.code}
                </option>
              ))}
            </Select>
            <FieldError message={errorFor("airline")} />
          </label>
        )}

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
              {/* 0024. The field that the connection makes ambiguous, said
                  plainly rather than left to be worked out. With a stop in the
                  middle "אל־" is still Tokyo, not Dubai — and reading it as
                  Dubai is the mistake that makes the whole route come out
                  wrong. */}
              {stops.length > 0 && (
                <span className="text-caption text-muted">
                  היעד הסופי, לא סוף הקטע הראשון.
                </span>
              )}
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

        {/* 0023. Transport only. The stops are what turn two bookings back
            into one ticket — see the migration for why they are a column on the
            booking rather than rows of their own. */}
        {isTransport && (
          <RouteEditor
            stops={stops}
            onChange={setStops}
            withAirline={kind === "flight"}
            error={errorFor("stops")}
          />
        )}

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
            <legend className="flex items-center gap-1 text-muted">
              משך הנסיעה (לא חובה)
              {/* Two lines of arithmetic explanation that were under this
                  field on every transport booking. It is a real answer to a
                  real question — "why doesn't it work this out itself" — and
                  it is asked once, not on every booking. */}
              <InfoTip label="למה המשך לא מחושב לבד">
                כמו שמופיע בכרטיס. לא מחושב משעות היציאה וההגעה, כי שתיהן
                נשמרות בשעון אחד ולכן ההפרש ביניהן אינו משך הטיסה.
              </InfoTip>
            </legend>
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
          </fieldset>
        )}

        {/* 0026. What the ticket prints beyond where and when — the fields the
            documents screen draws on its boarding pass and hotel card. Folded,
            like the block below: a booking is complete without any of it.
            Keyed on the kind so switching flight → hotel swaps the boxes rather
            than carrying a seat number into a hotel. */}
        <Disclosure
          key={`details-${kind}-${formGeneration}`}
          defaultOpen={Object.keys(details).length > 0}
          title={isTransport ? "מושב, שער וכבודה" : "כוכבים, ארוחת בוקר ותשלום"}
          detail="מופיע על הכרטיס במסך המסמכים"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isTransport && (
              <DetailInput name="detailSeat" label="מושב" value={details.seat} placeholder="14A" />
            )}
            {kind === "flight" && (
              <>
                <DetailInput name="detailGate" label="שער" value={details.gate} placeholder="B4" />
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="text-muted">עלייה למטוס</span>
                  <Input
                    type="time"
                    name="detailBoarding"
                    dir="ltr"
                    defaultValue={details.boarding ?? ""}
                  />
                </label>
                <DetailInput
                  name="detailBaggage"
                  label="מזוודה"
                  value={details.baggage}
                  placeholder="23 ק״ג"
                />
              </>
            )}
            {kind === "train" && (
              <DetailInput
                name="detailCarriage"
                label="קרון"
                value={details.carriage}
                placeholder="4"
              />
            )}
            {kind === "lodging" && (
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-muted">כוכבים</span>
                <Select name="detailStars" defaultValue={details.stars ? String(details.stars) : ""}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {"★".repeat(count)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {kind === "lodging" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="detailBreakfast"
                  defaultChecked={details.breakfast === true}
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                ארוחת בוקר כלולה
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="detailPaid"
                defaultChecked={details.paid === true}
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              שולם במלואו
            </label>
          </div>
          <FieldError message={errorFor("details")} />
        </Disclosure>

        {/* Everything from here to the notes is optional, and on the form it
            was five more controls between the times and the submit button. A
            flight you are copying off a boarding pass needs the number, the two
            ends and the two times; the city, the confirmation code, the price
            and a note are things you may or may not have, and asking for them
            in the open made the short case look like the long one.

            Same <details> contract as the block below it: closed still submits,
            because the inputs stay in the DOM. */}
        <Disclosure
          defaultOpen={optionalOpen}
          title="עיר, אישור, עלות והערות"
          detail="הכול לא חובה"
        >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="flex items-center gap-1 text-muted">
              עיר או אזור (לא חובה)
              <InfoTip label="מה קורה לעיר חדשה">
                עיר שעוד לא בטיול תתווסף אליו, ואפשר יהיה לפתוח לה מדריך.
              </InfoTip>
            </span>
            {/* An input with a datalist, not a select.

                It was a picker limited to the trip's existing cities, which made
                a booking unable to say anything the trip did not already know:
                you could book a hotel in Kyoto only if Kyoto was somehow already
                a destination. Reported as exactly that — adding a hotel or a
                flight should put its city on the trip.

                A datalist keeps the picker's whole benefit, which is that the
                existing cities are one tap away and spelled the way the rest of
                the trip spells them, and drops its only limitation. Typing a new
                one now creates it — see ensureCityCard. */}
            <Input
              name="city"
              list={cityListId}
              maxLength={120}
              autoComplete="off"
              placeholder="למשל קיוטו"
              defaultValue={was("city")}
            />
            <datalist id={cityListId}>
              {cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>

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
        </Disclosure>

        {/* ---- Deadlines and reminders (0011) --------------------------------
            Separated by a rule because everything above describes the booking
            itself, and everything below is about what you have to *do* before
            the trip. */}
        {/* 0024. Folded away, because none of it is asked on a typical
            booking: a ticket you already hold is `booked`, has no deadline to
            book by, usually has no free-cancellation date worth recording, and
            takes the default reminder. Five controls and three paragraphs of
            explanation, open on every booking, for the minority that needs
            them.

            A <details> and not a state toggle, deliberately: the controls stay
            in the DOM while it is closed, so they still submit. Unmounting them
            would send a form with no `booked` field at all — which the action
            reads as an unchecked box, quietly turning every booking into one
            that has not been made yet.

            Open from the start when the booking being edited has something in
            here to see. Computed once and never changed, so a press on the
            summary is not undone by the next render. */}
        <Disclosure
          defaultOpen={extrasOpen}
          title="סטטוס ההזמנה, ביטול ותזכורת"
          detail="נשאל רק אם צריך — ברוב ההזמנות אפשר לדלג"
        >
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

          {/* 0022. Beside "כבר הזמנתי" rather than anywhere else, because the
              two are the same kind of statement about the same booking — and
              deliberately not folded into it. A standby booking *is* reserved:
              it has a confirmation number and a cancellation deadline, and the
              reminders that watch that deadline are the ones that matter most
              on exactly these. Only what it counts towards changes. */}
          <label className="flex items-start gap-2 text-sm">
            <input
              key={formGeneration}
              type="checkbox"
              name="standby"
              defaultChecked={standby}
              onChange={(event) => setStandby(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              בסטנד-ביי — עוד לא סופי
              <span className="block text-xs text-muted">
                לכפילויות שאחת מהן תבוטל. לא ייספר בעלות הכוללת ולא יוסיף ימים
                לעיר. תגית ״לינה כפולה״ ותזכורות הביטול נשארות — כדי שלא תשכחו
                לבטל.
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
        </Disclosure>

        <div>
          <Button type="submit" loading={pending}>
            {isEdit ? "שמירה" : "הוספה"}
          </Button>
        </div>

        {state.error && <Banner tone="danger">{state.error}</Banner>}
      </form>
    </>
  );
}

// 0024. Adding a booking, behind a button.
//
// The form used to sit open at the bottom of the trip's details page, under the
// list of bookings it adds to — the same "unfinished interface" tell that
// CreateTripForm was moved out of, and worse here, because this form is long:
// a kind picker, ten fields, a route editor and a reminder block, permanently
// unfolded under a list you came to read.
//
// Editing has been a dialog for a while. This makes the two symmetrical, and
// the form no longer has to supply its own surface either way.
export function AddBookingButton({
  tripId,
  cities,
  pill = false,
}: {
  tripId: string;
  cities: string[];
  // The documents screen's header action, drawn as the Stitch export draws
  // "הוספת קובץ": a primary-fixed pill. The button adds a booking, which is
  // what that screen holds, so it says so.
  pill?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {pill ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary-tint px-4 py-2 text-xs leading-4 font-medium text-primary-deep shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          הוספת כרטיס
        </button>
      ) : (
        // `sm` and a short label, because this now lives in the section heading
        // rather than on a line of its own — see the trip page for why. The
        // long form is still the dialog's title, which is where a full
        // sentence has room.
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="self-start"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוספה
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="הוספת טיסה, רכבת או לינה"
      >
        <BookingForm
          tripId={tripId}
          cities={cities}
          onSuccess={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

// 0023. The middle of a ticket: "Tel Aviv → Dubai → Tokyo" entered as one
// flight with one stop, the way it is sold and the way it is printed.
//
// Collapsed to a single line until there is a stop, because the overwhelming
// majority of bookings are direct and a form that asks every traveller about
// connections is a form that got longer for nothing. Adding a stop is one
// press; a direct flight sees one sentence.
//
// Each stop asks for the flight *leaving* it rather than the one arriving,
// which is why the first leg has no row here at all — its number is the
// booking's own "flight number" field above. Nothing is typed twice.
function RouteEditor({
  stops,
  onChange,
  withAirline,
  error,
}: {
  stops: StopRow[];
  onChange: (stops: StopRow[]) => void;
  // Airlines only for flights, for the reason the field above gives: the list
  // in domain/airlines.ts cannot contain a train operator.
  withAirline: boolean;
  error?: string;
}) {
  const update = (index: number, patch: Partial<StopRow>) => {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0 text-sm">
      {/* 0024. The explanation is behind the button rather than printed under
          the legend. It was three lines of prose above one control, on every
          booking — and most bookings are direct, so most of the time it was
          furniture. Read once, ignored after that, and in the way for good. */}
      <legend className="flex items-center gap-1 text-muted">
        עצירות בדרך (קונקשן)
        <InfoTip label="איך בונים כרטיס עם קונקשן">
          <ConnectionHelp />
        </InfoTip>
      </legend>

      {/* 0024. The live "המסלול שנבנה" preview stood here and has been removed:
          the tooltip above answers the same question, and the two together were
          the form explaining itself twice. What it drew is still built by
          journeyLegs — on the saved card, where the route is read rather than
          entered. */}
      {stops.length === 0 && (
        <p className="text-caption text-muted">
          טיסה ישירה. יש קונקשן, או שני כרטיסים שמרכיבים את הנסיעה? הוסיפו
          עצירה.
        </p>
      )}

      {stops.map((stop, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-2 rounded-control border border-border bg-surface-sunken p-3"
        >
          <div className="flex items-center justify-between gap-2">
            {/* 0024. Named by what it *does* as well as what it is. "עצירה 1"
                alone left the boxes below it looking like they described the
                stop; they describe the flight out of it, which is the whole
                confusion this row was reported for. */}
            <span className="text-caption font-semibold text-muted">
              עצירה {index + 1} · כאן מתחיל קטע {index + 2}
            </span>
            {/* A plain button, not an IconButton: this sits inside a form and a
                button with no explicit type submits it — which would post the
                form on every attempt to drop a stop. */}
            <button
              type="button"
              onClick={() => onChange(stops.filter((_, i) => i !== index))}
              className="flex items-center gap-1 rounded-control px-2 py-1 text-caption text-danger-ink hover:bg-danger/10"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              הסרה
            </button>
          </div>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-caption text-muted">תחנה</span>
            <Input
              value={stop.place}
              onChange={(event) => update(index, { place: event.target.value })}
              maxLength={120}
              placeholder="דובאי"
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-caption text-muted">נחיתה (לא חובה)</span>
              <Input
                type="datetime-local"
                dir="ltr"
                value={stop.arrivesAt}
                onChange={(event) =>
                  update(index, { arrivesAt: event.target.value })
                }
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-caption text-muted">
                המשך הטיסה (לא חובה)
              </span>
              <Input
                type="datetime-local"
                dir="ltr"
                value={stop.departsAt}
                onChange={(event) =>
                  update(index, { departsAt: event.target.value })
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-caption text-muted">
                מספר הטיסה מכאן (לא חובה)
              </span>
              <Input
                value={stop.flight}
                onChange={(event) => update(index, { flight: event.target.value })}
                maxLength={120}
                placeholder="EK932"
              />
            </label>
            {withAirline && (
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-caption text-muted">
                  חברת תעופה (לא חובה)
                </span>
                <Select
                  value={stop.airline}
                  onChange={(event) =>
                    update(index, { airline: event.target.value })
                  }
                >
                  <option value="">ללא</option>
                  {AIRLINES.map((airline) => (
                    <option key={airline.code} value={airline.code}>
                      {airline.name} · {airline.code}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...stops, { ...EMPTY_STOP }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוספת עצירה
        </Button>
      </div>

      <FieldError message={error} />
    </fieldset>
  );
}

// 0024. What a connecting ticket actually is, in the order someone filling this
// form needs it: what the whole booking is first, then which box holds what.
//
// Written for the case it was reported for — two tickets bought separately —
// because that is the one the shape does not make obvious. A single ticket with
// a stop printed on it lands in exactly the same boxes, and someone holding one
// of those was not confused in the first place.
function ConnectionHelp() {
  return (
    <span className="flex flex-col gap-2">
      <span className="block font-semibold">
        כרטיס עם קונקשן הוא הזמנה אחת — גם אם קניתם את שתי הטיסות בנפרד.
      </span>
      <span className="block">
        לדוגמה, תל אביב ← דובאי ← טוקיו:
      </span>
      <span className="flex flex-col gap-1">
        <span className="block">
          <b>מ־ ואל־</b> הם הקצוות של כל הנסיעה — תל אביב וטוקיו. לא דובאי.
        </span>
        <span className="block">
          <b>מספר הטיסה</b> למעלה הוא של הטיסה הראשונה בלבד.
        </span>
        <span className="block">
          <b>עצירה</b> היא דובאי, והשדות שבתוכה הם של הטיסה שיוצאת ממנה —
          כלומר הכרטיס השני.
        </span>
      </span>
    </span>
  );
}
