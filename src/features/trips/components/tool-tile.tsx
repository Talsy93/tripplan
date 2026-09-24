import type { ReactNode } from "react";

// One tile of the היום tab's "ארגז כלים" (Pencil, v7): a small teal-tint icon
// square, the value the tool is about, and what the tool is — three equal
// white tiles side by side, each opening its sheet.
//
// Only the look lives here. The tiles themselves are client components in
// their own files (the converter, the phrasebook, today's spend), and each one
// decides whether it is a button that opens a sheet or a link elsewhere; they
// share these classes and this body so the three cannot drift apart.
export const toolTileClasses =
  "flex h-full min-h-[7.5rem] w-full min-w-0 flex-col items-start rounded-[1.25rem] bg-surface p-3.5 text-start shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ToolTileBody({
  icon,
  value,
  label,
  valueDir,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: ReactNode;
  // Amounts are written "€64" and read left to right; a phrase is whatever
  // script the destination uses.
  valueDir?: "ltr" | "auto";
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary [&>svg]:h-[1.125rem] [&>svg]:w-[1.125rem]"
      >
        {icon}
      </span>
      {/* The direction goes on an inner span: on the block itself, "ltr"
          would also flip text-start and push the value to the far edge. */}
      <span className="mt-auto w-full min-w-0 truncate pt-3 text-start text-base leading-6 font-bold tabular-nums text-foreground">
        <span dir={valueDir}>{value}</span>
      </span>
      <span className="w-full min-w-0 truncate text-xs text-muted">{label}</span>
    </>
  );
}
