"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Badge, Button, Card, SectionHeading } from "@/components/ui";

// Every named entrance in the app, on one screen, replayable.
//
// A client file rather than a scene in the registry for the reason swipe-demo.tsx
// is one: scenes.tsx is a server module, and an entrance can only be watched if
// something can re-mount it. The button bumps a key, which is the whole trick.
//
// It also exists because an entrance that runs once on mount finishes before a
// script that starts after hydration can sample it — the first attempt at
// measuring one read the same value fourteen times in a row and proved nothing.
// A replay button is what makes any of this checkable.
//
// What to check:
//   * the six tiles arrive in sequence, not together, and the last one is not
//     noticeably late
//   * the panel scales out of nothing; the check overshoots and settles
//   * the bar fills from its own inline start — in RTL that is the right edge,
//     which is the one thing scaleX cannot be told logically
//   * with prefers-reduced-motion on, all four are simply *there*: every one is
//     CSS, so the block at the bottom of globals.css covers them
const TILES = ["מסעדות", "בתי קפה", "מאפיות", "שופינג", "מקדשים", "אטרקציות"];

export function MotionDemo() {
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          החזרה
        </Button>
        <Badge tone="neutral">הרצה {run + 1}</Badge>
      </div>

      {/* key on each block, so one press replays all four together. */}
      <section key={run} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <SectionHeading level="sub" description="--animate-rise, בהשהיה מדורגת">
            כניסה מדורגת
          </SectionHeading>
          <div className="stagger grid grid-cols-3 gap-2.5">
            {TILES.map((tile) => (
              <div
                key={tile}
                className="animate-rise rounded-card border border-border bg-surface p-4 text-center text-sm font-bold shadow-soft"
              >
                {tile}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionHeading level="sub" description="--animate-pop, מתוך הכפתור">
            תפריט שנפתח
          </SectionHeading>
          <Card className="animate-pop max-w-sm origin-top">
            <p className="text-sm font-semibold">יפן בסתיו</p>
            <p className="text-caption text-muted">10.9–24.9</p>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <SectionHeading level="sub" description="--animate-stamp, עם חריגה קלה">
            סימון שנחתם
          </SectionHeading>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-tint text-success-ink">
            <Check className="h-5 w-5 animate-stamp" aria-hidden="true" />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <SectionHeading
            level="sub"
            description="--animate-fill, מקצה תחילת השורה"
          >
            פס התקדמות שמתמלא
          </SectionHeading>
          <div className="h-2 max-w-sm overflow-hidden rounded-full bg-surface-sunken">
            <span
              className="block h-full animate-fill rounded-full bg-primary"
              style={{ width: "62%" }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
