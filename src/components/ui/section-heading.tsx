import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Level = "page" | "section" | "sub";

// Three levels, and that is the whole vocabulary.
//
// Before phase D, headings at the same level of the same page were written four
// different ways — `font-display text-xl` in five files, `font-display text-lg`
// in eleven, bare `font-bold` in three, bare `font-semibold` in two — and
// explore/page.tsx used text-xl for its first section and text-lg for the next
// two. That is what "no visual hierarchy" looks like in source.
// `sub` stopped being a smaller heading and became a label.
//
// At text-base font-semibold it was one step off the body copy underneath it,
// so on a screen with three of them the labels competed with the content they
// were labelling. As a caption in muted ink it steps out of the way, and the
// hierarchy comes from the size gap instead — which is the same move the hero
// makes with 72px against 12px, at the other end of the scale.
//
// No letter-spacing: these are Hebrew, and globals.css is right that tracking
// damages it. Weight and colour do the work.
const levels: Record<Level, string> = {
  page: "text-heading font-bold",
  section: "text-title font-bold",
  sub: "text-caption font-extrabold text-muted",
};

const tags: Record<Level, "h1" | "h2" | "h3"> = {
  page: "h1",
  section: "h2",
  sub: "h3",
};

// A short coloured spine at the leading edge of the heading, and nothing else.
//
// Asked for as "separations with colours and emphasis for different parts of a
// page, to stress the separation". The trap in that request is the obvious
// reading — tint each section's background — which is what already put "six
// competing colours on one screen" in this app once and was reverted.
//
// A 3px bar beside the words does the same job at a fraction of the volume: on
// a page with four sections the eye lands on four different colours and reads
// four parts, while the content underneath stays on one surface. It is the same
// device Disclosure uses down the edge of a section, so a page and the sections
// inside it separate the same way.
//
// Three, because three is how many colours this app actually has to spend.
//
// The first draft of this had five — plan, action, now, done, spend — until the
// spine was measured on screen and two pairs came back identical. The palette
// has four distinct hues and seven names for them: `--primary`, `--action` and
// `--brand` are all #2457f5, and `--warning` is literally `var(--callout)`. A
// "spend" tone beside a "now" tone was the same amber twice, which separates
// nothing. So: blue, amber, green, and red left out — a red heading reads as an
// error, and these are sections, not failures.
//
// And **most headings take no tone at all.** A bar on every one of them is a
// page with four bars and no emphasis; the bar means "this section wants
// something from you", so it only works while some sections do not have it.
export type HeadingTone =
  // Something to do or decide here.
  | "action"
  // Time-critical. The amber the app reserves for "now".
  | "now"
  // Settled, chosen, done.
  | "done";

const TONES: Record<HeadingTone, string> = {
  action: "border-s-action",
  now: "border-s-callout",
  done: "border-s-success",
};

type SectionHeadingProps = {
  level?: Level;
  children: ReactNode;
  // Sits under the heading, in muted body copy.
  description?: ReactNode;
  // Sits at the far end of the heading row: a count, a filter, an action.
  actions?: ReactNode;
  // Rendered before the text — a tone dot, an icon.
  leading?: ReactNode;
  // The coloured spine. Left off for a page with one section, where there is
  // nothing to separate it from and the bar would be decoration.
  tone?: HeadingTone;
  className?: string;
  // Escape hatch for the rare case where the visual level and the document
  // outline have to differ (a page whose h1 is visually hidden, for one).
  as?: "h1" | "h2" | "h3";
};

export function SectionHeading({
  level = "section",
  children,
  description,
  actions,
  leading,
  tone,
  className,
  as,
}: SectionHeadingProps) {
  const Tag = as ?? tags[level];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <div
        className={cn(
          "flex min-w-0 flex-col",
          // On the text block rather than on the row, so the bar runs the
          // height of the heading and its description and stops there — not
          // down past the actions sitting at the far end.
          tone && "border-s-[3px] ps-2.5",
          tone && TONES[tone],
        )}
      >
        <Tag className={cn("flex min-w-0 items-center gap-2", levels[level])}>
          {leading}
          {/* wrap-anywhere, not just min-w-0. A heading is very often a trip
              name or a city the user typed, and `min-w-0` only permits the box
              to shrink — it does nothing about text that has no break
              opportunity in it. Without this a single long unbroken word held
              the heading, and therefore the whole page column, open past the
              viewport. */}
          <span className="min-w-0 wrap-anywhere">{children}</span>
        </Tag>
        {/* max-w-measure is a measure, not a width, and it sits on the text
            rather than on the column because only text wants it. The main
            column is 660px — the width the design draws cards at — and a line
            of Hebrew body copy at 660px runs 87 characters, which is past
            readable. The token puts it back near 70 at any type size and
            leaves every card beside it at full width. See globals.css. */}
        {description && (
          <p className="min-w-0 max-w-measure text-sm text-muted wrap-anywhere">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
