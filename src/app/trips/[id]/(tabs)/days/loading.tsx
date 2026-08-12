import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-9 w-40 rounded-full" />
      <Skeleton className="h-6 w-28" />
      {/* Roughly one screen of hour axis, so the page does not jump when the
          real timeline arrives. */}
      <Skeleton className="h-96 w-full rounded-card" />
    </>
  );
}
