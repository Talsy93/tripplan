import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// A section that states what it holds and opens when asked.
//
// Two requests at once, and they turn out to be one component.
//
// **"Most pages are overloaded."** The app's habit is to render every category
// and every option at full height, so a screen opens with six cards of
// suggestions above the list you came to read. A heading you can scan and a
// body you ask for is the fix, and it was already being reached for — four
// hand-rolled `<details>` blocks had grown in three files by the time this was
// written, each with its own summary markup and its own chevron.
//
// **"Add separation with colours that frame certain patterns."** The colour is
// a spine down the leading edge and a tinted icon square, not a filled panel.
// That restraint is not timidity: filling sections with pastel is exactly what
// put "six competing colours on one screen" and was reverted once already (see
// day-pager and the category tiles in place-search). A 3px edge says "these
// belong together and they are this kind of thing" at a tenth of the volume.
//
// Native `<details>`, not state: the browser gives the toggle, the keyboard and
// the screen-reader semantics, and — the reason it matters here — the contents
// stay in the DOM while closed, so form controls inside one still submit and
// text inside one is still findable with ctrl-F.

// Three, and deliberately not more. Each maps onto a token family the app
// already uses for that meaning, and a fourth would be a colour inventing a
// category rather than naming one.
export type DisclosureTone =
  // Your own things: a list, a set of fields, a reference.
  | "neutral"
  // Offered rather than entered — suggestions, AI, starter lists.
  | "suggest"
  // Time-critical. The amber the app reserves for "now".
  | "now";

const TONES: Record<DisclosureTone, { spine: string; tile: string }> = {
  neutral: { spine: "border-s-border-strong", tile: "bg-surface-2 text-muted" },
  suggest: { spine: "border-s-primary", tile: "bg-primary-tint text-primary-ink" },
  now: { spine: "border-s-callout", tile: "bg-callout-tint text-callout-ink" },
};

export function Disclosure({
  title,
  // A quiet second line under the title — what this section is for, or how many
  // things are in it. Read before deciding whether to open, so it has to say
  // something the title does not.
  detail,
  // Rendered at the far end of the summary, before the chevron: a count, a
  // badge. Not a control — the whole summary is the control.
  meta,
  leading,
  tone = "neutral",
  // Open on arrival. For the one section on a screen that is the screen's
  // subject; everything else should cost a press.
  defaultOpen = false,
  // For a body that brings its own padding — a divided list whose rows are
  // already inset. Without it the row's px-3 sits inside the body's p-3 and the
  // list reads as indented from the heading it belongs to.
  flush = false,
  children,
  className,
}: {
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  tone?: DisclosureTone;
  defaultOpen?: boolean;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tones = TONES[tone];

  return (
    <details
      open={defaultOpen}
      className={cn(
        "group/disclosure min-w-0 overflow-hidden rounded-card border border-border bg-surface",
        // The frame. `border-s-4` on the element itself rather than a child, so
        // it runs the full height of the section however far it opens.
        "border-s-4",
        tones.spine,
        className,
      )}
    >
      <summary
        className={cn(
          "flex min-w-0 cursor-pointer list-none items-center gap-2.5 px-3 py-2.5",
          "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          // Safari draws its own triangle and ignores `list-none` without this.
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        {leading && (
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
              tones.tile,
            )}
          >
            {leading}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 text-sm font-bold wrap-anywhere">
            {title}
          </span>
          {detail && (
            <span className="min-w-0 text-caption text-muted wrap-anywhere">
              {detail}
            </span>
          )}
        </span>

        {meta && <span className="shrink-0">{meta}</span>}

        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open/disclosure:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div
        className={cn(
          "flex min-w-0 flex-col border-t border-border",
          !flush && "gap-3 p-3",
        )}
      >
        {children}
      </div>
    </details>
  );
}
