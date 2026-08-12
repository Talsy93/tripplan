// Leaflet needs a sized container, so the placeholder matches the map's own
// height rather than collapsing and making the page jump when it arrives.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="h-[26rem] min-w-0 flex-1 animate-pulse rounded-card bg-surface-2" />
      <div className="flex w-full flex-col gap-2 lg:max-w-xs">
        <div className="h-16 animate-pulse rounded-card bg-surface-2" />
        <div className="h-16 animate-pulse rounded-card bg-surface-2" />
        <div className="h-16 animate-pulse rounded-card bg-surface-2" />
      </div>
    </div>
  );
}
