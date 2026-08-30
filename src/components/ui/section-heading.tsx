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
const levels: Record<Level, string> = {
  page: "text-heading font-bold",
  section: "text-title font-bold",
  sub: "text-base font-semibold",
};

const tags: Record<Level, "h1" | "h2" | "h3"> = {
  page: "h1",
  section: "h2",
  sub: "h3",
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
  className,
  as,
}: SectionHeadingProps) {
  const Tag = as ?? tags[level];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <div className="flex min-w-0 flex-col">
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
        {description && (
          <p className="min-w-0 text-sm text-muted wrap-anywhere">{description}</p>
        )}
      </div>
      {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
