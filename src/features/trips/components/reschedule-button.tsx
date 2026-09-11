"use client";

import { useState } from "react";
import { MapPinCheck } from "lucide-react";
import { Button } from "@/components/ui";
import type { ItineraryDay } from "../domain/ai-suggestion";
import { RescheduleDialog } from "./reschedule-dialog";

// "We got here early" / "we are running late" — opens the re-timing dialog
// for the day being looked at. The GPS watcher opens the same dialog on its
// own when it notices an arrival; this is the hand-operated version.
export function RescheduleButton({
  tripId,
  day,
  nowIso,
}: {
  tripId: string;
  day: ItineraryDay;
  nowIso: string;
}) {
  const [open, setOpen] = useState(false);

  if (day.items.length === 0) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MapPinCheck className="h-4 w-4" aria-hidden="true" />
        הגענו / עדכון לו״ז
      </Button>
      {open && (
        <RescheduleDialog
          tripId={tripId}
          day={day}
          open={open}
          onClose={() => setOpen(false)}
          nowIso={nowIso}
        />
      )}
    </>
  );
}
