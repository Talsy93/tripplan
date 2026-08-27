import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppHeader, AppShell } from "@/components/layout";
import { Badge } from "@/components/ui";
import {
  APP_TIME_ZONE,
  getItineraryDayCount,
  getShareToken,
  getTrip,
  listMembers,
  phaseLabel,
  ShareButton,
  todayIn,
  TripNav,
  TripSideNav,
  tripPhase,
} from "@/features/trips";

// The trip's name becomes the title template for every tab under it, so a tab
// only has to name itself ("היום") and the browser shows
// "היום · איטליה · MyTrip". Every route in the app used to show the same
// title, which made five open tabs indistinguishable.
//
// This costs one extra getTrip per navigation: generateMetadata runs separately
// from the layout body, and Supabase queries are not deduplicated the way fetch
// is. One indexed lookup by primary key is a fair price for the tab titles.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  const name = trip?.name ?? "טיול";

  return {
    title: {
      default: `${name} · MyTrip`,
      template: `%s · ${name} · MyTrip`,
    },
  };
}

// Shared chrome for the five trip tabs.
//
// This lives in a (tabs) route group rather than at [id]/layout.tsx so that
// city/[city] — which has its own back link and no tab bar — does not inherit
// it. App Router does not re-render a layout when navigating between its own
// children, so the header and nav survive a tab switch untouched.
export default async function TripTabsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  // Derived, not stored — see ARCHITECTURE.md #6. The day count only changes
  // the answer for a trip with a start date and no end date.
  //
  // The member list and share token are read here rather than inside
  // ShareButton so the app bar can say whether the trip is shared without being
  // opened. They ride along on a layout that already awaits a query, and this
  // layout does not re-render when switching tabs, so it is one read per trip
  // rather than one per navigation.
  const [dayCount, members, shareToken] = await Promise.all([
    getItineraryDayCount(trip.id),
    listMembers(trip.id),
    getShareToken(trip.id),
  ]);
  const phase = tripPhase(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
    dayCount,
  );

  return (
    <AppShell
      header={
        <AppHeader
          title={trip.name}
          back={
            <Link
              href="/profile"
              className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              {/* In RTL "back" points left, and the glyph is chosen by
                  meaning rather than by mirroring the LTR arrow. */}
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">הטיולים שלי</span>
            </Link>
          }
          trailing={
            <>
              {/* Sharing, in the app bar of every trip screen. It used to be the
                  last section of "עוד → פרטי הטיול", below the dates, the
                  weather, every booking and the expense summary — findable only
                  by someone who already knew it was there. */}
              <ShareButton
                tripId={trip.id}
                // The owner is in this list, and they are not "shared with".
                memberCount={members.filter((member) => !member.is_owner).length}
                isShared={shareToken !== null}
              />
              {/* Hidden on phones: the bar already holds the back link, the trip
                  name and now the share control, and the phase is restated on
                  the day screen itself. sm and not a custom xs — this project
                  defines no breakpoints beyond Tailwind's own, and an undefined
                  `xs:` variant compiles to nothing at all rather than to a
                  narrower rule. */}
              <span className="hidden sm:inline-flex">
                <Badge tone={phase.kind === "during" ? "success" : "neutral"}>
                  {phaseLabel(phase)}
                </Badge>
              </span>
            </>
          }
        />
      }
      sidebar={<TripSideNav tripId={trip.id} />}
      nav={<TripNav tripId={trip.id} />}
    >
      {children}
    </AppShell>
  );
}
