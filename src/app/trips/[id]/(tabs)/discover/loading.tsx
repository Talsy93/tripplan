import { Skeleton } from "@/components/ui";

// The destination pill, the chips, the card and its buttons.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <Skeleton className="h-12 w-48 rounded-full" />
      <Skeleton className="h-8 rounded-full" />
      <Skeleton className="h-[470px] rounded-3xl" />
      <Skeleton className="mx-auto h-16 w-64 rounded-full" />
    </div>
  );
}
