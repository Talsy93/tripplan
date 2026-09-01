import Link from "next/link";
import { ChevronLeft, Globe } from "lucide-react";
import { Card, EmptyState, ToneDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { cityToneClass, cityToneMap } from "../domain/tone";

export type CityGuideEntry = {
  city: string;
  // How many things the trip has picked in this city. Zero for a city that was
  // suggested and never opened, which is exactly the row worth pressing.
  picked: number;
  // The AI's one-line description, when the city came from discovery.
  description: string | null;
};

// The index of the city guides — one of the two rows T5 found missing from the
// "עוד" menu.
//
// The guides themselves already existed, at /trips/[id]/city/[city], reachable
// only from a card inside the discovery panel on the explore tab. So a trip with
// four cities had four guides and no list of them: once the discovery panel had
// been scrolled past, the way back in was to remember the URL.
export function CityGuideList({
  tripId,
  entries,
}: {
  tripId: string;
  entries: CityGuideEntry[];
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Globe />}
        title="עוד אין ערים בטיול"
        description="בחרו יעדים ב״מה עושים?״, ולכל עיר ייווצר מדריך משלה."
      />
    );
  }

  // The same city→colour assignment every other surface uses, in the same order.
  const tones = cityToneMap(entries.map((entry) => entry.city));

  return (
    <Card padding="none" className="w-full max-w-2xl overflow-hidden">
      <ul>
        {entries.map((entry) => (
          <li
            key={entry.city}
            className={cn(
              "border-b border-border last:border-b-0",
              cityToneClass(tones, entry.city),
            )}
          >
            <Link
              href={`/trips/${tripId}/city/${encodeURIComponent(entry.city)}`}
              className={cn(
                "flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <ToneDot className="h-2.5 w-2.5" />
              <span className="min-w-0 flex-1">
                {/* Wrapped to a second line, not truncated. A city name is
                    whatever the user or the AI typed, and `truncate` in RTL
                    clips the *start* of a Latin string with the ellipsis off
                    screen — measured at 375, an unbreakable name rendered as a
                    word beginning in the middle of itself. Two lines is what the
                    design allows destination names; wrap-anywhere is what
                    actually breaks a token with no break opportunity in it. */}
                <span className="line-clamp-2 min-w-0 text-base font-semibold wrap-anywhere">
                  {entry.city}
                </span>
                {/* The count first when there is one: "how much of this city
                    have I actually chosen" is what the row is asked. The AI's
                    description is what stands in before anything is picked. */}
                <span className="block min-w-0 truncate text-sm text-muted">
                  {entry.picked > 0
                    ? `${entry.picked} ${entry.picked === 1 ? "מקום בטיול" : "מקומות בטיול"}`
                    : (entry.description ?? "עוד לא נבחר כלום מהעיר הזאת")}
                </span>
              </span>
              {/* RTL: "forward" points left. */}
              <ChevronLeft
                className="h-5 w-5 shrink-0 text-border-strong"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
