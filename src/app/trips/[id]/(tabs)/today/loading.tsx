import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-72 w-full rounded-tile sm:h-80" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-16 w-full rounded-card" />
      <Skeleton className="h-16 w-full rounded-card" />
    </>
  );
}
