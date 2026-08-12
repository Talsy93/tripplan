import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-[4.5rem] w-full rounded-card" />
      <Skeleton className="h-[4.5rem] w-full rounded-card" />
      <Skeleton className="h-[4.5rem] w-full rounded-card" />
    </>
  );
}
