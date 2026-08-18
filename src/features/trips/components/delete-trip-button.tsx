"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Banner, Button, Dialog, IconButton } from "@/components/ui";
import { deleteTrip } from "../application/actions";

// Deleting a trip takes its destinations, itinerary, bookings, phrasebook and
// chat with it — the database cascades, see deleteTrip in trips-service.ts. So
// the dialog names what goes, rather than asking a bare "are you sure?".
//
// A separate client component instead of making the whole list interactive: the
// trips list stays a server component and only this button ships JS.
export function DeleteTripButton({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  // useTransition, not a loading flag: the action revalidates /profile, and the
  // pending state has to cover the refetch as well or the row briefly reappears
  // as clickable after the delete has already gone through.
  const [pending, startTransition] = useTransition();

  function confirm() {
    setFailed(false);
    startTransition(async () => {
      const { ok } = await deleteTrip(tripId);
      if (ok) {
        setOpen(false);
        return;
      }
      setFailed(true);
    });
  }

  return (
    <>
      <IconButton
        label={`מחיקת הטיול ${tripName}`}
        variant="danger"
        size="sm"
        // Above the stretched link that makes the whole card clickable.
        className="relative z-10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={`למחוק את ${tripName}?`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ביטול
            </Button>
            <Button variant="danger" onClick={confirm} loading={pending}>
              מחיקה
            </Button>
          </>
        }
      >
        <p className="text-sm">
          יימחקו גם היעדים שבחרתם, לוח הזמנים, ההזמנות, השיחון והשיחה של הטיול
          הזה. אין דרך לשחזר.
        </p>

        {failed && (
          <Banner tone="danger">המחיקה נכשלה. נסו שוב.</Banner>
        )}
      </Dialog>
    </>
  );
}
