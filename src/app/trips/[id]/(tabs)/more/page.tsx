import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  Backpack,
  ChevronLeft,
  Compass,
  MessageCircle,
  Languages,
  Luggage,
  Share2,
} from "lucide-react";
import { Card, SectionHeading } from "@/components/ui";
import {
  bookingTodoAlert,
  cancellationAlert,
  gearProgress,
  listBookings,
  listGear,
  listMembers,
} from "@/features/trips";

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
// keeps. The three queries here run together and are the only cost.
const ENTRIES = [
  {
    segment: "trip",
    label: "פרטי הטיול",
    hint: "תאריכים, טיסות, רכבות ולינה",
    Icon: Luggage,
  },
  {
    segment: "gear",
    label: "ציוד",
    hint: "רשימת אריזה שאתם ממלאים בעצמכם",
    Icon: Backpack,
  },
  {
    segment: "share",
    label: "שיתוף",
    hint: "הזמנת אנשים, הרשאות, וקישור פומבי",
    Icon: Share2,
  },
  {
    segment: "guide",
    label: "איך זה עובד",
    hint: "שלבי העבודה, עם קישור לכל מסך",
    Icon: Compass,
  },
  {
    segment: "phrases",
    label: "מילים שימושיות",
    hint: "שיחון בשפת היעד, עם תעתיק",
    Icon: Languages,
  },
  {
    segment: "chat",
    label: "שיחה",
    hint: "לתכנן את הטיול בשיחה חופשית",
    Icon: MessageCircle,
  },
] as const;

export const metadata = { title: "עוד" };

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [bookings, gear, members] = await Promise.all([
    listBookings(id),
    listGear(id),
    listMembers(id),
  ]);

  const now = new Date();
  // Anything with a deadline attached that has not been dealt with. Both helpers
  // already exist and are what UpNext surfaces on the "today" tab; this is the
  // same fact, counted rather than listed.
  const needsAttention = bookings.filter(
    (booking) =>
      cancellationAlert(booking, now) !== null ||
      bookingTodoAlert(booking, now) !== null,
  ).length;

  const packing = gearProgress(gear);
  // The owner is in this list and is not "shared with".
  const sharedWith = members.filter((member) => !member.is_owner).length;

  // Keyed by segment so a new entry without a state line falls back to its
  // fixed hint rather than rendering an empty row.
  const state: Partial<Record<string, { text: string; urgent?: boolean }>> = {
    trip:
      needsAttention > 0
        ? {
            text:
              needsAttention === 1
                ? "הזמנה אחת דורשת תשומת לב"
                : `${needsAttention} הזמנות דורשות תשומת לב`,
            urgent: true,
          }
        : bookings.length > 0
          ? { text: `${bookings.length} הזמנות` }
          : undefined,
    gear:
      packing.total > 0
        ? { text: `${packing.packed} מתוך ${packing.total} נארזו` }
        : undefined,
    share:
      sharedWith > 0
        ? {
            text:
              sharedWith === 1
                ? "משותף עם אדם אחד"
                : `משותף עם ${sharedWith} אנשים`,
          }
        : undefined,
  };

  return (
    <>
      <SectionHeading level="page">עוד</SectionHeading>

      {/* Full-width 72px rows in a 1024px column was the most obviously
          phone-only screen in the app. A card each, side by side, once there is
          room for them.

          Three across at lg rather than five: at 1024px the content column is
          about 720px once the rail and the gutters are taken out, and five cards
          in that leaves 144px each — not enough for a label and its hint without
          the hint truncating to nothing. Five only at 2xl, where they fit. */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {ENTRIES.map(({ segment, label, hint, Icon }) => (
          <li key={segment}>
            <Link
              href={`/trips/${id}/more/${segment}`}
              className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card
                variant="interactive"
                className="flex h-full items-center gap-3 sm:flex-col sm:items-start sm:gap-2"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{label}</span>
                  {/* The live line replaces the fixed one rather than joining
                      it: two lines of subtitle in a card this size pushes the
                      row past the height its neighbours settled on, and the
                      state is the more useful of the two. */}
                  <span
                    className={cn(
                      "block min-w-0 truncate text-sm sm:whitespace-normal",
                      state[segment]?.urgent ? "text-warning-ink" : "text-muted",
                    )}
                  >
                    {state[segment]?.text ?? hint}
                  </span>
                </span>
                {/* RTL: "forward" points left. Only useful in the row layout;
                    in the card layout the whole card is the affordance. */}
                <ChevronLeft
                  className="h-5 w-5 shrink-0 text-muted sm:hidden"
                  aria-hidden="true"
                />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
