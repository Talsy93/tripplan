"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Banner, Button, Dialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { parseTimeLabel } from "../domain/timeline";
import type { ItineraryDay } from "../domain/ai-suggestion";
import { setItineraryAnchors } from "../application/itinerary-actions";

// Anchoring, for a whole day at once.
//
// The edit dialog can anchor one entry; a day with three booked tables and a
// timed museum slot wants them all locked in one pass. Every timed entry of
// the day is a row with a lock: tap to lock or release, save when done. An
// anchored entry never moves when the day is re-timed (domain/reflow.ts).
export function AnchorsButton({
  tripId,
  day,
  size = "sm",
}: {
  tripId: string;
  day: ItineraryDay;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const timed = day.items.filter(
    (entry) => parseTimeLabel(entry.startLabel) !== null,
  );
  if (timed.length === 0) return null;

  const anchored = timed.filter((entry) => entry.fixed).length;

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <Lock className="h-4 w-4" aria-hidden="true" />
        עיגון
        {anchored > 0 && (
          <span className="rounded-full bg-primary-tint px-1.5 text-caption font-bold tabular-nums text-primary-ink">
            {anchored}
          </span>
        )}
      </Button>
      {open && (
        <AnchorsDialog
          tripId={tripId}
          day={day}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AnchorsDialog({
  tripId,
  day,
  open,
  onClose,
}: {
  tripId: string;
  day: ItineraryDay;
  open: boolean;
  onClose: () => void;
}) {
  const timed = day.items
    .map((entry) => ({ entry, start: parseTimeLabel(entry.startLabel) }))
    .filter((item): item is typeof item & { start: number } => item.start !== null)
    .sort((a, b) => a.start - b.start)
    .map((item) => item.entry);

  const initial = new Set(timed.filter((entry) => entry.fixed).map((entry) => entry.id));
  const [fixedIds, setFixedIds] = useState<Set<string>>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const changes = timed
    .filter((entry) => fixedIds.has(entry.id) !== Boolean(entry.fixed))
    .map((entry) => ({ id: entry.id, fixed: fixedIds.has(entry.id) }));

  function toggle(id: string) {
    setFixedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (changes.length === 0) {
      onClose();
      return;
    }
    startTransition(async () => {
      const result = await setItineraryAnchors(tripId, changes);
      if (result.ok) {
        showToast(
          fixedIds.size === 0
            ? "אין פריטים מעוגנים ביום הזה"
            : fixedIds.size === 1
              ? "פריט אחד מעוגן"
              : `${fixedIds.size} פריטים מעוגנים`,
        );
        onClose();
        return;
      }
      setMessage(result.message ?? "השמירה נכשלה.");
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={`עיגון · יום ${day.day}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          פריט מעוגן — שולחן שהוזמן, כרטיס לשעה — נשאר בשעה שלו כשמעדכנים את
          הלו״ז לפי איפה שאתם. לחצו על המנעול כדי לעגן או לשחרר כמה שתרצו.
        </p>

        <ul className="flex flex-col gap-1.5">
          {timed.map((entry) => {
            const locked = fixedIds.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  aria-pressed={locked}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-control border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    locked
                      ? "border-foreground bg-surface-2"
                      : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="w-11 shrink-0 text-caption font-bold tabular-nums text-muted">
                    {entry.startLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {entry.title}
                  </span>
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      locked ? "bg-foreground text-surface" : "bg-surface-2 text-muted",
                    )}
                    aria-hidden="true"
                  >
                    {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                  </span>
                  <span className="sr-only">{locked ? "מעוגן" : "לא מעוגן"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {message && <Banner tone="danger">{message}</Banner>}

        <div className="flex items-center justify-between gap-2">
          <span className="text-caption tabular-nums text-muted">
            {fixedIds.size === 0
              ? "אין פריטים מעוגנים"
              : `${fixedIds.size} מתוך ${timed.length} מעוגנים`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ביטול
            </Button>
            <Button type="button" onClick={save} loading={pending} disabled={changes.length === 0}>
              שמירה
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
