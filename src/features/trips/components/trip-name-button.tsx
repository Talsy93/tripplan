"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Banner, Button, Dialog, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { renameTrip } from "../application/actions";

// The trip's name, editable where it is read: the header names the trip, and
// tapping the name opens a small dialog to change it. The same control sits in
// פרטי הטיול as a row, for people who look for settings in settings.
export function TripNameButton({
  tripId,
  name,
  variant = "title",
}: {
  tripId: string;
  name: string;
  variant?: "title" | "row";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setDraft(name);
    setMessage(null);
    setOpen(true);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameTrip(tripId, draft);
      if (result.ok) {
        setOpen(false);
        return;
      }
      setMessage(result.message ?? "השמירה נכשלה.");
    });
  }

  return (
    <>
      {variant === "title" ? (
        <button
          type="button"
          onClick={start}
          title="שינוי שם הטיול"
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
          <span className="sr-only">שינוי שם הטיול</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="flex w-full items-center gap-3 rounded-card bg-surface shadow-card px-4 py-3 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1 truncate text-base font-semibold">
            {name}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-ink">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            שינוי
          </span>
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="שם הטיול"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="איך קוראים לטיול?">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              onFocus={(event) => event.target.select()}
            />
          </Field>
          {message && <Banner tone="danger">{message}</Banner>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              loading={pending}
              disabled={draft.trim().length === 0 || draft.trim() === name}
            >
              שמירה
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
