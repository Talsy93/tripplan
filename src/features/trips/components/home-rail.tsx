import { Map as MapIcon } from "lucide-react";
import { SideNav } from "@/components/layout";
import type { NavItem } from "@/components/layout";
import { RailTripProgress } from "./rail-trip";
import { RailTripList } from "./rail-trip-list";
import { NewTripButton } from "./create-trip-form";
import type { TripPhase } from "../domain/trip-days";
import type { StandingTrip } from "../domain/trip-order";

// The rail on the home screen.
//
// /profile had none at all, which meant the one screen everybody starts on was
// the one screen that did not look like the app: crossing from here into a trip
// moved the whole frame sideways by 248px. T6 exists for that, and the check is
// frame continuity rather than what the rail happens to hold.
//
// It carries the *upcoming* trip's light, which is the design's call and the
// right one: this screen is mostly about that trip, and the rail is the piece of
// chrome that will still be showing the same colour once you have crossed into
// it. Nothing jumps.
//
// One nav item, then every trip. The design draws three items — "הטיולים שלי",
// "טיול חדש" and "הפרופיל שלי" — but "טיול חדש" is a dialog rather than a
// route, so it sits at the top of the rail where a trip's rail keeps its
// switcher, and there is no account screen to be the third: signing out lives
// in the app bar, where it is also reachable on a phone.
//
// The trips came later, and their absence was the bug. The rail carried the
// featured trip and nothing else, on the one screen whose entire subject is
// which trip — reported as "I only see Italy". The rail inside a trip had had a
// real switcher for a while; this one had a single link. See rail-trip-list.tsx
// for why that is a list here and a disclosure there.
export function HomeRail({
  initial,
  hues,
  // The featured trip — the one being lived, or the next one out. Null on an
  // account with nothing scheduled, and then the rail loses its countdown.
  //
  // Still separate from `trips` below even though it is one of them: this one
  // is here for the footer's progress, which needs a day count the list does
  // not carry and would be one query per trip to supply.
  upcoming,
  // Every trip, already ordered by proximity. Was absent, and the rail showed
  // the featured trip alone as a single nav item — "I only see Italy".
  trips = [],
}: {
  initial?: string;
  hues: string[];
  upcoming: {
    id: string;
    name: string;
    startDate: string | null;
    phase: TripPhase;
    dayCount: number;
  } | null;
  trips?: StandingTrip[];
}) {
  const items: NavItem[] = [
    {
      href: "/profile",
      label: "הטיולים שלי",
      icon: <MapIcon className="h-5 w-5" />,
      active: true,
    },
  ];

  // The featured trip used to be pushed here as a second nav item, and it was
  // the only trip the rail could reach. RailTripList below reaches all of them,
  // including this one, so a nav item for it would be the same destination
  // twice in the same rail.

  return (
    <SideNav
      items={items}
      hues={hues}
      initial={initial}
      afterItems={<RailTripList entries={trips} />}
      header={
        // Glass, not the white "onLight" treatment. White is reserved for the
        // one selected item — put it on the button too and the top of the rail
        // is two white blocks stacked, with nothing saying which is the state.
        // This is the same surface the trip switcher uses in the slot below it.
        <NewTripButton
          variant="outline"
          className="w-full justify-center border-white/20 bg-white/12 text-white hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-aura-base"
        />
      }
      footer={
        upcoming ? (
          <RailTripProgress
            phase={upcoming.phase}
            dayCount={upcoming.dayCount}
            startDate={upcoming.startDate}
          />
        ) : undefined
      }
    />
  );
}
