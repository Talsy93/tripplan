import { Skeleton } from "@/components/ui";

// Mirrors the Pencil home (design/pencil/exports/home-mobile, home-desktop):
// the greeting, the featured card, the one pill button, then the filter, the
// map and the rows — in the same two columns from lg — so nothing jumps when
// the trips arrive.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="hidden h-16 bg-background md:block" />

      <main className="mx-auto flex w-full max-w-[66rem] flex-1 flex-col gap-6 px-4 pb-32 pt-4 md:px-6 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:px-8 lg:pt-8">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-11 w-11 rounded-full md:hidden" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-44" />
            </div>
            <Skeleton className="h-11 w-11 rounded-full md:hidden" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-14 rounded-full" />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
          <Skeleton className="h-56 rounded-3xl lg:h-80" />
          <Skeleton className="h-[76px] rounded-[18px]" />
          <Skeleton className="h-[76px] rounded-[18px]" />
        </div>
      </main>
    </div>
  );
}
