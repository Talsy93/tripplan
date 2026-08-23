"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { resetLocations } from "../application/route-actions";

// The manual escape hatch for a pin the automatic country check could not fix.
//
// It exists because the automatic repair only fires when a city lands in a
// different *country* from the rest of the trip — a pin that is wrong by
// twenty kilometres, on the right side of the border, looks perfectly
// plausible to it. Clearing the cache re-resolves every city through the
// current geocoding path, which is the same remedy migration 0005 applied
// once, globally, for the same class of bug.
export function ResetLocationsButton({ tripId }: { tripId: string }) {
  const [resetting, setResetting] = useState(false);
  const { showToast } = useToast();

  async function reset() {
    setResetting(true);
    const ok = await resetLocations(tripId);
    showToast(
      ok ? "המיקומים חושבו מחדש" : "רענון המיקומים נכשל. נסו שוב.",
      ok ? "success" : "danger",
    );
    setResetting(false);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void reset()}
      loading={resetting}
      className="self-start"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      סיכה במקום הלא נכון? רענון המיקומים
    </Button>
  );
}
