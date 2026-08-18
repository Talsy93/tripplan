import { Skeleton } from "@/components/ui";

// Heights mirror CountdownHero exactly, so the hero does not resize under the
// reader when it arrives.
export default function Loading() {
  return (
    <>
      <Skeleton className="h-64 w-full rounded-tile sm:h-72 lg:h-80" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </>
  );
}
