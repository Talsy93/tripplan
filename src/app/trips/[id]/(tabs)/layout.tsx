import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppHeader, AppShell } from "@/components/layout";
import { Badge } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import {
  APP_TIME_ZONE,
  assignTripAuras,
  getItinerary,
  getItineraryDayCount,
  getSelectedCitiesByTrip,
  getShareToken,
  getTrip,
  itineraryStops,
  listMembers,
  listTrips,
  phaseLabel,
  RailTripProgress,
  RailTripSwitcher,
  tripHueStyle,
  ShareButton,
  todayIn,
  TripAuraBand,
  TripBandSlot,
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
  // The band's own inputs ride along here, and that placement is the point:
  // App Router does not re-render a layout when navigating between its own
  // children, so this is one read per trip rather than one per tab switch.
  //
  // listTrips + getSelectedCitiesByTrip look like more than the band needs,
  // and they are deliberate. A trip's light is assigned across the whole list
  // (domain/aura.ts) so that no two trips on the home screen share a palette —
  // which means the only way for this band to show the same colour as that
  // trip's tile on the home screen is to run the same assignment. Deriving it
  // from this trip's cities alone would give it a different palette whenever
  // deconfliction had moved it, and one trip in two colours is the bug that
  // sorting the hash was introduced to kill.
  // getCurrentUser joins them for the rail's avatar, which is the wordmark's
  // other half in the design. One more read on a layout that already awaits
  // six, and it does not re-run on a tab switch.
  const [dayCount, members, shareToken, itinerary, citiesByTrip, trips, user] =
    await Promise.all([
      getItineraryDayCount(trip.id),
      listMembers(trip.id),
      getShareToken(trip.id),
      getItinerary(trip.id),
      getSelectedCitiesByTrip(),
      listTrips(),
      getCurrentUser(),
    ]);
  const phase = tripPhase(
    trip.start_date,
    trip.end_date,
    todayIn(APP_TIME_ZONE, new Date()),
    dayCount,
  );

  // Route order when there is an itinerary; otherwise the order the cities
  // were added. Only the order of the chips depends on this — the light is a
  // function of which cities, not of their order.
  const stops = itineraryStops(itinerary).map((stop) => stop.city);
  const cities = stops.length > 0 ? stops : (citiesByTrip.get(trip.id) ?? []);

  const hues =
    assignTripAuras(
      trips.map((other) => ({
        id: other.id,
        cities: citiesByTrip.get(other.id) ?? [],
        createdAt: other.created_at,
      })),
    ).get(trip.id) ?? [];


  return (
    <AppShell
      header={
        <AppHeader
          title={trip.name}
          back={
            // Gone from lg up: from there the rail carries a switcher that
            // goes to the same place and says which trip you are leaving.
            <Link
              href="/profile"
              className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-foreground lg:hidden"
            >
              {/* In RTL "back" points left, and the glyph is chosen by
                  meaning rather than by mirroring the LTR arrow. */}
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">הטיולים שלי</span>
            </Link>
          }
          // Beside the name rather than at the far end of the bar: it says
          // where this trip is in its own life, which is a property of the
          // name it follows.
          //
          // Hidden on phones: the bar already holds the back link, the trip
          // name and the share control, and the phase is restated on the day
          // screen itself. sm and not a custom xs — this project defines no
          // breakpoints beyond Tailwind's own, and an undefined `xs:` variant
          // compiles to nothing at all rather than to a narrower rule.
          badge={
            <span className="hidden shrink-0 sm:inline-flex">
              <Badge tone={phase.kind === "during" ? "success" : "neutral"}>
                {phaseLabel(phase)}
              </Badge>
            </span>
          }
          trailing={
            // Sharing, in the app bar of every trip screen. It used to be the
            // last section of "עוד → פרטי הטיול", below the dates, the weather,
            // every booking and the expense summary — findable only by someone
            // who already knew it was there.
            <ShareButton
              tripId={trip.id}
              // The owner is in this list, and they are not "shared with".
              memberCount={members.filter((member) => !member.is_owner).length}
              isShared={shareToken !== null}
            />
          }
        />
      }
      sidebar={
        <TripSideNav
          tripId={trip.id}
          hues={hues}
          initial={user?.email?.[0]}
          header={
            <RailTripSwitcher
              name={trip.name}
              phase={phase}
              // Already in hand for the aura assignment above — the
              // switcher costs no extra query.
              trips={trips}
              currentId={trip.id}
            />
          }
          footer={
            <RailTripProgress
              phase={phase}
              dayCount={dayCount}
              startDate={trip.start_date}
            />
          }
        />
      }
      nav={<TripNav tripId={trip.id} />}
      // Above every tab's own content, because the trip is the thing all ten of
      // them are about. The sticky bar carries the small title for when this has
      // scrolled away — the same large-title-collapses pattern both mobile
      // platforms use, and the reason the name appearing twice is not a
      // duplication.
      //
      // The `banner` slot rather than the first child: it bleeds to the viewport
      // edge with negative margins, and inside the two-pane grid a tab may set
      // up, those margins would run sideways into the pane instead of off the
      // screen.
      banner={
        // Every tab but the map. There the map is the content and runs
        // full-bleed from the app bar down — an 11rem band above it would take
        // a third of the screen to repeat a name the app bar already shows.
        <TripBandSlot>
          <TripAuraBand
            name={trip.name}
            startDate={trip.start_date}
            phase={phase}
            dayCount={dayCount}
            cities={cities}
            hues={hues}
          />
        </TripBandSlot>
      }
    >
      {/* The trip's light, published to every tab under it as CSS variables.
          `contents` so this wrapper changes no layout — custom properties
          inherit down the DOM tree whatever the box does. See
          domain/aura-vars.ts for why this is not props. */}
      <div className="contents" style={tripHueStyle(hues)}>
        {children}
      </div>
    </AppShell>
  );
}
