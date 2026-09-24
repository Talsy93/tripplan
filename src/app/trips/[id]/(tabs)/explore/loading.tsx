import { Skeleton } from "@/components/ui";

// Mirrors the top of ExploreScreen: the view switch, the title row, the search
// pill, the category grid (three across on a phone, six once the column is
// wide) and the AI box — so nothing moves when the real screen arrives.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-main flex-col gap-6">
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="-mt-2 h-8 w-44" />
      <Skeleton className="h-14 rounded-full" />
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 @xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 py-1">
            <Skeleton className="h-14 w-14 rounded-[18px]" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-44 rounded-[20px]" />
    </div>
  );
}
