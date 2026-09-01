import { Skeleton } from "@/components/ui";

// Width and gutters mirror AppShell. This file said max-w-4xl against a
// max-w-6xl page before phase D, so the column jumped on every load.
//
// And it was still a lone column after T7 gave this screen a rail, so the frame
// moved 248px sideways the moment the real page arrived — the same thing the
// home screen's skeleton was doing. The rail placeholder is a dark block, not a
// Skeleton: a pale shimmer where a navy column is about to land is a worse guess
// than a navy column.
export default function Loading() {
  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-sidebar shrink-0 bg-aura-base lg:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 border-b border-border bg-surface" />
        <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pb-12 pt-5 md:px-6 lg:px-8">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
