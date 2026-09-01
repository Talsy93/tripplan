"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Banner, Button, Dialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { setTripArchived } from "../application/actions";

// "ארכוב הטיול" — the row the design has drawn at the bottom of the "עוד" menu
// since the redesign, with nothing behind it until now.
//
// It sits beside the delete row and is deliberately not dressed like it. The
// mockup draws both in red, and the note beside it asks for "the colour that
// says what they are" — so they get different colours, because they are
// different things. Archiving is reversible and takes nothing away; deleting
// cascades through the destinations, the itinerary, the bookings, the phrasebook
// and the chat. Two identical red rows would leave neither of them reading as
// the dangerous one.
//
// It still confirms. Not because it destroys anything, but because the trip
// disappears from the screen you were just on, and an action whose only visible
// effect is "something you were looking at is gone" should say so first.
export function ArchiveTripButton({
  tripId,
  tripName,
  archived,
  variant = "card",
}: {
  tripId: string;
  tripName: string;
  // Which direction the row goes. The same row, both ways — see setTripArchived.
  archived: boolean;
  variant?: "card" | "row";
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  // useTransition, not a loading flag: the action revalidates /profile as well,
  // and the pending state has to cover that refetch or the row settles back to
  // its old label for a frame.
  const [pending, startTransition] = useTransition();

  function confirm() {
    setFailed(false);
    startTransition(async () => {
      const { ok } = await setTripArchived(tripId, !archived);
      if (ok) {
        setOpen(false);
        return;
      }
      setFailed(true);
    });
  }

  const Icon = archived ? ArchiveRestore : Archive;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 text-start transition-colors",
          variant === "row"
            ? "px-4 py-3.5 hover:bg-warning-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            : "rounded-card border border-border bg-surface p-4 shadow-soft hover:bg-warning-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center bg-warning-tint text-warning-ink",
            variant === "row" ? "rounded-control" : "rounded-full",
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-warning-ink">
            {archived ? "שחזור מהארכיון" : "ארכוב הטיול"}
          </span>
          <span className="block text-sm text-muted">
            {archived
              ? "הטיול יחזור לרשימה ולמסך הבית"
              : "יורד מהרשימה וממסך הבית, ונשמר במלואו"}
          </span>
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={
          archived ? `לשחזר את ${tripName}?` : `לארכב את ${tripName}?`
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ביטול
            </Button>
            <Button variant="primary" onClick={confirm} loading={pending}>
              {archived ? "שחזור" : "ארכוב"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {archived
            ? "הטיול יופיע שוב ברשימת הטיולים, ואם הוא עוד לפני היציאה גם במסך הבית."
            : "שום דבר לא נמחק — היעדים, הלו״ז, ההזמנות והשיחה נשארים. הטיול פשוט יורד מרשימת הטיולים ומהמסך הראשי, ואפשר לשחזר אותו מ״בארכיון״ בכל רגע."}
        </p>

        {failed && <Banner tone="danger">הפעולה נכשלה. נסו שוב.</Banner>}
      </Dialog>
    </>
  );
}
