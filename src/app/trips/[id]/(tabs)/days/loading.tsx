import { Skeleton } from "@/components/ui";

// The route screen's own shape, so nothing jumps when the real one arrives:
// the strip of day pills, the day's heading and a few cards beside their time
// column, then the day's map strip under them.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-main flex-col gap-6">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-[78px] w-[60px] shrink-0 rounded-[18px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48 rounded-full" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-start gap-3">
            <Skeleton className="mt-4 h-4 w-11 shrink-0 rounded-full" />
            <Skeleton className="h-[4.5rem] flex-1 rounded-[18px]" />
          </div>
        ))}
      </div>
      <Skeleton className="h-32 rounded-[20px] sm:h-40" />
    </div>
  );
}
