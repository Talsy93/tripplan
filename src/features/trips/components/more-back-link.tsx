import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Back to the "more" menu. RTL: back points right.
export function MoreBackLink({ tripId }: { tripId: string }) {
  return (
    <Link
      href={`/trips/${tripId}/more`}
      className="flex items-center gap-1 self-start rounded-control text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      חזרה לעוד
    </Link>
  );
}
