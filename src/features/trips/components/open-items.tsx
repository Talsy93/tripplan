import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui";
import type { OpenItem } from "../domain/open-items";

// "עדיין פתוח" — the list of things a trip is still missing.
//
// One card of rows rather than a card per item, and that is the mockup's own
// shape: a dot, a sentence, and a detail line. Three things left to do is a
// list; three cards is a screen that looks like it has a problem.
//
// Presentational. The domain works out what is open and in which order — see
// domain/open-items.ts, where the ordering is the argument.
export function OpenItems({
  tripId,
  items,
  enterDelayMs = 0,
}: {
  tripId: string;
  items: OpenItem[];
  // Where the rows' entrance starts, in ms. Default 0 — on the day screen
  // this card is near the top and rises on its own.
  //
  // The home screen passes a value because the card is itself one of several
  // blocks arriving in sequence, and a nested stagger restarts the count:
  // without it the rows appear before the card holding them. Same prop and
  // same reason as TripList's.
  enterDelayMs?: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading level="section">
        {items.length > 0 ? "עדיין פתוח" : "הכול מסודר"}
      </SectionHeading>

      {/* Nothing open is a state worth drawing, not a reason to render nothing.
          A trip that is fully prepared should say so — and on this screen the
          alternative is the empty column this component exists to fill. */}
      {items.length === 0 ? (
        <Card className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-tint text-success-ink"
            aria-hidden="true"
          >
            <Check className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">
              אין משימות פתוחות
            </span>
            <span className="block text-sm text-muted">
              תאריכים, יעדים, לו״ז, לינה והגעה — הכול במקום.
            </span>
          </span>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* One row at a time, fading up. These are the things there are
              left to do, and a list that assembles reads as a list being
              worked through rather than a wall of five identical rows. */}
          <ul
            className="stagger"
            style={
              enterDelayMs > 0
                ? ({ "--stagger-base": `${enterDelayMs}ms` } as React.CSSProperties)
                : undefined
            }
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="animate-rise border-b border-border last:border-b-0"
              >
                {/* The whole row is the link. Every item here is actionable and
                    each one is actionable somewhere else, so the row's job is
                    to get you there — a separate "fix" affordance per row would
                    be five identical links down the right edge. */}
                <Link
                  href={`/trips/${tripId}/${item.path}`}
                  className="group/row flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  {/* A dot, not an icon. Five line icons down a column read as
                      five categories; the only distinction these rows carry is
                      urgent or not, and a dot carries exactly that much. */}
                  <span
                    aria-hidden="true"
                    className={
                      item.urgency === "now"
                        ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning-ink"
                        : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        item.urgency === "now"
                          ? "block text-sm font-semibold text-warning-ink wrap-anywhere"
                          : "block text-sm font-semibold wrap-anywhere"
                      }
                    >
                      {item.text}
                    </span>
                    {item.detail && (
                      <span className="block max-w-measure text-caption text-muted wrap-anywhere">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  {/* RTL: forward points left, so hover nudges it that way. */}
                  <ChevronLeft
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted +NUDGE+"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
