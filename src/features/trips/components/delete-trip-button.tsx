"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Banner, Button, Dialog } from "@/components/ui";
import { deleteTrip } from "../application/actions";

// Deleting a trip takes its destinations, itinerary, bookings, phrasebook and
// chat with it — the database cascades, see deleteTrip in trips-service.ts. So
// the dialog names what goes, rather than asking a bare "are you sure?".
//
// A separate client component instead of making the page interactive: the page
// around it stays a server component and only this button ships JS.
//
// It used to be an icon on every card in the trips list, which put an
// irreversible action one mis-tap from the thumb on the screen people scroll
// most. Now it lives at the bottom of the trip's own details page, which is
// where an action that destroys that trip belongs — and being there, it can
// afford to say what it is in words.
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-3 rounded-card border border-danger/25 bg-surface p-4 text-start shadow-soft transition-colors hover:border-danger/60 hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger-ink"
          aria-hidden="true"
        >
          <Trash2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-danger-ink">
            מחיקת הטיול
          </span>
          <span className="block text-sm text-muted">
            היעדים, לוח הזמנים, ההזמנות, השיחון והשיחה יימחקו איתו
          </span>
        </span>
      </button>

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
