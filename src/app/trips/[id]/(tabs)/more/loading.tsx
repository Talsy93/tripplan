import { Skeleton } from "@/components/ui";

// Mirrors the menu: rows on a phone, three cards across from sm.
export default function Loading() {
  return (
    <>
      <Skeleton className="h-8 w-20" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-[4.5rem] sm:h-28" />
        <Skeleton className="h-[4.5rem] sm:h-28" />
        <Skeleton className="h-[4.5rem] sm:h-28" />
      </div>
    </>
  );
}
