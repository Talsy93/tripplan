import Link from "next/link";
import {
  BedDouble,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ListChecks,
  MapPin,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { OpenItem } from "../domain/open-items";

// "עוד פתוח" — the list of things a trip is still missing.
//
// One white card of rows rather than a card per item (Pencil, v7): a coloured
// icon tile, a sentence, a detail line and a chevron. Three things left to do
// is a list; three cards is a screen that looks like it has a problem.
//
// Presentational. The domain works out what is open and in which order — see
// domain/open-items.ts, where the ordering is the argument.

// What each kind of open item looks like. The tint says which part of the
// plan it is about — the calendar, the route, the schedule, the bed, the
// journey — so a list of three reads as three different things at a glance.
// Keyed by the domain's item ids; anything new falls back to the schedule's.
const KINDS: Record<string, { Icon: LucideIcon; tone: string }> = {
  dates: { Icon: CalendarDays, tone: "bg-primary-tint text-primary" },
  cities: { Icon: MapPin, tone: "bg-cat-nature-tint text-cat-nature-ink" },
  itinerary: { Icon: ListChecks, tone: "bg-cat-hidden-tint text-cat-hidden-ink" },
  "short-itinerary": { Icon: ListChecks, tone: "bg-cat-hidden-tint text-cat-hidden-ink" },
  "empty-days": { Icon: ListChecks, tone: "bg-cat-hidden-tint text-cat-hidden-ink" },
  unscheduled: { Icon: Bookmark, tone: "bg-cat-shopping-tint text-cat-shopping-ink" },
  lodging: { Icon: BedDouble, tone: "bg-cat-mustsee-tint text-cat-mustsee-ink" },
  transport: { Icon: TrainFront, tone: "bg-cat-food-tint text-cat-food-ink" },
};
const FALLBACK = KINDS.itinerary;

export function OpenItems({
  tripId,
  items,
  title,
  enterDelayMs = 0,
}: {
  tripId: string;
  items: OpenItem[];
  // The heading, when the caller means something narrower than "what is still
  // open" — the day screen shows only the urgent rows, as "דורש תשומת לב".
  title?: string;
  // Where the rows' entrance starts, in ms. Default 0 — on the day screen
  // this card is near the top and rises on its own.
  //
  // A caller that is itself one of several blocks arriving in sequence passes
  // a value, because a nested stagger restarts the count: without it the rows
  // appear before the card holding them.
  enterDelayMs?: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base leading-6 font-bold text-foreground">
        {title ?? (items.length > 0 ? "עוד פתוח" : "הכול מסודר")}
      </h2>

      {/* Nothing open is a state worth drawing, not a reason to render nothing.
          A trip that is fully prepared should say so. */}
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-tint text-success-ink"
            aria-hidden="true"
          >
            <Check className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-foreground">
              אין משימות פתוחות
            </span>
            <span className="block text-sm text-muted">
              תאריכים, יעדים, לו״ז, לינה והגעה — הכול במקום.
            </span>
          </span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] bg-surface shadow-card">
          {/* One row at a time, fading up — a list being worked through rather
              than a wall of identical rows. */}
          <ul
            className="stagger px-4"
            style={
              enterDelayMs > 0
                ? ({ "--stagger-base": `${enterDelayMs}ms` } as React.CSSProperties)
                : undefined
            }
          >
            {items.map((item) => {
              // Urgent rows take the danger tint whatever they are about:
              // leaving them costs money or blocks the next step, and that
              // outranks which part of the plan they belong to.
              const kind = KINDS[item.id] ?? FALLBACK;
              const urgent = item.urgency === "now";
              return (
                <li
                  key={item.id}
                  className="animate-rise border-b border-border last:border-b-0"
                >
                  {/* The whole row is the link: every item is fixed somewhere
                      else, and the row's job is to get you there. */}
                  <Link
                    href={`/trips/${tripId}/${item.path}`}
                    className="group/row -mx-4 flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        urgent ? "bg-danger-tint text-danger-ink" : kind.tone,
                      )}
                    >
                      <kind.Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base leading-6 font-semibold text-foreground wrap-anywhere">
                        {item.text}
                      </span>
                      {item.detail && (
                        <span
                          className={cn(
                            "block max-w-measure text-xs wrap-anywhere",
                            urgent ? "text-danger-ink" : "text-muted",
                          )}
                        >
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {/* RTL: forward points left, so hover nudges it that way. */}
                    <ChevronLeft
                      className="h-5 w-5 shrink-0 text-outline transition-transform group-hover/row:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
