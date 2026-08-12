"use client";

import { useActionState } from "react";
import { Button, Card, Input } from "@/components/ui";
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
    <Card className="p-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="tripId" value={tripId} />
        <h2 className="text-lg font-bold">תאריכי הטיול</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">תאריך יציאה</span>
            <Input
              type="date"
              name="start_date"
              defaultValue={startDate ?? ""}
              required
              dir="ltr"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">תאריך חזרה (לא חובה)</span>
            <Input
              type="date"
              name="end_date"
              defaultValue={endDate ?? ""}
              dir="ltr"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "שומר…" : "שמירת תאריכים"}
          </Button>
          {state?.ok && <span className="text-sm text-muted">נשמר ✓</span>}
        </div>

        {state?.error && <p className="text-sm text-danger-ink">{state.error}</p>}
      </form>
    </Card>
  );
}
