"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  Dices,
  EllipsisVertical,
  Globe,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  PencilLine,
  Plus,
  Sparkles,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { loadTripMapPlaces } from "../application/trip-map-actions";
import { AppIntro } from "./app-intro";
import { NewTripButton } from "./create-trip-form";
import { DomainIcon } from "./domain-icon";
import { HomeMap } from "./home-map";
import { PlacePhoto } from "./place-photo";
import type { MappedTrip, OpenedTrip } from "./trips-map-canvas";
import type { TripMapPlace } from "../domain/trip-map";
import {
  agoLabel,
  dateRangeLabel,
  monthYearLabel,
  shortMonthYearLabel,
} from "../domain/date-labels";
import type { DomainIconName } from "../domain/icons";
import type { StandingTrip } from "../domain/trip-order";
import { tripTabHref } from "../domain/trip-tabs";

// The home screen, from the Pencil design (design/pencil/exports/home-mobile,
// home-desktop, home-empty — phase PN, 2026-09-24): a greeting, the trip being
// lived (or the next one) on the teal card, the one terracotta "new trip",
// every trip under a segmented filter, and the idea card.
//
// The design has no map on a phone. The map of every trip stays anyway — it is
// the one place the trips are seen side by side — and sits between the filter
// and the rows, so the filter visibly drives both. From lg it is the left
// column, as the desktop export draws it.
//
// Client for one reason: the map, its preview card, the featured card and the
// rows share a selection and a filter. Everything else is fetched on the
// server, except one trip's destinations, read when that trip is opened on the
// map.
//
// A trip is pressed in two steps (the owner's ask, 2026-09-24). The first
// press — on a row, on the featured card, on the preview card or on the trip's
// pin — selects it and flies the map there; it never navigates. A second press
// on the same trip opens it on the map: its saved places and cities replace
// the trip pins, the map fits them and becomes pannable and zoomable, and the
// names appear as it zooms in. Entering a trip is its own control: "כניסה
// לטיול" on the featured card, the arrow on the preview card, the chevron on a
// row. The globe goes back to every trip.

// One trip, as the cards and the map need it.
export type HomeTrip = {
  entry: StandingTrip;
  // The ISO code of the trip's country; null when no city has a country yet.
  // No longer drawn (the design carries no flags), still passed for the map.
  countryCode: string | null;
  // The city the photo is of — the first one on the route.
  city: string | null;
  // Every saved city, in the order chosen — the "רומא • פירנצה" line. Optional
  // so a caller that only has the first city still renders.
  cities?: string[];
  dayCount: number;
  // Saved places ("8 מקומות שמורים").
  placeCount: number;
};

// What only the featured card shows.
export type FeaturedDetails = {
  // Places on the schedule, across every day.
  scheduledCount: number;
  // First letters of the people on the trip, the owner first.
  members: string[];
  progress: { percent: number; label: string } | null;
  weather: { city: string; tempC: number; icon: DomainIconName } | null;
};

type Filter = "all" | "active" | "past";

export function HomeScreen({
  firstName,
  trips,
  featuredId,
  details,
  mapped,
  destinationCount,
  now,
  bell,
  account,
  initialDestinations,
}: {
  firstName: string | null;
  // Every trip, nearest first.
  trips: HomeTrip[];
  featuredId: string | null;
  details: FeaturedDetails | null;
  mapped: MappedTrip[];
  // Distinct cities across every trip — "4 יעדים" beside the greeting.
  destinationCount: number;
  // The server's clock, so "נוצר לפני יומיים" reads the same on both sides.
  now: string;
  // The design's phone header has no app bar: the bell and the avatar sit in
  // the greeting row. The page passes the same two controls its top bar holds
  // from md up; without them (the preview harness) the row is text only.
  bell?: ReactNode;
  account?: ReactNode;
  // Destinations already known, by trip id — opening one of these trips on
  // the map reads nothing. The page passes none (each trip is read when it is
  // opened); the preview harness, which has no database behind it, passes its
  // fixtures here so the opened view can be seen.
  initialDestinations?: Record<string, TripMapPlace[]>;
}) {
  const featured = trips.find((trip) => trip.entry.trip.id === featuredId) ?? null;
  const others = trips.filter((trip) => trip.entry.trip.id !== featuredId);
  // The trip the idea card opens: the featured one, or else the nearest.
  const target = featured ?? trips[0] ?? null;
  const empty = trips.length === 0;
  const mapRef = useRef<HTMLDivElement>(null);
  const selection = useTripMapSelection(trips, mapped, initialDestinations, mapRef);

  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-32 pt-4 md:px-6 md:pb-12 lg:px-8 lg:pt-8",
        // No trips: one centred column, like the empty export — a grid would
        // leave the whole left half of a desktop blank.
        empty
          ? "max-w-lg"
          : "max-w-[66rem] lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-x-10",
      )}
    >
      {/* First column in the DOM is the right-hand one in RTL: the greeting,
          the featured trip and the one call to action, as in the export. */}
      <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
        <Greeting
          firstName={firstName}
          destinationCount={destinationCount}
          bell={bell}
          account={account}
        />
        {featured && details && (
          <FeaturedCard
            trip={featured}
            details={details}
            selected={selection.selectedId === featured.entry.trip.id}
            opened={selection.openId === featured.entry.trip.id}
            onPick={() => selection.pick(featured.entry.trip.id, { scroll: true })}
          />
        )}
        {empty ? (
          <AppIntro />
        ) : (
          <NewTripButton className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-cta text-base font-semibold text-cta-foreground shadow-card transition-[background-color,transform] duration-150 hover:bg-cta-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span>תכנון טיול חדש</span>
          </NewTripButton>
        )}
      </div>

      {!empty && (
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <TripsSection
            trips={trips}
            others={others}
            mapped={mapped}
            featuredId={featuredId}
            now={now}
            selection={selection}
            mapRef={mapRef}
          />
        </div>
      )}

      {target && (
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <IdeaCard tripId={target.entry.trip.id} />
        </div>
      )}
    </main>
  );
}

// ---- 1 · greeting ----------------------------------------------------------

function Greeting({
  firstName,
  destinationCount,
  bell,
  account,
}: {
  firstName: string | null;
  destinationCount: number;
  bell?: ReactNode;
  account?: ReactNode;
}) {
  const hello = firstName ? `שלום, ${firstName}` : "שלום";
  return (
    <section className="flex items-center gap-3 pt-1">
      {account && <div className="shrink-0 md:hidden">{account}</div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm text-muted">
          {hello}
          {destinationCount > 0 && (
            <span className="text-outline">
              {" · "}
              {destinationCount === 1 ? "יעד אחד" : `${destinationCount} יעדים`}
            </span>
          )}
        </p>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground lg:text-[32px]">
          לאן נטייל הפעם?
        </h1>
      </div>
      {bell && <div className="shrink-0 md:hidden">{bell}</div>}
    </section>
  );
}

// ---- 2 · the featured trip ------------------------------------------------

function FeaturedCard({
  trip: home,
  details,
  selected,
  opened,
  onPick,
}: {
  trip: HomeTrip;
  details: FeaturedDetails;
  // Whether the map is pointing at this trip, and whether it is open there.
  selected: boolean;
  opened: boolean;
  // A press on the card: select the trip on the map, or open it if it already
  // is. Entering the trip is the white pill.
  onPick: () => void;
}) {
  const { trip, phase } = home.entry;
  const during = phase.kind === "during";
  const href = `/trips/${trip.id}`;

  const pill = during
    ? home.dayCount > 0
      ? `מתקיים עכשיו · יום ${phase.dayNumber} מתוך ${home.dayCount}`
      : `מתקיים עכשיו · יום ${phase.dayNumber}`
    : phase.kind === "before"
      ? phase.daysUntilStart === 1
        ? "יוצאים מחר"
        : `יוצאים בעוד ${phase.daysUntilStart} ימים`
      : "בתכנון";

  const cities = home.cities?.length ? home.cities : home.city ? [home.city] : [];
  const meta = [
    ...cities.slice(0, 3),
    cities.length > 3 ? `+${cities.length - 3}` : null,
    home.dayCount > 0 ? `${home.dayCount} ימים` : null,
    details.scheduledCount > 0 ? `${details.scheduledCount} מקומות בלו״ז` : null,
  ].filter(Boolean);

  return (
    <section
      aria-label={during ? "הטיול הפעיל" : "הטיול הקרוב"}
      className={cn(
        "relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl bg-primary p-5 text-white shadow-lift transition-shadow",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {/* The photo stays — it was on this card before the redesign — but under
          the teal, so the card reads as the design's gradient first and the
          place second. Without a photo the gradient alone is the card. */}
      <PlacePhoto query={home.city ?? ""} className="absolute inset-0 -z-10 h-full w-full" />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[image:var(--hero-gradient)] opacity-[0.92]"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">
          {during && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-success-bright" />
              <span className="relative h-2 w-2 rounded-full bg-success-bright" />
            </span>
          )}
          <span className="truncate">{pill}</span>
        </span>
        {details.weather && (
          <span
            className="flex shrink-0 items-center gap-1.5 text-base font-semibold"
            title={details.weather.city}
            aria-label={`${details.weather.city}, ${Math.round(details.weather.tempC)} מעלות`}
          >
            <span className="text-cta-tint" aria-hidden="true">
              <DomainIcon name={details.weather.icon} className="h-5 w-5" />
            </span>
            <span dir="ltr" aria-hidden="true">
              {Math.round(details.weather.tempC)}°
            </span>
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[26px] font-bold leading-tight wrap-anywhere">
          {/* The card's press target, stretched over the whole card: it
              points the map at the trip rather than entering it. The controls
              below sit above it (relative z-10) and keep their own targets. */}
          <button
            type="button"
            onClick={onPick}
            aria-pressed={selected}
            className="text-start after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-white"
          >
            {trip.name}
            <span className="sr-only">
              {" — "}
              {pickHint(selected, opened)}
            </span>
          </button>
        </h2>
        {meta.length > 0 && (
          <p className="text-sm text-white/80">{meta.join(" • ")}</p>
        )}
      </div>

      {details.progress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-white/80">{details.progress.label}</span>
            <span className="font-semibold tabular-nums">{details.progress.percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={details.progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={details.progress.label}
            className="h-1.5 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${details.progress.percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center">
          <span className="sr-only">{members(details.members.length)}</span>
          <div className="flex -space-x-2 space-x-reverse">
            {details.members.slice(0, 3).map((initial, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white ring-2 ring-primary",
                  MEMBER_FILLS[index % MEMBER_FILLS.length],
                )}
              >
                {initial}
              </span>
            ))}
          </div>
          {details.members.length > 3 && (
            <span className="ms-2 text-[13px] text-white/80">
              +{details.members.length - 3}
            </span>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-1.5">
          {/* The two shortcuts the card had before the redesign, kept as quiet
              glass discs beside the one white pill. */}
          <Link
            // "היום" exists only while the trip is on; before it, the
            // schedule is the calendar.
            href={tripTabHref(trip.id, during ? "today" : "days")}
            aria-label={during ? "היום בטיול" : "הלו״ז של הטיול"}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Calendar className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href={`/trips/${trip.id}/map`}
            aria-label="מסלול ומפה"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <MapIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href={href}
            className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-4 text-sm font-semibold text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <span>כניסה לטיול</span>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function members(count: number): string {
  return count <= 1 ? "טיול סולו" : `${count} מטיילים`;
}

// The export's three avatars: terracotta, green, violet.
const MEMBER_FILLS = ["bg-cta", "bg-success", "bg-cat-hidden-ink"];

// ---- 3 · every trip: filter, map, rows --------------------------------------

function inFilter(entry: StandingTrip, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "past") return entry.phase.kind === "after";
  return entry.phase.kind === "during" || entry.phase.kind === "before";
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "active", label: "קרובים" },
  { key: "past", label: "עבר" },
];

// Past four rows the list folds.
const FOLD = 4;

// A trip's destinations as last read: the places, or "error" when the read
// failed. Absent while it has not been read (or is being read).
type DestinationCache = Record<string, TripMapPlace[] | "error">;

// What a screen reader hears after a trip's name, and the status line over the
// map says in its own words: what the next press on this trip will do.
function pickHint(selected: boolean, opened: boolean): string {
  if (opened) return "היעדים מוצגים במפה";
  if (selected) return "לחיצה נוספת תציג את היעדים במפה";
  return "הצגה במפה";
}

// The selection the map, its preview card, the featured card and the rows
// share, and the one trip opened on the map.
function useTripMapSelection(
  trips: HomeTrip[],
  mapped: MappedTrip[],
  initialDestinations: Record<string, TripMapPlace[]> | undefined,
  // The map card, scrolled to when a press far from it moves the map — the
  // featured card sits above the filter, and the rows can run below the fold.
  mapRef: RefObject<HTMLDivElement | null>,
) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The trip whose destinations are on the map — always the selected one.
  const [openId, setOpenId] = useState<string | null>(null);
  // "Whole world": every trip in view, until a pin or a filter asks otherwise.
  const [world, setWorld] = useState(false);
  const [destinations, setDestinations] = useState<DestinationCache>(
    () => ({ ...initialDestinations }),
  );
  // Reads in flight, so a third press while the second is still loading does
  // not read the trip twice.
  const loading = useRef(new Set<string>());

  const read = useCallback((id: string) => {
    if (loading.current.has(id)) return;
    loading.current.add(id);
    loadTripMapPlaces(id)
      .then((places) => places ?? ("error" as const))
      .catch(() => "error" as const)
      .then((result) => {
        loading.current.delete(id);
        setDestinations((cache) => ({ ...cache, [id]: result }));
      });
  }, []);

  const clear = useCallback(() => {
    setSelectedId(null);
    setOpenId(null);
  }, []);

  const pick = useCallback(
    (id: string, { scroll = false }: { scroll?: boolean } = {}) => {
      setWorld(false);
      if (id === selectedId) {
        // The second press: open it on the map. A trip already open stays so.
        setOpenId(id);
        if (!(id in destinations)) read(id);
      } else {
        setSelectedId(id);
        setOpenId(null);
        // A trip the filter hides (the featured card while "עבר" is on) is
        // still a trip to show: the filter steps back rather than the press
        // doing nothing.
        const trip = trips.find((t) => t.entry.trip.id === id);
        if (trip && !inFilter(trip.entry, filter)) setFilter("all");
      }
      if (scroll) {
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [selectedId, destinations, read, trips, filter, mapRef],
  );

  // The opened trip as the map draws it. Its cities come from the pins the
  // page already has (a city centre per located city); its places from the
  // read. A failed read still shows the cities.
  const cached = openId ? destinations[openId] : undefined;
  const opened = useMemo<OpenedTrip | null>(() => {
    if (!openId || cached === undefined) return null;
    const cities = mapped.find((trip) => trip.id === openId)?.points ?? [];
    return {
      tripId: openId,
      places: cached === "error" ? [] : cached,
      cities: cities.map(({ city, latitude, longitude }) => ({
        city,
        latitude,
        longitude,
      })),
    };
  }, [openId, cached, mapped]);

  const status: OpenStatus = !openId
    ? "none"
    : cached === undefined
      ? "loading"
      : cached === "error"
        ? "error"
        : opened && opened.places.length + opened.cities.length === 0
          ? "empty"
          : "ready";

  return {
    filter,
    setFilter: (next: Filter) => {
      setFilter(next);
      clear();
      setWorld(false);
    },
    selectedId,
    openId,
    world,
    opened,
    status,
    pick,
    // Back to every trip — the globe.
    showWorld: () => {
      clear();
      setWorld(true);
    },
    // Escape: an opened trip closes to its selection first, then that clears.
    back: () => (openId ? setOpenId(null) : clear()),
    // A tap on empty map, from the canvas (never while a trip is open).
    clear,
  };
}

type OpenStatus = "none" | "loading" | "ready" | "empty" | "error";
type TripMapSelection = ReturnType<typeof useTripMapSelection>;

function TripsSection({
  trips,
  others,
  mapped,
  featuredId,
  now,
  selection,
  mapRef,
}: {
  trips: HomeTrip[];
  // Every trip but the featured one — the rows. The featured trip has its own
  // card above, as in the export.
  others: HomeTrip[];
  mapped: MappedTrip[];
  featuredId: string | null;
  now: string;
  selection: TripMapSelection;
  mapRef: RefObject<HTMLDivElement | null>;
}) {
  const { filter, selectedId, openId, world, opened, status, back } = selection;
  const [unfolded, setUnfolded] = useState(false);

  const shown = useMemo(
    () => trips.filter((trip) => inFilter(trip.entry, filter)),
    [trips, filter],
  );
  const shownIds = useMemo(
    () => new Set(shown.map((trip) => trip.entry.trip.id)),
    [shown],
  );
  const pins = useMemo(
    () => mapped.filter((trip) => shownIds.has(trip.id)),
    [mapped, shownIds],
  );
  const rows = others.filter((trip) => shownIds.has(trip.entry.trip.id));

  // The card over the map always names a trip: the one pressed, or else the
  // featured one, or else the first the filter keeps.
  const selected = selectedId && shownIds.has(selectedId) ? selectedId : null;
  const focus =
    shown.find((trip) => trip.entry.trip.id === selected) ??
    shown.find((trip) => trip.entry.trip.id === featuredId) ??
    shown[0] ??
    null;
  const isOpen = openId !== null && openId === selected;

  // A pressed pin whose trip is folded away unfolds the list, so the row the
  // map is pointing at is always on screen to be highlighted.
  const selectedIndex = selected
    ? rows.findIndex((trip) => trip.entry.trip.id === selected)
    : -1;
  const open = unfolded || selectedIndex >= FOLD;
  const visible = open ? rows : rows.slice(0, FOLD);

  // Escape is the desktop way back: out of an opened trip, then to the world.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, back]);

  return (
    <section aria-labelledby="home-trips-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-trips-heading" className="text-xl font-bold text-foreground">
          {/* One heading, two names: on a phone the filter heads the list, on
              the desktop export it heads the map. */}
          <span className="lg:hidden">כל הטיולים</span>
          <span className="hidden lg:inline">מפת המסעות שלי</span>
        </h2>
        <div
          role="group"
          aria-label="סינון הטיולים"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-sunken p-1"
        >
          {FILTERS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={filter === chip.key}
              onClick={() => selection.setFilter(chip.key)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === chip.key
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={mapRef}
        className={cn(
          // scroll-mb clears the phone's floating tab bar, so a press on the
          // featured card scrolls the map fully into view, not behind it.
          "relative w-full scroll-mt-4 scroll-mb-28 overflow-hidden rounded-3xl bg-surface-2 shadow-card md:scroll-mb-4",
          // An opened trip is a map to explore, so it gets the room for it.
          isOpen ? "h-[22rem] lg:h-[30rem]" : "h-56 lg:h-80",
          // Leaflet's bottom controls (the attribution) move to the top, clear
          // of the preview card; the zoom buttons of an opened trip sit under
          // the globe rather than behind it.
          "[&_.leaflet-bottom]:bottom-auto [&_.leaflet-bottom]:top-0 [&_.leaflet-top.leaflet-left]:top-14",
        )}
      >
        <HomeMap
          trips={pins}
          selectedId={selected}
          focusId={world ? null : (focus?.entry.trip.id ?? null)}
          onSelect={(id) => (id ? selection.pick(id) : selection.clear())}
          insetBottomShare={focus ? (isOpen ? 0.28 : 0.36) : 0}
          opened={isOpen ? opened : null}
        />

        {/* Back to the whole world — every trip, nothing selected or open. */}
        <button
          type="button"
          onClick={selection.showWorld}
          aria-label="כל הטיולים על המפה"
          className="absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-primary shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Globe className="h-5 w-5" aria-hidden="true" />
        </button>

        {focus && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col items-center gap-2">
            <MapStatus
              selected={selected !== null}
              status={isOpen ? status : "none"}
              count={opened ? opened.places.length || opened.cities.length : 0}
            />
            <div className="pointer-events-auto relative flex w-full items-center gap-3 rounded-[18px] bg-surface p-3 shadow-lift">
              <TripTile trip={focus} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                  {/* The card is the same two-step press as the row it
                      names; the arrow is what enters. */}
                  <button
                    type="button"
                    onClick={() => selection.pick(focus.entry.trip.id)}
                    aria-pressed={focus.entry.trip.id === selected}
                    className="min-w-0 truncate text-start text-base font-bold text-foreground after:absolute after:inset-0 after:rounded-[18px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {focus.entry.trip.name}
                    <span className="sr-only">
                      {" — "}
                      {pickHint(
                        focus.entry.trip.id === selected,
                        isOpen && focus.entry.trip.id === openId,
                      )}
                    </span>
                  </button>
                  <PreviewBadge trip={focus} />
                </div>
                <span className="truncate text-[13px] text-muted">
                  {previewMeta(focus)}
                </span>
              </div>
              <Link
                href={`/trips/${focus.entry.trip.id}`}
                aria-label={`כניסה לטיול ${focus.entry.trip.name}`}
                className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <h3 className="hidden pt-2 text-xl font-bold text-foreground lg:block">
        כל הטיולים
      </h3>

      {rows.length === 0 ? (
        others.length > 0 && (
          <p className="rounded-[18px] bg-surface-2 px-4 py-5 text-center text-sm text-muted">
            אין טיולים נוספים בסינון הזה
          </p>
        )
      ) : (
        <div className="@container">
          <ul className="grid gap-3 @lg:grid-cols-2">
            {visible.map((trip) => {
              const id = trip.entry.trip.id;
              return (
                <li key={id} className="min-w-0">
                  <TripRow
                    trip={trip}
                    now={now}
                    selected={id === selected}
                    opened={isOpen && id === openId}
                    onPick={() => selection.pick(id, { scroll: true })}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {rows.length > FOLD && (
        <button
          type="button"
          onClick={() => setUnfolded((value) => !value)}
          aria-expanded={open}
          className="flex h-11 items-center justify-center gap-1 self-center rounded-full px-4 text-sm font-semibold text-primary hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "פחות טיולים" : `עוד ${rows.length - FOLD} טיולים`}
        </button>
      )}
    </section>
  );
}

// The one line over the map that says what is happening and what a press will
// do next. Polite live region, so the read finishing is announced.
function MapStatus({
  selected,
  status,
  count,
}: {
  selected: boolean;
  status: OpenStatus;
  count: number;
}) {
  let icon: ReactNode = null;
  let text: string | null = null;
  switch (status) {
    case "loading":
      icon = <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
      text = "טוענים את היעדים…";
      break;
    case "ready":
      icon = <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />;
      text = `${count === 1 ? "יעד אחד" : `${count} יעדים`} · התקרבו לראות שמות`;
      break;
    case "empty":
      icon = <MapPin className="h-3.5 w-3.5" aria-hidden="true" />;
      text = "עוד אין בטיול הזה יעדים עם מיקום";
      break;
    case "error":
      icon = <MapPin className="h-3.5 w-3.5" aria-hidden="true" />;
      text = "לא הצלחנו לטעון את המקומות — מוצגות הערים";
      break;
    case "none":
      if (selected) {
        icon = <MapPin className="h-3.5 w-3.5" aria-hidden="true" />;
        text = "לחיצה נוספת על הטיול תציג את היעדים";
      }
      break;
  }
  return (
    <p role="status" aria-live="polite" className="flex max-w-full justify-center">
      {text && (
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-semibold text-primary-ink shadow-card">
          {icon}
          <span className="truncate">{text}</span>
        </span>
      )}
    </p>
  );
}

function PreviewBadge({ trip }: { trip: HomeTrip }) {
  const { phase } = trip.entry;
  const [label, tone] =
    phase.kind === "during"
      ? ["עכשיו", "bg-cta-tint text-cta-ink"]
      : phase.kind === "before"
        ? [`בעוד ${phase.daysUntilStart} ימים`, "bg-primary-tint text-primary-ink"]
        : phase.kind === "undated"
          ? ["טיוטה", "bg-surface-sunken text-muted"]
          : [shortMonthYearLabel(trip.entry.trip.start_date), "bg-success-tint text-success-ink"];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function previewMeta(trip: HomeTrip): string {
  const { phase } = trip.entry;
  const days = trip.dayCount > 0 ? `${trip.dayCount} ימים` : "עוד אין לו״ז";
  const places =
    trip.placeCount === 1 ? "מקום אחד שמור" : `${trip.placeCount} מקומות שמורים`;
  switch (phase.kind) {
    case "during":
      return trip.dayCount > 0
        ? `יום ${phase.dayNumber} מתוך ${trip.dayCount} • ${places}`
        : `יום ${phase.dayNumber} • ${places}`;
    case "before":
      return `${days} • ${places}`;
    case "undated":
      return `בלי תאריכים • ${days}`;
    case "after":
      return `הסתיים • ${days}`;
  }
}

// The row's icon tile. The design draws status in it — a pencil for a draft, a
// check for a trip already taken. An upcoming trip had a photo before the
// redesign, and keeps it in the tile, over a pin while it loads or if none.
function TripTile({ trip }: { trip: HomeTrip }) {
  const kind = trip.entry.phase.kind;
  const tile = "h-12 w-12 shrink-0 rounded-[14px]";
  if (kind === "after") {
    return (
      <span
        aria-hidden="true"
        className={cn(tile, "flex items-center justify-center bg-success-tint text-success")}
      >
        <Check className="h-5 w-5" />
      </span>
    );
  }
  if (kind === "undated") {
    return (
      <span
        aria-hidden="true"
        className={cn(tile, "flex items-center justify-center bg-surface-sunken text-muted")}
      >
        <PencilLine className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn(tile, "overflow-hidden bg-primary-tint")}>
      <PlacePhoto
        query={trip.city ?? ""}
        className="h-full w-full bg-primary-tint"
        fallback={<MapPin className="h-5 w-5 text-primary" />}
      />
    </span>
  );
}

function rowMeta(trip: HomeTrip, now: string): string {
  const { trip: t, phase } = trip.entry;
  const cities = (trip.cities?.length ? trip.cities : trip.city ? [trip.city] : []).slice(0, 2);
  const days = trip.dayCount > 0 ? `${trip.dayCount} ימים` : null;
  switch (phase.kind) {
    case "undated":
      return [
        "טיוטה",
        trip.dayCount > 0 ? `${trip.dayCount} ימים מתוכננים` : "עוד אין תאריכים",
        `נוצר ${agoLabel(t.created_at, new Date(now))}`,
      ].join(" • ");
    case "after":
      return [
        ...(cities.length ? cities : [monthYearLabel(t.start_date)]),
        days,
        trip.placeCount > 0 ? `${trip.placeCount} מקומות` : null,
      ]
        .filter(Boolean)
        .join(" • ");
    case "during":
      return [`יום ${phase.dayNumber} בטיול`, ...cities, days].filter(Boolean).join(" • ");
    case "before":
      return [
        phase.daysUntilStart === 1 ? "מחר" : `בעוד ${phase.daysUntilStart} ימים`,
        dateRangeLabel(t.start_date, t.end_date),
        trip.placeCount > 0 ? `${trip.placeCount} מקומות שמורים` : null,
      ]
        .filter(Boolean)
        .join(" • ");
  }
}

function TripRow({
  trip: home,
  now,
  selected,
  opened,
  onPick,
}: {
  trip: HomeTrip;
  now: string;
  // The trip the map's pin is pointing at — ringed, so a press on the map
  // finds its row.
  selected: boolean;
  // Its destinations are the ones on the map.
  opened: boolean;
  // The row's press: select on the map, or open there if already selected.
  // Entering the trip is the chevron at the row's end, a target of its own.
  onPick: () => void;
}) {
  const { trip, phase } = home.entry;
  return (
    <article
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-[18px] bg-surface py-3 ps-3.5 pe-2 shadow-card transition-shadow",
        selected && "ring-2 ring-primary",
      )}
    >
      <TripTile trip={home} />
      <div className="ms-1 flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onPick}
          aria-pressed={selected}
          className="min-w-0 truncate text-start text-base font-bold text-foreground after:absolute after:inset-0 after:rounded-[18px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {trip.name}
          <span className="sr-only">
            {" — "}
            {pickHint(selected, opened)}
          </span>
        </button>
        <span className="truncate text-[13px] text-muted">
          {opened ? (
            <span className="font-semibold text-primary-ink">היעדים מוצגים במפה</span>
          ) : (
            rowMeta(home, now)
          )}
        </span>
      </div>
      {/* A draft's settings shortcut, from before the redesign. Above the
          stretched button, so it is its own target. */}
      {phase.kind === "undated" && (
        <Link
          href={`/trips/${trip.id}/more/trip`}
          aria-label={`הגדרות הטיול ${trip.name}`}
          className="relative z-10 flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}
      {/* Into the trip — the one control on the row that navigates. */}
      <Link
        href={`/trips/${trip.id}`}
        aria-label={`כניסה לטיול ${trip.name}`}
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary transition-[background-color,transform] hover:bg-primary-tint active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
    </article>
  );
}

// ---- 4 · the idea card ------------------------------------------------------

const IDEA_QUESTION = "לאן כדאי לטוס בחודש הבא?";

function IdeaCard({ tripId }: { tripId: string }) {
  return (
    <section className="relative flex items-center gap-3 rounded-[20px] border border-border p-4">
      <Sparkles className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The question is written into the chat, not sent — asking the model
            stays the traveller's press (see TripChat's initialDraft). */}
        <Link
          href={`${tripTabHref(tripId, "ai")}?q=${encodeURIComponent(IDEA_QUESTION)}`}
          className="text-base font-bold text-foreground after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          צריכים רעיון ליעד הבא?
        </Link>
        <span className="text-[13px] text-muted">שאלו את העוזר, או הגרילו יעד</span>
      </div>
      <Link
        href={tripTabHref(tripId, "discover")}
        aria-label="הגרלת יעד — גילוי מקומות"
        className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Dices className="h-5 w-5" aria-hidden="true" />
      </Link>
    </section>
  );
}
