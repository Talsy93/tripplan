"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Banner, Button, Dialog, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { renameTrip } from "../application/actions";
import { setTripDates } from "../application/date-actions";

// The trip's name in the header, and the one place the trip itself is edited:
// pressing it opens "עריכת הטיול" with the name and the dates.
//
// There used to be a "פרטי הטיול" page for this, with the name and the dates
// as two rows behind two dialogs. Asked for as "that page is not needed — the
// edit option in the header is enough, add the dates there", so the page is
// gone and this dialog is the whole of it.
//
// Anything that wants the trip's dates changed — "עוד לא נקבעו תאריכים" on
// the open items, the hero of an undated trip — links to `?edit=trip` on any
// tab, and the header opens the dialog itself.
export function TripNameButton({
  tripId,
  name,
  startDate,
  endDate,
}: {
  tripId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(() => params.get("edit") === "trip");
  const [draft, setDraft] = useState(name);
  const [start, setStart] = useState(startDate ?? "");
  const [end, setEnd] = useState(endDate ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    setDraft(name);
    setStart(startDate ?? "");
    setEnd(endDate ?? "");
    setMessage(null);
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    // Drop the `?edit=trip` that may have opened it, so a reload does not
    // open it again.
    if (params.get("edit") === "trip") router.replace(window.location.pathname, { scroll: false });
  }

  const nameChanged = draft.trim() !== name;
  const datesChanged = start !== (startDate ?? "") || end !== (endDate ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      // Two actions, because they were always two: the name is a rename and
      // the dates go through their own validation (return after departure).
      // Only what changed is sent, so a failed date save cannot be blamed on
      // a name nobody touched.
      if (nameChanged) {
        const result = await renameTrip(tripId, draft);
        if (!result.ok) {
          setMessage(result.message ?? "שמירת השם נכשלה.");
          return;
        }
      }
      if (datesChanged) {
        const form = new FormData();
        form.set("tripId", tripId);
        form.set("start_date", start);
        form.set("end_date", end);
        const result = await setTripDates(undefined, form);
        if (!result?.ok) {
          setMessage(result?.error ?? "שמירת התאריכים נכשלה.");
          return;
        }
      }
      setOpen(false);
      if (params.get("edit") === "trip") router.replace(window.location.pathname, { scroll: false });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={begin}
        title="עריכת הטיול"
        className={cn(
          "group/name inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-control text-start",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="min-w-0 truncate">{name}</span>
        <Pencil
          className="h-3.5 w-3.5 shrink-0 text-border-strong transition-colors group-hover/name:text-muted"
          aria-hidden="true"
        />
        <span className="sr-only">עריכת הטיול</span>
      </button>

      <Dialog open={open} onClose={close} title="עריכת הטיול">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="שם הטיול">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              onFocus={(event) => event.target.select()}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="תאריך יציאה">
              <Input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
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
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                dir="ltr"
              />
            </Field>
          </div>
          {message && <Banner tone="danger">{message}</Banner>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={pending}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              loading={pending}
              disabled={
                draft.trim().length === 0 || (!nameChanged && !datesChanged)
              }
            >
              שמירה
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
