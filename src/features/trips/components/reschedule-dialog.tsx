"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Clock, Lock, MapPinCheck } from "lucide-react";
import { Banner, Button, Dialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { instantToWallClock } from "@/lib/datetime";
import { APP_TIME_ZONE } from "../domain/weather";
import { formatMinutes, parseTimeLabel } from "../domain/timeline";
import { reflowFromArrival, REFLOW_THRESHOLD_MINUTES } from "../domain/reflow";
import type { ItineraryDay, ItineraryEntry } from "../domain/ai-suggestion";
import { applyDayReflow } from "../application/itinerary-actions";

// "We are here now — move the day." Pick the place you are at (or arrive at
// it, and the GPS watcher picks it for you), see what would move and what stays
// anchored, confirm. domain/reflow.ts does the arithmetic; this shows it.
export function RescheduleDialog({
  tripId,
  day,
  open,
  onClose,
  initialEntryId = null,
  nowIso,
}: {
  tripId: string;
  day: ItineraryDay;
  open: boolean;
  onClose: () => void;
  // Preselected by the arrival watcher; null lets the user choose.
  initialEntryId?: string | null;
  // The moment "now" is measured at (ISO). Passed in, so the server and the
  // client agree on what time it is.
  nowIso: string;
}) {
  const [entryId, setEntryId] = useState<string | null>(initialEntryId);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const nowMinutes = useMemo(() => {
    const wall = instantToWallClock(nowIso, APP_TIME_ZONE);
    const [h, m] = wall.slice(11).split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }, [nowIso]);

  const timed = day.items.filter(
    (entry) => parseTimeLabel(entry.startLabel) !== null,
  );
  const selected = entryId ?? initialEntryId;
  const changes = selected ? reflowFromArrival(day, selected, nowMinutes) : [];
  const chosen = timed.find((entry) => entry.id === selected) ?? null;
  const delta =
    chosen === null
      ? 0
      : nowMinutes - (parseTimeLabel(chosen.startLabel) ?? nowMinutes);

  function apply() {
    if (changes.length === 0) return;
    startTransition(async () => {
      const result = await applyDayReflow(
        tripId,
        changes.map((change) => ({
          id: change.id,
          startLabel: change.to.startLabel,
          endLabel: change.to.endLabel,
        })),
      );
      if (result.ok) {
        showToast(
          changes.length === 1
            ? "השעה עודכנה"
            : `${changes.length} פריטים עודכנו לפי השעה הנוכחית`,
        );
        onClose();
        return;
      }
      setMessage(result.message ?? "העדכון נכשל.");
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="עדכון הלו״ז לפי איפה שאתם"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          עכשיו {formatMinutes(nowMinutes)}. בחרו את המקום שהגעתם אליו — הוא יתחיל
          עכשיו, ומה שאחריו יזוז באותו פער. הזמנות קבועות נשארות בשעה שלהן.
        </p>

        <ul className="flex flex-col gap-1.5">
          {timed.map((entry) => (
            <EntryOption
              key={entry.id}
              entry={entry}
              selected={entry.id === selected}
              onSelect={() => {
                setEntryId(entry.id);
                setMessage(null);
              }}
            />
          ))}
        </ul>

        {chosen && Math.abs(delta) < REFLOW_THRESHOLD_MINUTES && (
          <Banner tone="info">
            הלו״ז כבר מתאים לשעה — {chosen.title} מתוכנן ל-{chosen.startLabel}.
          </Banner>
        )}

        {changes.length > 0 && (
          <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-3">
            <p className="text-caption font-bold text-muted">
              {delta < 0
                ? `הקדמתם ב-${Math.abs(delta)} דק׳`
                : `איחור של ${delta} דק׳`}{" "}
              · {changes.length === 1 ? "פריט אחד יזוז" : `${changes.length} פריטים יזוזו`}
            </p>
            <ul className="flex flex-col gap-1">
              {changes.map((change) => (
                <li
                  key={change.id}
                  className="flex min-w-0 items-center gap-2 text-sm tabular-nums"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {change.title}
                  </span>
                  <span className="text-muted">{change.from.startLabel}</span>
                  <ArrowLeft className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  <span className="font-bold text-primary-ink">
                    {change.to.startLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && <Banner tone="danger">{message}</Banner>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            לא עכשיו
          </Button>
          <Button
            type="button"
            onClick={apply}
            loading={pending}
            disabled={changes.length === 0}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            עדכנו את הלו״ז
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EntryOption({
  entry,
  selected,
  onSelect,
}: {
  entry: ItineraryEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-control border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-primary bg-primary-tint"
            : "border-border bg-surface hover:bg-surface-2",
        )}
      >
        <span className="w-11 shrink-0 text-caption font-bold tabular-nums text-muted">
          {entry.startLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {entry.title}
        </span>
        {entry.fixed ? (
          <Lock className="h-4 w-4 shrink-0 text-muted" aria-label="הזמנה קבועה" />
        ) : selected ? (
          <MapPinCheck className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
        ) : null}
      </button>
    </li>
  );
}
