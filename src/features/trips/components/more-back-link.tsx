import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Back to the trip hub ("מסמכים") from one of its screens — or, given an
// href, back to wherever the screen was opened from. v7 (Pencil): a quiet
// chevron and label, 44px tall to hit, instead of a filled pill.
export function MoreBackLink({
  tripId,
  href,
  label = "חזרה למסמכים",
}: {
  tripId: string;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href ?? `/trips/${tripId}/more`}
      className="-ms-2 flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight className="h-5 w-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
