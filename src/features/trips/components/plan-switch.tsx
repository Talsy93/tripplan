import Link from "next/link";
import { Layers, ListChecks } from "lucide-react";
import { cn } from "@/lib/cn";

// The "תכנון" tab's two views (2026-09-25): the swipe deck and the trip's
// destinations. One tab rather than two because six tabs do not fit a phone,
// and both answer the same question — what goes into this trip. Links, not
// state: each view is its own route, so the back button and a shared link
// land on the one that was open.
export function PlanSwitch({
  tripId,
  active,
  className,
}: {
  tripId: string;
  active: "explore" | "discover";
  className?: string;
}) {
  const views = [
    { key: "explore", label: "יעדים", href: `/trips/${tripId}/explore`, Icon: ListChecks },
    { key: "discover", label: "גילוי", href: `/trips/${tripId}/discover`, Icon: Layers },
  ] as const;
  return (
    <nav
      aria-label="תצוגות התכנון"
      className={cn("flex w-full gap-0.5 rounded-full bg-surface-sunken p-1", className)}
    >
      {views.map(({ key, label, href, Icon }) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "bg-surface font-bold text-foreground shadow-card"
                : "font-medium text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
