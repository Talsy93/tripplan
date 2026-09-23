"use client";

import { useState } from "react";
import { Bed, Bell, Map as MapIcon } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsSearchUrl } from "@/lib/maps";
import { isOverdue, reminderProgress } from "../domain/day-reminders";
import { nightStayLabel } from "../domain/trip-days";
import type { DayReminder } from "../domain/day-reminders";
import type { NightLodging } from "../domain/trip-days";
import { AddReminderButton, ReminderRow } from "./reminder-dialog";

// Where you sleep and what you have to do, as two tiles side by side.
//
// Asked for as: "for the hotel you sleep in and the reminders, let's save space
// and show them next to each other as a square like this, with an animation
// that characterises the tag, and if you want more details you press and get
// them."
//
// They were two full-width blocks stacked — a row carrying the hotel's name and
// address, and a card listing every reminder — above a schedule that is the
// actual subject of the screen. Both answer a question that is one number wide:
// *is there a bed tonight*, and *how much is left to do*. A tile answers that,
// and the detail waits for a press.
//
// **The panel opens below the pair, not inside a tile.** A reminder row has a
// checkbox, a time and a menu; at half the column width it wraps into an
// unreadable stack. So the tiles are the control and the panel is full width —
// which also means only one can be open, which is right: these are two
// different questions and reading both at once is the state the tiles replaced.
//
// The animation is the tile's own and says something. The bell swings when a
// reminder's hour has gone by, and only then — an idle animation on a tile with
// nothing wrong with it is decoration, and this app's amber already means "now".
// Both are inert under prefers-reduced-motion, via the global rule in
// globals.css.
export function DayTiles({
  tripId,
  stay,
  reminders,
  dayNumber,
  dayCount,
  // Minutes since midnight in the trip's zone, or null when the day on screen
  // is not the day being lived. Only used to mark a reminder late.
  nowMinutes = null,
}: {
  tripId: string;
  stay: NightLodging | null;
  reminders: DayReminder[];
  dayNumber: number;
  dayCount: number;
  nowMinutes?: number | null;
}) {
  const [open, setOpen] = useState<"stay" | "reminders" | null>(null);

  const progress = reminderProgress(reminders);
  const late = reminders.filter((reminder) =>
    isOverdue(reminder, nowMinutes),
  ).length;

  // Neither tile invents itself. A day with no lodging and no reminders gets
  // nothing at all rather than two empty squares explaining their own absence —
  // the buttons that create both are in the day's action row above.
  if (!stay && progress.total === 0) return null;

  const where = stay ? (stay.booking.address ?? stay.booking.city) : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {stay && (
          <Tile
            active={open === "stay"}
            onClick={() => setOpen(open === "stay" ? null : "stay")}
            icon={<Bed className="h-5 w-5" aria-hidden="true" />}
            tone="action"
            label={nightStayLabel(stay)}
            value={stay.booking.title}
          />
        )}

        {progress.total > 0 && (
          <Tile
            active={open === "reminders"}
            onClick={() =>
              setOpen(open === "reminders" ? null : "reminders")
            }
            icon={<Bell className="h-5 w-5" aria-hidden="true" />}
            tone={late > 0 ? "callout" : "neutral"}
            // The swing, and only when something is actually late.
            swing={late > 0}
            label="לעשות היום"
            value={`${progress.done}/${progress.total}`}
            badge={
              late > 0 ? (
                <Badge tone="callout">
                  {late === 1 ? "אחת עבר הזמן" : `${late} עבר הזמן`}
                </Badge>
              ) : undefined
            }
          />
        )}
      </div>

      {open === "stay" && stay && (
        <Card className="animate-rise flex min-w-0 items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="min-w-0 text-sm font-bold wrap-anywhere">
              {stay.booking.title}
            </span>
            {where && (
              <span className="min-w-0 text-caption text-muted wrap-anywhere">
                {where}
              </span>
            )}
          </span>
          <a
            href={googleMapsSearchUrl(
              [stay.booking.title, stay.booking.address, stay.booking.city]
                .filter(Boolean)
                .join(" "),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 rounded-control text-caption font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
            במפה
          </a>
        </Card>
      )}

      {open === "reminders" && progress.total > 0 && (
        <Card padding="none" className="animate-rise flex min-w-0 flex-col">
          <div className="flex flex-col divide-y divide-border">
            {reminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                tripId={tripId}
                reminder={reminder}
                dayCount={dayCount}
                compact
                overdue={isOverdue(reminder, nowMinutes)}
              />
            ))}
          </div>
          {/* A checklist you are working through is exactly when the next thing
              to remember occurs to you. */}
          <div className="border-t border-border px-3 py-2">
            <AddReminderButton
              tripId={tripId}
              dayNumber={dayNumber}
              dayCount={dayCount}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

const TONES = {
  action: "bg-action-tint text-action-ink",
  callout: "bg-callout-tint text-callout-ink",
  neutral: "bg-surface-2 text-muted",
} as const;

function Tile({
  icon,
  tone,
  label,
  value,
  badge,
  active,
  swing = false,
  onClick,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  badge?: React.ReactNode;
  active: boolean;
  swing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "flex min-w-0 flex-col items-start gap-1.5 rounded-card bg-surface p-3 text-start",
        "transition-[box-shadow,transform] duration-press ease-snap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "shadow-lift"
          : "shadow-card hover:shadow-lift",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
          TONES[tone],
          swing && "animate-swing",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 text-caption font-semibold text-muted">
        {label}
      </span>
      <span className="min-w-0 w-full truncate text-sm font-bold">{value}</span>
      {badge}
    </button>
  );
}
