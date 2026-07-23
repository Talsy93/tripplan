import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </main>
  );
}
