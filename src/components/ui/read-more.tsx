import { cn } from "@/lib/cn";

// A paragraph that shows its first lines and offers the rest.
//
// The middle setting between the two this app already had. `Disclosure` hides
// a section behind a heading, which is right when the heading answers the
// question on its own — a category name, a step title. It is wrong for prose,
// because the first line of a paragraph usually *is* the answer and hiding it
// costs a press to learn nothing new.
//
// So: the opening lines stay, and the rest is one press away.
//
// **No state and no client bundle.** The clamp is CSS, the toggle is a native
// `<details>`, and the paragraph is the `<summary>` — so the same text is in
// the DOM once, clamped when closed and not when open. Writing it twice (a
// short copy and a long one) would put two versions of the same sentence in
// the accessibility tree and in ctrl-F.
//
// **The text is not hidden from anything.** `line-clamp` limits the height it
// draws in; every word stays in the DOM, so a screen reader and a page search
// both still find the part a reader has not opened. That is the reason to
// clamp rather than to truncate the string server-side.
export function ReadMore({
  children,
  // How much stays visible. Two is the default because two lines of Hebrew at
  // this measure is about a sentence, which is the unit that decides whether
  // the rest is worth reading.
  lines = 2,
  className,
}: {
  children: string;
  lines?: 2 | 3 | 4;
  className?: string;
}) {
  // Short text takes no control at all. A clamp that never clamps with an
  // "עוד" beside it is a press that does nothing, which is worse than the two
  // lines it was trying to save: the reader learns the affordance lies.
  //
  // A character count rather than a measurement, because this renders on the
  // server and there is no layout to measure. It is tuned to be shy: at
  // roughly 48 characters a line on a phone, the threshold is about a line
  // past the clamp, so a paragraph only gets a control when opening it will
  // visibly reveal something.
  const threshold = lines * 48 + 40;
  if (children.trim().length <= threshold) {
    return (
      <p className={cn("min-w-0 max-w-measure text-sm text-muted", className)}>
        {children}
      </p>
    );
  }

  const clamp =
    lines === 2 ? "line-clamp-2" : lines === 3 ? "line-clamp-3" : "line-clamp-4";

  return (
    <details className={cn("group/more min-w-0", className)}>
      <summary
        className={cn(
          "cursor-pointer list-none rounded-control",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span
          className={cn(
            "block min-w-0 max-w-measure text-sm text-muted",
            clamp,
            "group-open/more:line-clamp-none",
          )}
        >
          {children}
        </span>
        {/* Both states get a word, and the open one needs it most: with the
            clamp lifted there is nothing else on screen saying the paragraph
            can be put back. Pressing the text itself works either way — the
            whole summary is the control — but a reader should not have to
            discover that. */}
        <span className="mt-0.5 inline-block text-caption font-semibold text-primary-ink group-open/more:hidden">
          עוד
        </span>
        <span className="mt-0.5 hidden text-caption font-semibold text-primary-ink group-open/more:inline-block">
          פחות
        </span>
      </summary>
    </details>
  );
}
