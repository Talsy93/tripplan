import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Back to the trip hub ("מסמכים") from one of its screens — or, given an
// href, back to wherever the screen was opened from.
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
      className="flex items-center gap-1 self-start rounded-full bg-surface-sunken py-1.5 pe-3.5 ps-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
