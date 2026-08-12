import { Skeleton } from "@/components/ui";

// Stands in for whichever tab is loading. The header and the tab bar live in
// the (tabs) layout and render immediately, so this covers the content only —
// it deliberately no longer draws a title bar of its own.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-5">
      <Skeleton className="h-72 w-full rounded-tile" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full rounded-card" />
      <Skeleton className="h-16 w-full rounded-card" />
    </div>
  );
}
