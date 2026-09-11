import { Skeleton } from "@/components/ui";

// Mirrors the v5 home exactly: the rail, a map-coloured canvas, and the
// floating panel where the real one will land — so nothing jumps when the
// trips arrive. On a phone the panel is the bottom half of the screen, which
// is the sheet's resting position.
export default function Loading() {
  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh w-rail shrink-0 border-e border-border bg-surface lg:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 border-b border-border bg-surface lg:hidden" />

        <div className="relative h-[calc(100dvh-3.5rem)] flex-1 bg-surface-2 lg:h-dvh">
          <div className="absolute inset-x-0 bottom-0 flex h-[58dvh] flex-col gap-4 rounded-t-modal border-t border-border bg-surface p-4 lg:inset-y-4 lg:end-4 lg:inset-x-auto lg:h-auto lg:w-panel lg:rounded-card lg:border">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-52" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
