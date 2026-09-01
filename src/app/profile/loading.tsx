import { Skeleton } from "@/components/ui";

// Widths and gutters mirror AppShell exactly. They did not before phase D —
// this file said max-w-2xl while the page it stands in for said max-w-5xl, so
// every load ended with the whole column jumping sideways.
//
// And they did not again after T6, which gave this screen a rail: the skeleton
// was still a lone max-w-6xl column, so the frame moved 248px sideways the
// moment the real page arrived. The rail placeholder is a dark block rather than
// a Skeleton because the rail is dark and a pale shimmer where a navy column is
// about to land is a worse guess than a navy column.
export default function Loading() {
  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-sidebar shrink-0 bg-aura-base lg:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 border-b border-border bg-surface" />
        <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pb-12 pt-5 md:px-6 lg:px-8">
          {/* The hero, which is the first thing on the real screen and reaches
              the edges of the content area — so the placeholder does too. */}
          <Skeleton className="-mx-4 -mt-5 h-[22rem] rounded-b-[1.75rem] md:-mx-6 lg:-mx-8 lg:h-[13rem]" />
          <Skeleton className="h-16" />
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
