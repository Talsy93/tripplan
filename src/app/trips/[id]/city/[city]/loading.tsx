import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-6 w-32" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </main>
  );
}
