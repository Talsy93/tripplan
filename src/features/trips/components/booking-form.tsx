"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addBooking } from "../application/booking-actions";
import { BOOKING_KINDS } from "../domain/booking";
import type {
  BookingFormState,
  BookingKind,
  CreateBookingInput,
} from "../domain/booking";

const KINDS = Object.keys(BOOKING_KINDS) as BookingKind[];

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
