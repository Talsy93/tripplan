"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, MapPinned, X } from "lucide-react";
import { Badge, buttonClasses, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { NewTripButton } from "./create-trip-form";
import { daysUntil, formatShortDate } from "../domain/trip";
import { standingLabel } from "../domain/trip-order";
import type { OpenItem } from "../domain/open-items";
import type { StandingTrip } from "../domain/trip-order";
import type { Trip } from "../domain/trip";

// The floating panel of the v5 home: the next trip as a card with its next
// step, then every other trip as a numbered row that matches a pin on the
// map behind it.
//
// Numbers, not colours, identify a trip here. The aura gave each trip three
// hues, and eight palettes across four trips still collided a third of the
// time; a number never does, and it is the same number the map draws on the
// trip you have selected.
//
// **One press selects, the next one opens.** The panel used to be a stack of
// plain links: every press left the screen, so the map behind it — the whole
// point of this home — was a picture you could never interrogate. Now the
// first press lights the trip up on the map and flies the view to it, and the
// press after that goes into the trip. Nothing is lost on the way: the press
// is only intercepted when it is a plain left click, so ctrl/cmd-click and
// middle-click still open a trip in a new tab on the first try, the rows are
// still real `<a href>` that Next prefetches, and a selected trip also grows
// an explicit "פתחו את הטיול" for anyone who would rather see the way out
// than guess at it.
export function HomePanel({
  entries,
  featured,
  featuredCities = [],
  featuredDayCount = 0,
  featuredOpen = [],
  dayCounts,
  // The selected trip, owned by HomeScreen — the map sets it too, by a press
  // on a flag.
  selectedId = null,
  onSelect,
  // The trips the map can actually draw. A trip whose cities were never
  // located has no flag, so selecting it would light up nothing; the row says
  // so instead of looking broken.
  locatedIds,
  // The far end of the footer — sign-out, which belongs to another feature
  // and arrives here as a slot.
  footerAction,
}: {
  // Every trip, in the order the map and the list share.
  entries: StandingTrip[];
  featured: StandingTrip | null;
  featuredCities?: string[];
  featuredDayCount?: number;
  featuredOpen?: OpenItem[];
  dayCounts?: Map<string, number>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  locatedIds?: Set<string>;
  footerAction?: ReactNode;
}) {
  const others = entries.filter((entry) => entry.trip.id !== featured?.trip.id);
  const totalDays = entries.reduce(
    (sum, entry) => sum + (dayCounts?.get(entry.trip.id) ?? 0),
    0,
  );
  const positionOf = (entry: StandingTrip) => entries.indexOf(entry) + 1;
  const isLocated = (id: string) => !locatedIds || locatedIds.has(id);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1 lg:pt-4">
        <h1 className="font-display text-title font-semibold">הטיולים שלי</h1>
        <div className="flex items-center gap-1.5">
          {/* The way back to the whole world. The map clears on a press of its
              own empty space and on Escape, but neither is reachable with a
              thumb while the sheet covers the map. */}
          {selectedId && onSelect && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={cn(
                buttonClasses("ghost", "sm"),
                "text-muted hover:text-foreground",
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              כל הטיולים
            </button>
          )}
          <NewTripButton />
        </div>
      </div>

      {featured ? (
        <FeaturedCard
          entry={featured}
          position={positionOf(featured)}
          cities={featuredCities}
          dayCount={featuredDayCount}
          open={featuredOpen}
          selected={featured.trip.id === selectedId}
          located={isLocated(featured.trip.id)}
          onSelect={onSelect}
        />
      ) : (
        <div className="px-4">
          <EmptyState
            icon={<MapPinned />}
            title="עוד אין טיולים"
            description="פתחו טיול חדש, בחרו יעדים, והמפה כאן תתמלא."
          />
        </div>
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-1 px-3 pt-4">
          <h2 className="px-2 pb-1 text-caption font-bold text-muted">
            עוד על המפה
          </h2>
          <ul className="flex flex-col gap-0.5">
            {others.map((entry) => (
              <li key={entry.trip.id}>
                <TripRow
                  entry={entry}
                  position={positionOf(entry)}
                  selected={entry.trip.id === selectedId}
                  located={isLocated(entry.trip.id)}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(entries.length > 0 || footerAction) && (
        <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-caption text-muted">
          <span>
            {entries.length > 0 &&
              (entries.length === 1 ? "טיול אחד" : `${entries.length} טיולים`)}
            {totalDays > 0 && ` · ${totalDays} ימים בדרכים`}
          </span>
          {footerAction}
        </footer>
      )}
    </div>
  );
}

// The press rule, in one place because the card and the row have to agree on
// it — two different answers to the same gesture on the same screen is how a
// list stops being predictable.
//
// Returns the handler for a link that should select first and navigate second.
// A press that was already asking for a new tab (ctrl, cmd, shift, middle
// button) is left alone: the browser's job, and intercepting it would be
// taking something away.
function useSelectThenOpen({
  id,
  href,
  selected,
  onSelect,
}: {
  id: string;
  href: string;
  selected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const router = useRouter();

  // The second press should not then wait for the trip to load. Next prefetches
  // a link in the viewport anyway; this covers the sheet, whose rows are
  // scrolled out of it more often than not.
  useEffect(() => {
    if (selected) router.prefetch(href);
  }, [selected, href, router]);

  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onSelect || selected) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    onSelect(id);
  };
}

// What the press will do, for a screen reader — the visible row cannot say it,
// and a link that does not navigate on its first activation has to.
function pressHint(selected: boolean, enabled: boolean): string {
  if (!enabled) return "";
  return selected ? " — פתיחת הטיול" : " — סימון על המפה";
}

function FeaturedCard({
  entry,
  position,
  cities,
  dayCount,
  open,
  selected,
  located,
  onSelect,
}: {
  entry: StandingTrip;
  position: number;
  cities: string[];
  dayCount: number;
  open: OpenItem[];
  selected: boolean;
  located: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const { trip, phase } = entry;
  const days = trip.start_date ? daysUntil(trip.start_date) : null;
  const counting = phase.kind === "before" && days !== null && days > 0;
  const during = phase.kind === "during";
  const next = open[0];
  const href = `/trips/${trip.id}`;
  const press = useSelectThenOpen({ id: trip.id, href, selected, onSelect });

  return (
    <section
      aria-label="הטיול הקרוב"
      className={cn(
        "mx-3 flex flex-col gap-3 rounded-card border bg-surface p-4",
        selected && during
          ? "border-callout shadow-[0_0_0_3px_var(--callout-tint)]"
          : "border-primary shadow-[0_0_0_3px_var(--primary-tint)]",
      )}
    >
      {/* The whole head of the card is the press target, and the buttons below
          it stay outside — a link wrapping a link is not a thing the DOM has an
          answer for. */}
      <Link
        href={href}
        onClick={press}
        className="flex flex-col gap-3 rounded-control text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <Badge tone={during ? "callout" : "action"}>
            <Clock className="h-3 w-3" aria-hidden="true" />
            {standingLabel(phase)}
          </Badge>
          <span className="text-caption tabular-nums text-muted">
            {dateLine(trip)}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 font-display text-heading font-semibold wrap-anywhere">
            {/* The same number the map draws on this trip's flags once it is
                selected. The card used to have none, which left the list
                numbered 2, 3, 4 with nothing holding the 1. */}
            <PositionDisc
              position={position}
              selected={selected}
              during={during}
            />
            <span className="min-w-0">{trip.name}</span>
          </h2>
          {counting && (
            <span className="flex shrink-0 flex-col items-center leading-none">
              <span className="font-display text-display font-bold text-primary">
                {days}
              </span>
              <span className="text-caption font-semibold text-muted">
                {days === 1 ? "יום" : "ימים"}
              </span>
            </span>
          )}
          {during && (
            <span className="flex shrink-0 flex-col items-center leading-none">
              <span className="font-display text-display font-bold text-callout-ink">
                {phase.dayNumber}
              </span>
              <span className="text-caption font-semibold text-muted">
                מתוך {dayCount}
              </span>
            </span>
          )}
          <span className="sr-only">{pressHint(selected, Boolean(onSelect))}</span>
        </div>

        {(cities.length > 0 || dayCount > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
            {cities.slice(0, 3).map((city) => (
              <Badge key={city} tone="neutral">
                {city}
              </Badge>
            ))}
            {cities.length > 3 && <span>ועוד {cities.length - 3}</span>}
            {dayCount > 0 && <span>· {dayCount} ימים</span>}
          </div>
        )}
      </Link>

      {open.length > 0 && (
        <p className="text-caption text-muted">
          {open.length === 1
            ? "נשאר דבר אחד לסגור"
            : `נשארו ${open.length} דברים לסגור`}
        </p>
      )}

      <UnlocatedNote show={selected && !located} />

      <div className="flex gap-2">
        {next ? (
          <Link
            href={`/trips/${trip.id}/${next.path}`}
            className={cn(buttonClasses("primary", "md"), "min-w-0 flex-1")}
          >
            <span className="truncate">הבא: {next.text}</span>
          </Link>
        ) : (
          <Link
            href={href}
            className={cn(buttonClasses("primary", "md"), "flex-1")}
          >
            פתחו את הטיול
          </Link>
        )}
        {next && (
          <Link href={href} className={buttonClasses("outline", "md")}>
            פתחו
          </Link>
        )}
      </div>
    </section>
  );
}

function TripRow({
  entry,
  position,
  selected,
  located,
  onSelect,
}: {
  entry: StandingTrip;
  position: number;
  selected: boolean;
  located: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const { trip, phase } = entry;
  const during = phase.kind === "during";
  const href = `/trips/${trip.id}`;
  const press = useSelectThenOpen({ id: trip.id, href, selected, onSelect });
  const row = useRef<HTMLDivElement>(null);

  // A press on a flag selects a trip whose row may be anywhere in a sheet that
  // is mostly scrolled out of sight. Without this the map answers and the
  // panel appears not to.
  useEffect(() => {
    if (selected) {
      row.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  return (
    <div
      ref={row}
      className={cn(
        "flex flex-col rounded-control transition-colors",
        selected &&
          (during
            ? "bg-callout-tint ring-2 ring-callout"
            : "bg-primary-tint ring-2 ring-primary"),
      )}
    >
      <Link
        href={href}
        onClick={press}
        className={cn(
          "flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !selected && "hover:bg-surface-2",
        )}
      >
        <PositionDisc position={position} selected={selected} during={during} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 truncate text-sm font-semibold">
            {trip.name}
            <span className="sr-only">
              {pressHint(selected, Boolean(onSelect))}
            </span>
          </span>
          <span className="min-w-0 truncate text-caption text-muted">
            {standingLabel(phase)} · {dateLine(trip)}
          </span>
        </span>
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-border-strong"
          aria-hidden="true"
        />
      </Link>

      {selected && (
        <div className="flex flex-col gap-2 px-2 pb-2.5">
          <UnlocatedNote show={!located} />
          {/* Redundant with pressing the row again, on purpose. The two-step is
              worth having and worth not making anyone deduce. */}
          <Link
            href={href}
            className={cn(buttonClasses("primary", "sm"), "justify-center")}
          >
            פתחו את הטיול
          </Link>
        </div>
      )}
    </div>
  );
}

// The number shared by the row and, while the trip is selected, by every flag
// of that trip on the map.
function PositionDisc({
  position,
  selected,
  during,
}: {
  position: number;
  selected: boolean;
  during: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular-nums transition-colors",
        selected && during && "bg-callout text-foreground",
        selected && !during && "bg-primary text-primary-foreground",
        !selected && during && "bg-callout text-foreground",
        !selected && !during && "bg-surface-2 text-muted",
      )}
    >
      {position}
    </span>
  );
}

// Selecting a trip the map cannot draw looks exactly like a press that did
// nothing. It is not — it is a trip whose cities were never given coordinates.
function UnlocatedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-caption text-muted">
      אין עדיין יעדים עם מיקום בטיול הזה, אז אין מה לסמן על המפה.
    </p>
  );
}

function dateLine(trip: Trip): string {
  if (trip.start_date && trip.end_date) {
    return `${formatShortDate(trip.start_date)}–${formatShortDate(trip.end_date)}`;
  }
  if (trip.start_date) return `מ-${formatShortDate(trip.start_date)}`;
  return "בלי תאריכים";
}
