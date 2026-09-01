import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  Backpack,
  ChevronLeft,
  Compass,
  Globe,
  Languages,
  Luggage,
  MessageCircle,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, SectionHeading } from "@/components/ui";
import { bookingTodoAlert, cancellationAlert } from "../domain/booking";
import { gearProgress } from "../domain/gear";
import { toneClass } from "../domain/tone";
import type { Booking } from "../domain/booking";
import type { GearItem } from "../domain/gear";
import type { TripMember } from "../domain/membership";
import type { Tone } from "../domain/tone";
import { ArchiveTripButton } from "./archive-trip-button";
import { DeleteTripButton } from "./delete-trip-button";

// A menu, not a pile. The five sections used to stack on one page, which on a
// phone meant scrolling past the weather to reach the chat.
//
// The hints used to be fixed descriptions — "רשימת אריזה שאתם ממלאים בעצמכם" —
// which describe the destination rather than say anything about it. A menu row
// that reports state answers the question you opened the menu with ("is there
// anything I still need to do?") without opening anything.
//
// Only where a count is both cheap and worth acting on. "איך זה עובד" has no
// state, and inventing one for symmetry would be worse than the fixed line it
// keeps.
//
// Seven rows since T5, and two of them were missing outright: the city guides
// existed at /trips/[id]/city/[city] and were reachable only from a card inside
// the discovery panel on another tab, and the member list was buried under a
// heading it shared with the public link. "פרטי הטיול" left the list for the
// card at the bottom, which is where the design puts it.
const ENTRIES = [
  {
    segment: "guides",
    label: "מדריכי הערים",
    hint: "אזורי לינה, מסעדות, אטרקציות וחוויות",
    Icon: Globe,
    tone: "lilac",
  },
  {
    segment: "phrases",
    label: "מילים שימושיות",
    hint: "שיחון בשפת היעד, עם תעתיק",
    Icon: Languages,
    tone: "mint",
  },
  {
    segment: "gear",
    label: "ציוד ואריזה",
    hint: "רשימת אריזה שאתם ממלאים בעצמכם",
    Icon: Backpack,
    tone: "amber",
  },
  {
    segment: "chat",
    label: "הצ׳אט של הטיול",
    hint: "לתכנן את הטיול בשיחה חופשית",
    Icon: MessageCircle,
    tone: "peach",
  },
  {
    segment: "members",
    label: "מי בא איתנו",
    hint: "הזמנה לפי אימייל, צפייה או עריכה",
    Icon: Users,
    tone: "rose",
  },
  {
    segment: "share",
    label: "שיתוף הטיול",
    hint: "קישור פומבי לצפייה, בלי חשבון",
    Icon: Share2,
    tone: "sky",
  },
  {
    segment: "guide",
    label: "איך זה עובד",
    hint: "שלבי העבודה, עם קישור לכל מסך",
    Icon: Compass,
    tone: "lilac",
  },
] as const satisfies readonly {
  segment: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: Tone;
}[];

// A component rather than JSX in the page, for the reason TodayBefore and
// ExploreScreen are: the harness cannot render a page that reads the database,
// so a composition left there is one no scene can check — and what T5 has to
// demonstrate is a count of rows and a card.
export function MoreMenu({
  tripId,
  tripName,
  bookings,
  gear,
  members,
  cities,
  // Whether a public view link has been issued. Null when it has not.
  shareToken,
  // Whether the owner has put this trip away. The bottom card's middle row goes
  // both directions — see ArchiveTripButton.
  archived,
  // Stamped by the server, so the deadline counts cannot disagree between the
  // server render and hydration.
  now,
}: {
  tripId: string;
  tripName: string;
  bookings: Booking[];
  gear: GearItem[];
  members: TripMember[];
  cities: string[];
  shareToken: string | null;
  archived: boolean;
  now: string;
}) {
  const at = new Date(now);
  // Anything with a deadline attached that has not been dealt with. Both helpers
  // already exist and are what UpNext surfaces on the "today" tab; this is the
  // same fact, counted rather than listed.
  const needsAttention = bookings.filter(
    (booking) =>
      cancellationAlert(booking, at) !== null ||
      bookingTodoAlert(booking, at) !== null,
  ).length;

  const packing = gearProgress(gear);
  // The owner is in this list and is not "shared with".
  const sharedWith = members.filter((member) => !member.is_owner).length;

  // Keyed by segment so a new entry without a state line falls back to its
  // fixed hint rather than rendering an empty row.
  const state: Partial<Record<string, { text: string; urgent?: boolean }>> = {
    guides:
      cities.length > 0
        ? {
            // The city names themselves, which is what the design's row shows.
            // "Which cities is this trip" is more useful than how many.
            text:
              cities.slice(0, 4).join(", ") +
              (cities.length > 4 ? ` ועוד ${cities.length - 4}` : ""),
          }
        : undefined,
    gear:
      packing.total > 0
        ? { text: `${packing.packed} מתוך ${packing.total} נארזו` }
        : undefined,
    members:
      sharedWith > 0
        ? {
            text:
              sharedWith === 1
                ? "אדם אחד נוסף לטיול"
                : `${sharedWith} אנשים נוספים בטיול`,
          }
        : undefined,
    share: shareToken !== null ? { text: "קישור פעיל" } : undefined,
  };

  // The booking state rides on the "פרטי הטיול" row, because the page it opens
  // is where the bookings are — moving it out of the list must not lose that
  // signal.
  const tripState =
    needsAttention > 0
      ? {
          text:
            needsAttention === 1
              ? "הזמנה אחת דורשת תשומת לב"
              : `${needsAttention} הזמנות דורשות תשומת לב`,
          urgent: true,
        }
      : bookings.length > 0
        ? { text: `${bookings.length} הזמנות · תאריכים, מזג אוויר והוצאות` }
        : { text: "תאריכים, טיסות, רכבות ולינה" };

  return (
    <>
      <SectionHeading level="page">עוד</SectionHeading>

      {/* One card, one row per destination, dividers between — not a grid of
          cards. The grid was a phone screen stretched: at 1024px six cards sat
          three across and each was mostly empty, and on a phone they were a
          single column of cards with a card's worth of padding around a row's
          worth of content.

          A menu is a list. What a wide screen buys it is a comfortable measure,
          not more columns, so the card caps at max-w-2xl and stays on the start
          edge under the heading — measured at 1920 it is 672px wide against a
          1244px content area. A menu row does not get better at 1200px, it just
          gets a longer line between its label and its chevron. */}
      <Card padding="none" className="w-full max-w-2xl overflow-hidden">
        <ul className="flex flex-col">
          {ENTRIES.map(({ segment, label, hint, Icon, tone }) => (
            <li
              key={segment}
              className={cn(
                toneClass(tone),
                "border-b border-border last:border-b-0",
              )}
            >
              <Link
                href={`/trips/${tripId}/more/${segment}`}
                className={cn(
                  "flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
              >
                {/* The city palette, used here for the one job it does well
                    outside a route: telling seven near-identical rows apart at
                    a glance. Every row was the same blue circle before. */}
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-tone text-tone-ink"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{label}</span>
                  {/* The live line replaces the fixed one rather than joining
                      it: two lines of subtitle push the row past the height its
                      neighbours settled on, and the state is the more useful of
                      the two. */}
                  <span
                    className={cn(
                      "block min-w-0 truncate text-sm",
                      state[segment]?.urgent
                        ? "text-warning-ink"
                        : "text-muted",
                    )}
                  >
                    {state[segment]?.text ?? hint}
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

      {/* The second card the design draws: the trip's own record, and the one
          action that destroys it, separated from the seven things you press
          every day. Law 05 asks for exactly this — a destructive action does not
          sit at rest among them. */}
      <Card padding="none" className="w-full max-w-2xl overflow-hidden">
        <Link
          href={`/trips/${tripId}/more/trip`}
          className={cn(
            "flex min-w-0 items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-surface-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
        >
          {/* Neutral, not a tone. The seven rows above are places to go; this is
              the trip's own record, and the design keeps it grey to say so. */}
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted"
            aria-hidden="true"
          >
            <Luggage className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">פרטי הטיול</span>
            <span
              className={cn(
                "block min-w-0 truncate text-sm",
                tripState.urgent ? "text-warning-ink" : "text-muted",
              )}
            >
              {tripState.text}
            </span>
          </span>
          <ChevronLeft
            className="h-5 w-5 shrink-0 text-border-strong"
            aria-hidden="true"
          />
        </Link>

        {/* Between the trip's record and the one action that cannot be undone,
            which is where it belongs on both counts: it is about the trip as a
            whole, and it is the reversible half of "put this away". */}
        <div className="border-b border-border">
          <ArchiveTripButton
            tripId={tripId}
            tripName={tripName}
            archived={archived}
            variant="row"
          />
        </div>

        {/* It used to be at the bottom of /more/trip, under the expense summary
            — correct in spirit and two screens deep in practice. Here it is the
            last row of the last card, in the colour that says what it is, and it
            still opens a dialog that names everything the delete takes with
            it. */}
        <DeleteTripButton tripId={tripId} tripName={tripName} variant="row" />
      </Card>
    </>
  );
}
