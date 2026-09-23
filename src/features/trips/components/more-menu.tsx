import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  Backpack,
  ChevronLeft,
  Compass,
  Globe,
  Languages,
  Luggage,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui";
import { bookingTodoAlert, cancellationAlert } from "../domain/booking";
import { gearProgress } from "../domain/gear";
import { toneClass } from "../domain/tone";
import type { Booking } from "../domain/booking";
import type { GearItem } from "../domain/gear";
import type { TripMember } from "../domain/membership";
import type { Tone } from "../domain/tone";
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
  // First, on request: "put the trip details first, so it is the most
  // reachable." It had been moved *out* of this list in T5 to the card at the
  // bottom, on the reasoning that the design puts it there — but this is the
  // row that holds the name, the dates and the bookings, which is the most
  // edited screen in the app and the one every other screen depends on. Bottom
  // of a seven-row menu is the wrong place for it.
  {
    segment: "trip",
    label: "פרטי הטיול",
    hint: "שם, תאריכים, טיסות ולינה, הוצאות",
    Icon: Luggage,
    tone: "sky",
  },
  {
    segment: "gear",
    label: "רשימות והכנות",
    hint: "מה לעשות לפני היציאה, ומה לארוז",
    Icon: Backpack,
    tone: "amber",
  },
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

  // The booking state rides on the "פרטי הטיול" row, because the page it opens
  // is where the bookings are.
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
    trip: tripState,
  };

  // v6 (Stitch): the trip hub. An eyebrow and the trip's name, then one card
  // per destination — a tinted tile, the name, the live state line — two
  // across from sm. The delete stays apart, in its own card at the foot.
  return (
    <>
      <header className="flex min-w-0 flex-col gap-0.5">
        <span className="text-caption font-medium text-muted">
          מרכז מסמכים ובקרה
        </span>
        <h1 className="min-w-0 text-[1.75rem] font-bold leading-9 wrap-anywhere">
          {tripName}
        </h1>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {ENTRIES.map(({ segment, label, hint, Icon, tone }) => (
          <li key={segment} className={toneClass(tone)}>
            <Link
              href={`/trips/${tripId}/more/${segment}`}
              className={cn(
                "group/row flex h-full min-w-0 items-center gap-3 rounded-card bg-surface p-4 shadow-card",
                "transition-[box-shadow,transform] duration-settle ease-snap hover:-translate-y-0.5 hover:shadow-lift",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {/* The city palette, used for the one job it does well outside a
                  route: telling eight near-identical rows apart at a glance. */}
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-tone text-tone-ink"
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{label}</span>
                <span
                  className={cn(
                    "block min-w-0 truncate text-sm",
                    state[segment]?.urgent
                      ? "font-medium text-warning-ink"
                      : "text-muted",
                  )}
                >
                  {state[segment]?.text ?? hint}
                </span>
              </span>
              <ChevronLeft
                className="h-5 w-5 shrink-0 text-border-strong transition-transform group-hover/row:-translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>

      {/* The one action that destroys the trip, apart from the rows you press
          every day. It still opens a dialog that names everything it takes. */}
      <Card padding="none" className="w-full overflow-hidden">
        <DeleteTripButton tripId={tripId} tripName={tripName} variant="row" />
      </Card>
    </>
  );
}
