import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { SideNav } from "@/components/layout";
import type { NavItem } from "@/components/layout";
import { RailTripProgress } from "./rail-trip";
import { NewTripButton } from "./create-trip-form";
import type { TripPhase } from "../domain/trip-days";

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
// Two items, and that is honest rather than sparse. The design draws three —
// "הטיולים שלי", "טיול חדש" and "הפרופיל שלי" — but "טיול חדש" is a dialog
// rather than a route, so it sits at the top of the rail where a trip's rail
// keeps its switcher, and there is no account screen to be the third: signing
// out lives in the app bar, where it is also reachable on a phone.
export function HomeRail({
  initial,
  hues,
  // The soonest trip ahead, when there is one. Null on an account with no
  // upcoming trip, and then the rail is the wordmark, the button and one item.
  upcoming,
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
}) {
  const items: NavItem[] = [
    {
      href: "/profile",
      label: "הטיולים שלי",
      icon: <MapIcon className="h-5 w-5" />,
      active: true,
    },
  ];

  if (upcoming) {
    // The single most likely destination from this screen, and the reason the
    // rail reads as navigation rather than as a label with one entry.
    items.push({
      href: `/trips/${upcoming.id}/today`,
      label: upcoming.name,
      icon: <ArrowLeft className="h-5 w-5" />,
    });
  }

  return (
    <SideNav
      items={items}
      hues={hues}
      initial={initial}
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
