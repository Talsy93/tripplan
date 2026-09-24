import { Skeleton } from "@/components/ui";

// The shapes of the screen that is coming (Pencil, v7), so nothing jumps when
// it arrives: the greeting line with its weather chip, the "now" card, the
// tonight row and the three toolbox tiles.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-main flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-14 w-24 rounded-2xl" />
      </div>
      <Skeleton className="h-52 rounded-[1.5rem]" />
      <Skeleton className="h-20 rounded-[1.25rem]" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-[1.25rem]" />
        ))}
      </div>
    </div>
  );
}
