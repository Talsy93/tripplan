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

// The three settings the load stagger has had, side by side and replayable.
//
// This exists because the numbers cannot be judged as numbers. The step and the
// duration were reasoned about twice and set wrong twice — once so slow it read
// as a page failing to load, then twice so fast that the answer both times was
// "I don't see any particular change". Reading a delay off a spec sheet does not
// tell you which of those you have built; watching two of them one under the
// other does, immediately.
//
// Kept after the decision rather than deleted with it: the next person to move
// these numbers needs the same comparison, and rebuilding it is the expensive
// part. It costs nothing in production — /preview does not exist there.
const RISE_SETTINGS = [
  { key: "old", title: "הישן", px: 6, ms: 170, step: 28 },
  { key: "prod", title: "בפרודקשן היום", px: 12, ms: 260, step: 45 },
  { key: "next", title: "ההצעה", px: 20, ms: 400, step: 110 },
] as const;

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

      {/* One keyframe for all three rows, with the distance read from a custom
          property the row sets. A keyframe may hold a var(), it resolves per
          element, and that is what keeps this to three inline numbers per row
          rather than three near-identical @keyframes blocks.

          The per-tile delay is inline here, which globals.css warns against for
          `.stagger` — but the warning is about giving every child the *same*
          inline delay and flattening the sequence. Each tile gets its own value,
          which is the case that rule cannot express. */}
      <style>{`
        @keyframes cmp-rise {
          from { opacity: 0.35; transform: translate3d(0, var(--cmp-distance, 12px), 0); }
          to { opacity: 1; transform: none; }
        }
        .cmp-tile {
          animation-name: cmp-rise;
          animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
          animation-fill-mode: both;
        }
      `}</style>

      <section key={`cmp-${run}`} className="flex flex-col gap-5">
        <SectionHeading
          level="sub"
          description="אותן שש אריחים בשלושת התזמונים. ההבדל הוא היחס בין הצעד למשך — לא כל מספר בנפרד."
        >
          השוואת תזמונים
        </SectionHeading>

        {RISE_SETTINGS.map((setting) => (
          <div key={setting.key} className="flex flex-col gap-2">
            {/* One LTR island per run of digits, never one around the whole
                line. A dir="ltr" span with Hebrew inside it reorders that
                Hebrew — "צעד 28ms" came out backwards on the first try. */}
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption text-muted">
              <span className="font-bold text-foreground">{setting.title}</span>
              <span dir="ltr" className="tabular-nums">
                {setting.px}px · {setting.ms}ms
              </span>
              <span>
                צעד{" "}
                <span dir="ltr" className="tabular-nums">
                  {setting.step}ms
                </span>
              </span>
              <span className="tabular-nums">
                יחס {(setting.step / setting.ms).toFixed(2)}
              </span>
            </p>
            <div
              className="grid grid-cols-3 gap-2.5"
              style={
                { "--cmp-distance": `${setting.px}px` } as React.CSSProperties
              }
            >
              {TILES.map((tile, index) => (
                <div
                  key={tile}
                  className="cmp-tile rounded-card border border-border bg-surface p-4 text-center text-sm font-bold shadow-soft"
                  style={{
                    animationDuration: `${setting.ms}ms`,
                    animationDelay: `${index * setting.step}ms`,
                  }}
                >
                  {tile}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

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
