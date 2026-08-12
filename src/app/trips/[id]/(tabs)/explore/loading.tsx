import { Skeleton } from "@/components/ui";

// Mirrors the category grid: two columns on a phone, four on a wide screen.
export default function Loading() {
  return (
    <>
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-tile" />
        ))}
      </div>
    </>
  );
}
