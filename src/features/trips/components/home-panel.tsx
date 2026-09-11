import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Clock, MapPinned } from "lucide-react";
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
// time; a number never does, and it is the same number the map draws.
export function HomePanel({
  entries,
  featured,
  featuredCities = [],
  featuredDayCount = 0,
  featuredOpen = [],
  dayCounts,
  footerAction,
}: {
  // Every trip, in the order the map and the list share.
  entries: StandingTrip[];
  featured: StandingTrip | null;
  featuredCities?: string[];
  featuredDayCount?: number;
  featuredOpen?: OpenItem[];
  dayCounts?: Map<string, number>;
  // The far end of the footer — sign-out, which belongs to another feature
  // and arrives here as a slot.
  footerAction?: ReactNode;
}) {
  const others = entries.filter((entry) => entry.trip.id !== featured?.trip.id);
  const totalDays = entries.reduce(
    (sum, entry) => sum + (dayCounts?.get(entry.trip.id) ?? 0),
    0,
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1 lg:pt-4">
        <h1 className="font-display text-title font-semibold">הטיולים שלי</h1>
        <NewTripButton />
      </div>

      {featured ? (
        <FeaturedCard
          entry={featured}
          cities={featuredCities}
          dayCount={featuredDayCount}
          open={featuredOpen}
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
            {others.map((entry) => {
              const position = entries.indexOf(entry) + 1;
              return (
                <li key={entry.trip.id}>
                  <TripRow entry={entry} position={position} />
                </li>
              );
            })}
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

function FeaturedCard({
  entry,
  cities,
  dayCount,
  open,
}: {
  entry: StandingTrip;
  cities: string[];
  dayCount: number;
  open: OpenItem[];
}) {
  const { trip, phase } = entry;
  const days = trip.start_date ? daysUntil(trip.start_date) : null;
  const counting = phase.kind === "before" && days !== null && days > 0;
  const next = open[0];

  return (
    <section
      aria-label="הטיול הקרוב"
      className="mx-3 flex flex-col gap-3 rounded-card border border-primary bg-surface p-4 shadow-[0_0_0_3px_var(--primary-tint)]"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={phase.kind === "during" ? "callout" : "action"}>
          <Clock className="h-3 w-3" aria-hidden="true" />
          {standingLabel(phase)}
        </Badge>
        <span className="text-caption tabular-nums text-muted">
          {dateLine(trip)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <h2 className="min-w-0 font-display text-heading font-semibold wrap-anywhere">
          {trip.name}
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
        {phase.kind === "during" && (
          <span className="flex shrink-0 flex-col items-center leading-none">
            <span className="font-display text-display font-bold text-callout-ink">
              {phase.dayNumber}
            </span>
            <span className="text-caption font-semibold text-muted">
              מתוך {dayCount}
            </span>
          </span>
        )}
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

      {open.length > 0 && (
        <p className="text-caption text-muted">
          {open.length === 1
            ? "נשאר דבר אחד לסגור"
            : `נשארו ${open.length} דברים לסגור`}
        </p>
      )}

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
            href={`/trips/${trip.id}`}
            className={cn(buttonClasses("primary", "md"), "flex-1")}
          >
            פתחו את הטיול
          </Link>
        )}
        {next && (
          <Link
            href={`/trips/${trip.id}`}
            className={buttonClasses("outline", "md")}
          >
            פתחו
          </Link>
        )}
      </div>
    </section>
  );
}

function TripRow({ entry, position }: { entry: StandingTrip; position: number }) {
  const { trip, phase } = entry;
  const during = phase.kind === "during";
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold tabular-nums",
          during
            ? "bg-callout text-foreground"
            : "bg-surface-2 text-muted",
        )}
      >
        {position}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="min-w-0 truncate text-sm font-semibold">{trip.name}</span>
        <span className="min-w-0 truncate text-caption text-muted">
          {standingLabel(phase)} · {dateLine(trip)}
        </span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-border-strong" aria-hidden="true" />
    </Link>
  );
}

function dateLine(trip: Trip): string {
  if (trip.start_date && trip.end_date) {
    return `${formatShortDate(trip.start_date)}–${formatShortDate(trip.end_date)}`;
  }
  if (trip.start_date) return `מ-${formatShortDate(trip.start_date)}`;
  return "בלי תאריכים";
}
