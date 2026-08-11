"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addBooking } from "../application/booking-actions";
import { BOOKING_KINDS } from "../domain/booking";
import type { BookingFormState, BookingKind } from "../domain/booking";

const KINDS = Object.keys(BOOKING_KINDS) as BookingKind[];

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
          <Input name="title" required maxLength={120} />
        </label>

        {isTransport ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">מ־</span>
              <Input name="origin" maxLength={120} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">אל־</span>
              <Input name="destination" maxLength={120} />
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">כתובת</span>
            <Input name="address" maxLength={300} />
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              {isTransport ? "יציאה" : "צ׳ק-אין"}
            </span>
            <Input type="datetime-local" name="startsAt" required dir="ltr" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">
              {isTransport ? "הגעה (לא חובה)" : "צ׳ק-אאוט"}
            </span>
            <Input type="datetime-local" name="endsAt" dir="ltr" />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">יעד בטיול (לא חובה)</span>
            <select
              name="city"
              defaultValue=""
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
            <Input name="confirmation" maxLength={120} dir="ltr" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">הערות (לא חובה)</span>
          <Textarea name="note" rows={2} maxLength={1000} />
        </label>

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "שומר…" : "הוסף"}
          </Button>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </Card>
  );
}
