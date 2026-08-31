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
  type LucideIcon,
} from "lucide-react";
import { Card, SectionHeading } from "@/components/ui";
import {
  bookingTodoAlert,
  cancellationAlert,
  gearProgress,
  listBookings,
  listGear,
  listMembers,
  toneClass,
  type Tone,
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
    tone: "sky",
  },
  {
    segment: "gear",
    label: "ציוד",
    hint: "רשימת אריזה שאתם ממלאים בעצמכם",
    Icon: Backpack,
    tone: "amber",
  },
  {
    segment: "share",
    label: "שיתוף",
    hint: "הזמנת אנשים, הרשאות, וקישור פומבי",
    Icon: Share2,
    tone: "rose",
  },
  {
    segment: "guide",
    label: "איך זה עובד",
    hint: "שלבי העבודה, עם קישור לכל מסך",
    Icon: Compass,
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
    segment: "chat",
    label: "שיחה",
    hint: "לתכנן את הטיול בשיחה חופשית",
    Icon: MessageCircle,
    tone: "peach",
  },
] as const satisfies readonly {
  segment: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: Tone;
}[];

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

      {/* One card, one row per destination, dividers between — not a grid of
          cards. The grid was a phone screen stretched: at 1024px six cards sat
          three across and each was mostly empty, and on a phone they were a
          single column of cards with a card's worth of padding around a row's
          worth of content.

          A menu is a list. What a wide screen buys it is a comfortable measure,
          not more columns, so the card caps and centres instead of spreading. */}
      {/* Capped, not spread: a menu row does not get better at 1200px, it just
          gets a longer line between its label and its chevron. */}
      <Card padding="none" className="w-full max-w-2xl overflow-hidden">
        <ul className="flex flex-col">
          {ENTRIES.map(({ segment, label, hint, Icon, tone }, index) => (
            <li key={segment} className={toneClass(tone)}>
              <Link
                href={`/trips/${id}/more/${segment}`}
                className={cn(
                  "flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  index < ENTRIES.length - 1 && "border-b border-border",
                )}
              >
                {/* The city palette, used here for the one job it does well
                    outside a route: telling six near-identical rows apart at a
                    glance. Every row was the same blue circle before. */}
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
                      state[segment]?.urgent ? "text-warning-ink" : "text-muted",
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
    </>
  );
}
