"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Banner, Button, Card, Field, Input } from "@/components/ui";
import { setTripDates } from "../application/date-actions";
import type { TripDatesFormState } from "../domain/trip";

export function TripDatesForm({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const [state, action, pending] = useActionState<TripDatesFormState, FormData>(
    setTripDates,
    undefined,
  );

  return (
    <Card>
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

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            שמירת תאריכים
          </Button>
          {state?.ok && (
            <span className="flex items-center gap-1 text-sm text-success-ink">
              <Check className="h-4 w-4" aria-hidden="true" />
              נשמר
            </span>
          )}
        </div>

        {state?.error && <Banner tone="danger">{state.error}</Banner>}
      </form>
    </Card>
  );
}
