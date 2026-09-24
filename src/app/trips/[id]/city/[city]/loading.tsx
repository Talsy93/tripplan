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
      <div className="sticky top-0 hidden h-dvh w-rail shrink-0 border-e border-border bg-surface lg:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pb-12 md:px-6 lg:px-8">
          {/* The terracotta band and its pill row, as one block: no app bar
              above it any more, and a pale shimmer where a solid band is about
              to land is a worse guess than the band. */}
          <div className="-mx-4 h-36 bg-cat-mustsee-ink md:-mx-6 lg:-mx-8" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-36 w-full rounded-[20px]" />
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-36 rounded-[20px]" />
            <Skeleton className="h-36 rounded-[20px]" />
            <Skeleton className="h-36 rounded-[20px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
