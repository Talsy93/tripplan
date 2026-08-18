import { Skeleton } from "@/components/ui";

// Widths and gutters mirror AppShell exactly. They did not before phase D —
// this file said max-w-2xl while the page it stands in for said max-w-5xl, so
// every load ended with the whole column jumping sideways.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-border bg-surface" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-5 pb-12 md:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-64 rounded-tile sm:h-72" />
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </div>
  );
}
