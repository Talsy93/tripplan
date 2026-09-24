import { Skeleton } from "@/components/ui";

// The head row, the switch, then two bubbles on their Pencil sides — the
// assistant on the right (start), the traveller on the left (end).
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-11 rounded-full" />
      <Skeleton className="ms-auto h-16 w-3/4 rounded-[18px]" />
      <Skeleton className="h-20 w-5/6 rounded-[18px]" />
    </div>
  );
}
