"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Compass,
  Globe,
  Languages,
  Luggage,
  Share2,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { bookingTodoAlert, cancellationAlert } from "../domain/booking";
import { gearProgress } from "../domain/gear";
import type { Booking } from "../domain/booking";
import type { GearItem } from "../domain/gear";
import type { TripMember } from "../domain/membership";
import { AddBookingButton } from "./booking-form";
import { BookingList } from "./booking-list";
import { DeleteTripButton } from "./delete-trip-button";

// The "מסמכים" tab, rebuilt to the screen the design actually draws.
//
// Reported as "the documents page does not look like the design", and it did
// not: the design's third export (design/stitch/…/_3) is a **hub of content** —
// an eyebrow over the trip's name, a row of filter chips, and then the things
// themselves: boarding passes, the packing progress, who is coming. What was
// here was eight link cards in a grid. Same routes, same data, and none of the
// screen the design is about.
//
// So the tickets, the packing bar and the sharing state come out of their
// sub-pages and onto this one, and the destinations that are genuinely separate
// screens — the city guides, the phrasebook, the trip's own record, the how-to —
// stay as a compact list at the foot rather than as eight cards at the top.
//
// **Two blocks of the design are deliberately not built.** "הוספת קובץ" needs
// file storage the app has no table or bucket for, and "חירום וביטוח" needs
// emergency contacts that are nowhere in the schema. Both would be a migration
// and a decision, and drawing either with invented content would make this
// screen look finished while being a picture. The primary action is
// "הוספת כרטיס" instead, which is the real thing this app stores.

// Which sections a chip shows. "all" is the state it opens in.
type Filter = "all" | "tickets" | "gear" | "people";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "tickets", label: "כרטיסים ואישורים" },
  { key: "gear", label: "ציוד ומשימות" },
  { key: "people", label: "שיתוף משפחתי" },
];

// The screens that stay screens. Everything above them is content; these are
// places to go, so they are a list of rows rather than a grid of cards.
const ELSEWHERE = [
  {
    segment: "trip",
    label: "פרטי הטיול",
    hint: "שם, תאריכים, מזג אוויר והוצאות",
    Icon: Luggage,
  },
  {
    segment: "guides",
    label: "מדריכי הערים",
    hint: "אזורי לינה, מסעדות, אטרקציות",
    Icon: Globe,
  },
  {
    segment: "phrases",
    label: "מילים שימושיות",
    hint: "שיחון בשפת היעד, עם תעתיק",
    Icon: Languages,
  },
  {
    segment: "guide",
    label: "איך זה עובד",
    hint: "שלבי העבודה, עם קישור לכל מסך",
    Icon: Compass,
  },
] as const satisfies readonly {
  segment: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[];

export function TripHub({
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
  const [filter, setFilter] = useState<Filter>("all");
  const shows = (section: Filter) => filter === "all" || filter === section;

  const at = new Date(now);
  const needsAttention = bookings.filter(
    (booking) =>
      cancellationAlert(booking, at) !== null ||
      bookingTodoAlert(booking, at) !== null,
  ).length;

  const packing = gearProgress(gear);
  // The owner is in this list and is not "shared with".
  const sharedWith = members.filter((member) => !member.is_owner).length;

  return (
    <>
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption font-medium text-muted">
            מרכז מסמכים ובקרה
          </span>
          <h1 className="min-w-0 text-[1.75rem] font-bold leading-9 wrap-anywhere">
            {tripName}
          </h1>
        </div>
        {/* The design's "add a file". This app stores bookings, not files, so
            the button adds the thing that actually lands on this screen. */}
        <AddBookingButton tripId={tripId} cities={cities} />
      </header>

      {/* The filter row. It scrolls rather than wraps, for the reason the day's
          action row does: four labels of different lengths wrapped to two lines
          at 375 and the row changed height with the language. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((option) => (
          <Chip
            key={option.key}
            active={filter === option.key}
            onClick={() => setFilter(option.key)}
            className="shrink-0"
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {shows("tickets") && (
        <section className="flex min-w-0 flex-col gap-3">
          <HubHeading
            icon={<Ticket className="h-5 w-5" aria-hidden="true" />}
            title="כרטיסי נסיעה ואישורים"
            meta={
              needsAttention > 0 ? (
                <Badge tone="warning">
                  {needsAttention === 1
                    ? "אחת דורשת תשומת לב"
                    : `${needsAttention} דורשות תשומת לב`}
                </Badge>
              ) : bookings.length > 0 ? (
                <Badge tone="neutral">{bookings.length}</Badge>
              ) : undefined
            }
          />
          <BookingList
            tripId={tripId}
            bookings={bookings}
            cities={cities}
            now={now}
          />
        </section>
      )}

      {shows("gear") && (
        <section className="flex min-w-0 flex-col gap-3">
          <HubHeading
            icon={<Luggage className="h-5 w-5" aria-hidden="true" />}
            title="ציוד ורשימת הכנות"
            meta={
              packing.total > 0 ? (
                <Badge tone={packing.done ? "success" : "neutral"}>
                  {packing.packed} מתוך {packing.total} נארזו
                </Badge>
              ) : undefined
            }
          />
          {/* The bar, and a way in — not the list itself. The full list lives
              at /more/gear together with the prep checklist, and rendering the
              editor in two places is the duplication the day tab was just
              cured of. */}
          <Link
            href={`/trips/${tripId}/more/gear`}
            className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {packing.total > 0 ? "מוכנות ליציאה" : "הרשימה עוד ריקה"}
                </span>
                <span className="text-sm font-bold tabular-nums text-primary-ink">
                  {packing.percent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={packing.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-settle ease-snap",
                    packing.done ? "bg-success" : "bg-primary",
                  )}
                  style={{ width: `${packing.percent}%` }}
                />
              </div>
              <span className="flex items-center gap-1 text-caption font-semibold text-primary-ink">
                פתיחת הרשימה המלאה
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </span>
            </Card>
          </Link>
        </section>
      )}

      {shows("people") && (
        <section className="flex min-w-0 flex-col gap-3">
          <HubHeading
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="שותפים ושיתוף"
            meta={
              sharedWith > 0 ? (
                <Badge tone="neutral">{sharedWith} שותפים</Badge>
              ) : undefined
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <HubLink
              href={`/trips/${tripId}/more/members`}
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              label="מי בא איתנו"
              hint={
                sharedWith === 0
                  ? "הזמנה לפי אימייל, צפייה או עריכה"
                  : sharedWith === 1
                    ? "אדם אחד נוסף לטיול"
                    : `${sharedWith} אנשים נוספים בטיול`
              }
            />
            <HubLink
              href={`/trips/${tripId}/more/share`}
              icon={<Share2 className="h-5 w-5" aria-hidden="true" />}
              label="שיתוף הטיול"
              hint={
                shareToken !== null
                  ? "קישור צפייה פעיל"
                  : "קישור פומבי לצפייה, בלי חשבון"
              }
            />
          </div>
        </section>
      )}

      {filter === "all" && (
        <section className="flex min-w-0 flex-col gap-3">
          <HubHeading
            icon={<Compass className="h-5 w-5" aria-hidden="true" />}
            title="עוד בטיול"
          />
          <Card padding="none" className="overflow-hidden">
            <ul className="flex flex-col">
              {ELSEWHERE.map(({ segment, label, hint, Icon }) => (
                <li
                  key={segment}
                  className="border-b border-border last:border-b-0"
                >
                  <Link
                    href={`/trips/${tripId}/more/${segment}`}
                    className={cn(
                      "group/row flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    )}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span className="block min-w-0 truncate text-caption text-muted">
                        {hint}
                      </span>
                    </span>
                    <ChevronLeft
                      className="h-4 w-4 shrink-0 text-border-strong transition-transform group-hover/row:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Apart from everything above it, which is law 05: a destructive action
          does not sit at rest among the things you press every day. */}
      {filter === "all" && (
        <Card padding="none" className="overflow-hidden">
          <DeleteTripButton tripId={tripId} tripName={tripName} variant="row" />
        </Card>
      )}
    </>
  );
}

// The section header the design draws: a round tinted tile, the title, and the
// count at the far end.
function HubHeading({
  icon,
  title,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="min-w-0 flex-1 text-lg font-semibold leading-6 wrap-anywhere">
        {title}
      </h2>
      {meta}
    </div>
  );
}

function HubLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="group/row flex h-full min-w-0 items-center gap-3 transition-[box-shadow,transform] duration-settle ease-snap hover:-translate-y-0.5 hover:shadow-lift">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block min-w-0 truncate text-caption text-muted">
            {hint}
          </span>
        </span>
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-border-strong transition-transform group-hover/row:-translate-x-0.5"
          aria-hidden="true"
        />
      </Card>
    </Link>
  );
}
