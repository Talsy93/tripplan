import { Skeleton } from "@/components/ui";

// Stands in for whichever tab is loading. The header, the tab bar and the
// desktop rail live in the (tabs) layout and render immediately, so this covers
// the content only — it deliberately does not draw chrome of its own.
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-64 w-full rounded-tile sm:h-72 lg:h-80" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
