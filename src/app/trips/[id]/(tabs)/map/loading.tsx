import { Skeleton } from "@/components/ui";

// Leaflet needs a sized container, so the placeholder matches the map's own
// height rather than collapsing and making the page jump when it arrives. The
// height classes are the same set RouteMap uses — see MAP_HEIGHT there.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Skeleton className="h-40 rounded-tile sm:h-48 lg:h-56" />
        <Skeleton className="h-[20rem] sm:h-[24rem] lg:h-[calc(100dvh-14rem)] lg:min-h-[26rem]" />
      </div>
      <div className="flex w-full flex-col gap-2 lg:w-pane lg:shrink-0">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
