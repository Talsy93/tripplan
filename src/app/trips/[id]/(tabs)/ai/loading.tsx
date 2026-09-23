import { Skeleton } from "@/components/ui";

// The concierge banner, then two bubbles.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-32" />
      <Skeleton className="ms-auto h-16 w-3/4 rounded-2xl" />
      <Skeleton className="h-24 w-5/6 rounded-2xl" />
    </div>
  );
}
