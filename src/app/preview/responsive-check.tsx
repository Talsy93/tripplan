"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Banner, Button, Card } from "@/components/ui";

// Runs every scene at a phone width and reports what escapes the viewport.
//
// A button rather than a Node script, because the check needs a real browser to
// lay anything out, and adding Playwright to a project that has no test runner
// would be a dependency bigger than the thing it verifies. An iframe at a fixed
// width gives the same measurement.
//
// Two properties are checked per scene:
//
//   * nothing escapes the viewport — the "card stretches the page" failure;
//   * no form control is under 16px — iOS Safari zooms the whole page when it
//     focuses one, and never zooms back out.

const WIDTHS = [320, 375, 414];

type Finding = {
  slug: string;
  width: number;
  escapes: number;
  worst: string | null;
  scrollWidth: number;
  minFont: number | null;
};

// An element clipped by an ancestor still reports its full layout box, because
// clipping is paint and not layout. Without this, Leaflet's tiles and every
// `truncate` child are reported as overflowing when none of them is visible
// outside its box.
//
// The walk stops at the scene root. An earlier version walked to <html>, which
// carries the global `overflow-x: clip` backstop — so every element counted as
// clipped, and the check silently passed everything. An element clipped only by
// that backstop IS a real overflow: it is escaping the viewport, and the safety
// net is the only thing hiding it.
function isClipped(el: Element, win: Window, root: Element | null) {
  for (
    let p = el.parentElement;
    p && p !== root && p.tagName !== "BODY";
    p = p.parentElement
  ) {
    const overflow = win.getComputedStyle(p).overflowX;
    if (
      overflow === "hidden" ||
      overflow === "clip" ||
      overflow === "auto" ||
      overflow === "scroll"
    ) {
      return true;
    }
  }
  return false;
}

function measure(doc: Document, win: Window) {
  const scene = doc.querySelector("[data-scene]");
  if (!scene) return null;

  const viewport = win.innerWidth;
  let escapes = 0;
  let worst: { px: number; label: string } | null = null;

  scene.querySelectorAll("*").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || isClipped(el, win, scene.parentElement)) return;
    const over = Math.max(rect.right - viewport, -rect.left);
    if (over > 1) {
      escapes += 1;
      const label = `${el.tagName.toLowerCase()} .${(el.className || "")
        .toString()
        .slice(0, 40)}`;
      if (!worst || over > worst.px) worst = { px: Math.round(over), label };
    }
  });

  let minFont = Infinity;
  doc
    .querySelectorAll(
      "input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea",
    )
    .forEach((el) => {
      minFont = Math.min(minFont, parseFloat(win.getComputedStyle(el).fontSize));
    });

  return {
    escapes,
    worst: worst as { px: number; label: string } | null,
    scrollWidth: doc.documentElement.scrollWidth,
    minFont: Number.isFinite(minFont) ? minFont : null,
  };
}

export function ResponsiveCheck({ slugs }: { slugs: string[] }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [detectorWorks, setDetectorWorks] = useState<boolean | null>(null);

  async function run() {
    setRunning(true);
    setFindings(null);
    setDetectorWorks(null);

    const frame = document.createElement("iframe");
    frame.style.cssText =
      "position:fixed;left:-99999px;top:0;height:900px;border:0";
    document.body.appendChild(frame);

    const found: Finding[] = [];
    let canaryFired = false;

    for (const width of WIDTHS) {
      frame.style.width = `${width}px`;
      for (const slug of slugs) {
        setProgress(`${width}px · ${slug}`);
        await new Promise<void>((resolve) => {
          frame.onload = () => setTimeout(resolve, 200);
          frame.src = `/preview/${slug}`;
        });

        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        if (!doc || !win) continue;

        const result = measure(doc, win);
        if (!result) continue;

        if (
          result.escapes > 0 ||
          result.scrollWidth > width + 1 ||
          (result.minFont !== null && result.minFont < 16)
        ) {
          found.push({
            slug,
            width,
            escapes: result.escapes,
            worst: result.worst
              ? `${result.worst.px}px · ${result.worst.label}`
              : null,
            scrollWidth: result.scrollWidth,
            minFont: result.minFont,
          });
        }

        // The control, run once: plant an over-wide element and confirm the
        // measurement notices. A clean result means nothing without it — this
        // check has silently disabled itself before.
        if (!canaryFired) {
          const host = doc.querySelector("[data-scene]");
          if (host) {
            const canary = doc.createElement("div");
            canary.style.cssText = "width:2000px;height:4px";
            host.appendChild(canary);
            const withCanary = measure(doc, win);
            canary.remove();
            const without = measure(doc, win);
            canaryFired =
              (withCanary?.escapes ?? 0) > (without?.escapes ?? 0);
          }
        }
      }
    }

    frame.remove();
    setDetectorWorks(canaryFired);
    setFindings(found);
    setProgress("");
    setRunning(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          בדיקת רספונסיביות · {slugs.length} סצנות × {WIDTHS.join("/")}px
        </span>
        <Button size="sm" loading={running} onClick={() => void run()}>
          <Play className="h-4 w-4" aria-hidden="true" />
          הרצה
        </Button>
      </div>

      {running && progress && (
        <p className="text-caption text-muted" dir="ltr">
          {progress}
        </p>
      )}

      {detectorWorks === false && (
        <Banner tone="danger">
          הגלאי לא הצליח לזהות אלמנט חורג שנשתל בכוונה. התוצאה למטה חסרת ערך —
          הבדיקה עצמה שבורה.
        </Banner>
      )}

      {findings !== null && detectorWorks && findings.length === 0 && (
        <Banner tone="success">
          אין חריגות. כל הסצנות נכנסות ב-{WIDTHS.join(", ")}px, ואין שדה מתחת
          ל-16px.
        </Banner>
      )}

      {findings !== null && findings.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {findings.map((finding) => (
            <li
              key={`${finding.slug}-${finding.width}`}
              className="min-w-0 rounded-control bg-danger-tint px-3 py-2 text-caption text-danger-ink"
            >
              <span className="font-semibold">
                {finding.slug} @ {finding.width}px
              </span>
              {" — "}
              {finding.escapes > 0 && (
                <span dir="ltr" className="wrap-anywhere">
                  {finding.escapes} חורגים, הגרוע: {finding.worst}
                </span>
              )}
              {finding.minFont !== null && finding.minFont < 16 && (
                <span> · שדה ב-{finding.minFont}px (iOS יזום)</span>
              )}
              {finding.scrollWidth > finding.width + 1 && (
                <span> · scrollWidth {finding.scrollWidth}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
