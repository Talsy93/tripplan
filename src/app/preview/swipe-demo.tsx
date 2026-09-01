"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  IconButton,
  REVEALED_ACTION,
  SwipeAction,
} from "@/components/ui";

// SwipeAction on its own, with nothing behind it.
//
// A client file rather than a scene in the registry: scenes.tsx is a server
// module on purpose, and this is the one primitive whose whole subject is a
// handler. Keeping the state here lets the scene stay handler-free.
//
// What to check, in this order:
//   375   drag a row rightward — in RTL the inline start is to the right, and a
//         reveal wired for LTR moves the row the wrong way and shows nothing
//   375   drag a row leftward; nothing should move
//   375   hold a row still for half a second; it should remove without a drag
//   375   scroll the list vertically with a finger on a row — it must scroll
//   1280  nothing red is visible until a row is hovered
//   1280  hover a row; the button appears in place, and the row does not move —
//         a hover that slid the row would clip the checkbox off its start edge,
//         which is what the first version of this did
//   1280  tab through the list; each row's button appears when it is focused
const ROWS = [
  "מתאם שקע ליפן",
  "כרטיס JR Pass — להדפיס לפני הטיסה",
  "מטען נייד",
  "תרופות",
];

export function SwipeDemo() {
  const [rows, setRows] = useState(ROWS);
  const [removed, setRemoved] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={rows.length === 0 ? "neutral" : "success"}>
          {rows.length} שורות
        </Badge>
        {removed && <Badge tone="warning">הוסר: {removed}</Badge>}
        {rows.length < ROWS.length && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRows(ROWS);
              setRemoved(null);
            }}
          >
            החזרת הרשימה
          </Button>
        )}
      </div>

      {/* A dense row with a control at its start — the packing-list shape, and
          the one the reveal has to not break. */}
      <Card padding="none" className="max-w-md overflow-hidden">
        <div className="flex flex-col">
          {rows.map((row) => (
            <SwipeAction
              key={row}
              icon={<X className="h-4 w-4" aria-hidden="true" />}
              onAction={() => {
                setRemoved(row);
                setRows((current) => current.filter((r) => r !== row));
              }}
              className="rounded-none border-b border-border last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 text-sm wrap-anywhere">{row}</span>
                </label>
                <IconButton
                  label={`הסרת ${row}`}
                  variant="danger"
                  size="sm"
                  className={REVEALED_ACTION}
                  onClick={() => {
                    setRemoved(row);
                    setRows((current) => current.filter((r) => r !== row));
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </div>
            </SwipeAction>
          ))}
          {rows.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted">הרשימה רוקנה.</p>
          )}
        </div>
      </Card>

      {/* The same primitive around something the height of a card, which is the
          other place it is used: a booking. The panel is full height there, and
          the row's own button sits beside an edit button that must stay
          visible. */}
      <SwipeAction
        icon={<X className="h-4 w-4" aria-hidden="true" />}
        onAction={() => setRemoved("Hotel Gracery Shinjuku")}
        className="max-w-md"
      >
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">
                Hotel Gracery Shinjuku
              </span>
              <span className="block text-sm text-muted">
                3 לילות · 12.10–15.10 · טוקיו
              </span>
            </span>
            <IconButton
              label="הסרת הלינה"
              variant="danger"
              size="sm"
              className={REVEALED_ACTION}
              onClick={() => setRemoved("Hotel Gracery Shinjuku")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </Card>
      </SwipeAction>
    </div>
  );
}
