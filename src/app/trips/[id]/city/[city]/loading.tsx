import { Skeleton } from "@/components/ui";

// Width and gutters mirror AppShell. This file said max-w-4xl against a
// max-w-6xl page before phase D, so the column jumped on every load.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-border bg-surface" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-5 pb-12 md:px-6 lg:px-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </div>
  );
}
