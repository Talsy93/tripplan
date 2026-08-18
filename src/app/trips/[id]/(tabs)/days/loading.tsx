import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-9 w-40 rounded-full" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* The day index, which only exists from lg. */}
        <div className="hidden w-44 shrink-0 flex-col gap-1 lg:flex">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
        {/* Roughly one screen of hour axis, so the page does not jump when the
            real timeline arrives. */}
        <Skeleton className="h-96 min-w-0 flex-1" />
      </div>
    </>
  );
}
