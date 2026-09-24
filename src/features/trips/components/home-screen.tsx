"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Bot,
  BrainCircuit,
  Calendar,
  CalendarCog,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Compass,
  Dices,
  EllipsisVertical,
  Globe,
  Heart,
  Map as MapIcon,
  MapPin,
  MapPinPlus,
  MessageSquareText,
  PlaneTakeoff,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AppIntro } from "./app-intro";
import { CountryFlag } from "./country-flag";
import { NewTripButton } from "./create-trip-form";
import { DomainIcon } from "./domain-icon";
import { HomeMap } from "./home-map";
import { PlacePhoto } from "./place-photo";
import type { MappedTrip } from "./trips-map-canvas";
import {
  agoLabel,
  dateRangeLabel,
  monthYearLabel,
  shortMonthYearLabel,
} from "../domain/date-labels";
import type { DomainIconName } from "../domain/icons";
import type { StandingTrip } from "../domain/trip-order";
import { tripTabHref } from "../domain/trip-tabs";

// The home screen, block for block from design/stitch/…/home (2026-09-24):
// a greeting with the terracotta "new trip" banner, the trip being lived (or
// the next one) as a photo card with its vitals, the map of every trip with a
// filter and a card for the pin in focus, the other trips as cards by kind —
// upcoming, an idea, a trip already taken — and the concierge card.
//
// Client for one reason: the map and its preview card share a selection and a
// filter. Everything else is fetched on the server and handed down.

// One trip, as the cards and the map need it.
export type HomeTrip = {
  entry: StandingTrip;
  // The ISO code of the trip's country, for its flag; null when no city has a
  // country yet.
  countryCode: string | null;
  // The city the photo is of — the first one on the route.
  city: string | null;
  dayCount: number;
  // Saved places ("8 מקומות ברשימה").
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
}: {
  firstName: string | null;
  // Every trip, nearest first.
  trips: HomeTrip[];
  featuredId: string | null;
  details: FeaturedDetails | null;
  mapped: MappedTrip[];
  // Distinct cities across every trip — the "4 יעדים" badge.
  destinationCount: number;
  // The server's clock, so "נוצר לפני יומיים" reads the same on both sides.
  now: string;
}) {
  const featured = trips.find((trip) => trip.entry.trip.id === featuredId) ?? null;
  const others = trips.filter((trip) => trip.entry.trip.id !== featuredId);
  // The trip the AI card and the footer tabs open: the featured one, or else
  // the nearest there is.
  const target = featured ?? trips[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-[66rem] flex-1 flex-col gap-6 px-4 pb-28 pt-4 md:px-6 md:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-8 lg:px-8 lg:pt-8">
      <div className="order-1 flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
        <Greeting firstName={firstName} destinationCount={destinationCount} />
        {featured && details && <FeaturedCard trip={featured} details={details} />}
        {trips.length === 0 && <AppIntro />}
      </div>

      {/* One column on a phone, in the export's order — the map comes between
          the featured trip and the list. From lg the map and the concierge
          stand beside the list, so this wrapper is `contents` below it and
          lets its two children take their own places in the column. */}
      {trips.length > 0 && (
        <div className="contents lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
          <MapSection trips={trips} mapped={mapped} featuredId={featuredId} />
          {target && (
            <div className="order-4 lg:order-none">
              <ConciergeCard tripId={target.entry.trip.id} />
            </div>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <TripCards trips={others} now={now} />
        </div>
      )}
    </main>
  );
}

// ---- 1 · greeting and the new-trip banner ----------------------------------

function Greeting({
  firstName,
  destinationCount,
}: {
  firstName: string | null;
  destinationCount: number;
}) {
  return (
    <section className="flex flex-col gap-4 pt-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-0.5 text-[12px] font-medium leading-4 tracking-[0.01em] text-cta-strong">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span>הרפתקה חדשה ממתינה</span>
          </div>
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-foreground">
            {firstName ? `שלום, ${firstName}!` : "שלום!"}{" "}
            <span className="inline-block animate-pulse" aria-hidden="true">
              ✈️
            </span>
          </h1>
          <p className="text-sm leading-5 text-muted-strong">
            לאן נטייל ונצבור חוויות הפעם?
          </p>
        </div>
        {destinationCount > 0 && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-high px-2 py-1 text-primary shadow-sm">
            <BadgeCheck className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="text-[12px] font-semibold leading-4 text-foreground">
              {destinationCount === 1 ? "יעד אחד" : `${destinationCount} יעדים`}
            </span>
          </div>
        )}
      </div>

      <NewTripButton className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-cta-bright p-4 text-white shadow-[0_8px_20px_-4px_rgba(253,101,30,0.35)] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <span className="z-10 flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 shadow-inner backdrop-blur-md">
            <MapPinPlus className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="flex flex-col text-right">
            <span className="text-[18px] font-bold leading-tight">תכנון טיול חדש</span>
            <span className="text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-white/85">
              בניית מסלול אישי עם בינה מלאכותית
            </span>
          </span>
        </span>
        <span className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/25">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-cta-tint/30 blur-2xl"
        />
      </NewTripButton>
    </section>
  );
}

// ---- 2 · the featured trip ------------------------------------------------

function FeaturedCard({
  trip: home,
  details,
}: {
  trip: HomeTrip;
  details: FeaturedDetails;
}) {
  const { trip, phase } = home.entry;
  const during = phase.kind === "during";
  const href = `/trips/${trip.id}`;

  const pill = during
    ? home.dayCount > 0
      ? `מתקיים כרגע • יום ${phase.dayNumber} מתוך ${home.dayCount}`
      : `מתקיים כרגע • יום ${phase.dayNumber}`
    : phase.kind === "before"
      ? phase.daysUntilStart === 1
        ? "יוצאים מחר"
        : `יוצאים בעוד ${phase.daysUntilStart} ימים`
      : "בתכנון";

  const members = details.members.length;

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-0.5">
          <PlaneTakeoff className="h-5 w-5 text-cta-strong" aria-hidden="true" />
          <h2 className="text-[18px] font-bold leading-6 text-foreground">
            {during ? "הטיול הפעיל שלך" : "הטיול הקרוב שלך"}
          </h2>
        </div>
        <span className="rounded-full bg-primary-tint/60 px-1 py-0.5 text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-primary">
          {during ? "בשידור חי" : "הבא בתור"}
        </span>
      </div>

      <div className="relative flex w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_12px_32px_-6px_rgba(2,132,199,0.15)]">
        <Link
          href={href}
          className="relative block h-52 w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          <PlacePhoto
            query={home.city ?? ""}
            className="absolute inset-0 h-full w-full"
            fallback={
              <span className="absolute inset-0 bg-[image:var(--hero-gradient)]" />
            }
          />
          <span className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />

          <span className="absolute right-4 top-4 flex items-center gap-0.5 rounded-full bg-surface/90 px-2 py-1 shadow-md backdrop-blur-md">
            {during ? (
              <>
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-success-strong" />
                <span className="-mr-3.5 h-2 w-2 rounded-full bg-success-strong" />
              </>
            ) : (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
            <span className="text-[10px] font-bold leading-[14px] tracking-[0.02em] text-foreground">
              {pill}
            </span>
          </span>

          {details.weather && (
            <span className="absolute left-4 top-4 flex items-center gap-0.5 rounded-full bg-foreground/40 px-2 py-1 text-white backdrop-blur-md">
              <span className="text-cta-tint">
                <DomainIcon name={details.weather.icon} className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-medium leading-[14px] tracking-[0.02em]">
                {details.weather.city} {Math.round(details.weather.tempC)}°C
              </span>
            </span>
          )}

          <span className="absolute bottom-4 left-4 right-4 text-right text-white">
            <span className="mb-0.5 flex items-center gap-1">
              <span className="rounded-md bg-cta-strong px-1 py-0.5 text-[10px] font-medium leading-[14px] tracking-[0.02em] text-white">
                יעד מרכזי
              </span>
              <span className="text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-surface-variant/90">
                {dateRangeLabel(trip.start_date, trip.end_date)}
              </span>
            </span>
            <span className="block text-[24px] font-bold leading-tight drop-shadow-sm wrap-anywhere">
              {trip.name}
              {" "}
              <CountryFlag code={home.countryCode} />
            </span>
          </span>
        </Link>

        <div className="flex flex-col gap-4 bg-surface p-4">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-2 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-0.5 flex -space-x-1.5 space-x-reverse">
                {details.members.slice(0, 3).map((initial, index) => (
                  <span
                    key={index}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      MEMBER_FILLS[index % MEMBER_FILLS.length],
                    )}
                  >
                    {initial}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-medium leading-[14px] tracking-[0.02em] text-muted-strong">
                {members <= 1 ? "טיול סולו" : `${members} שותפים`}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-0.5 font-bold text-primary">
                <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="text-[12px] leading-4">{details.scheduledCount}</span>
              </div>
              <span className="text-[10px] font-medium leading-[14px] tracking-[0.02em] text-muted-strong">
                מקומות בלו״ז
              </span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-0.5 font-bold text-success-strong">
                <CircleCheck className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="text-[12px] leading-4">
                  {details.progress ? `${details.progress.percent}%` : home.dayCount}
                </span>
              </div>
              <span className="text-[10px] font-medium leading-[14px] tracking-[0.02em] text-muted-strong">
                {details.progress?.label ?? "ימים בלו״ז"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={href}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold leading-5 text-white shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>כניסה לטיול והמשך חקירה</span>
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <Link
              // "היום" exists only while the trip is on; before it, the
              // schedule is the calendar.
              href={tripTabHref(trip.id, during ? "today" : "days")}
              aria-label={during ? "היום בטיול" : "הלו״ז של הטיול"}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunken text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Calendar className="h-[22px] w-[22px]" aria-hidden="true" />
            </Link>
            <Link
              href={`/trips/${trip.id}/map`}
              aria-label="מסלול ומפה"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunken text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapIcon className="h-[22px] w-[22px]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// The three avatar fills of the export: primary-container, secondary-container,
// tertiary-container.
const MEMBER_FILLS = ["bg-primary-bright", "bg-cta-bright", "bg-success"];

// ---- 3 · the map of every trip ---------------------------------------------

function inFilter(entry: StandingTrip, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "past") return entry.phase.kind === "after";
  return entry.phase.kind === "during" || entry.phase.kind === "before";
}

function MapSection({
  trips,
  mapped,
  featuredId,
}: {
  trips: HomeTrip[];
  mapped: MappedTrip[];
  featuredId: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // "עולם אישי": every trip in view, until a pin or a filter asks otherwise.
  const [world, setWorld] = useState(false);
  const select = (id: string | null) => {
    setSelectedId(id);
    setWorld(false);
  };

  const counts = {
    all: trips.length,
    active: trips.filter((trip) => inFilter(trip.entry, "active")).length,
    past: trips.filter((trip) => inFilter(trip.entry, "past")).length,
  };

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

  // The card under the map always names a trip, as in the export: the one
  // pressed, or else the featured one, or else the first the filter keeps.
  const selected = selectedId && shownIds.has(selectedId) ? selectedId : null;
  const focus =
    shown.find((trip) => trip.entry.trip.id === selected) ??
    shown.find((trip) => trip.entry.trip.id === featuredId) ??
    shown[0] ??
    null;

  // Escape is the desktop way back to the whole world.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: `הכל (${counts.all})` },
    { key: "active", label: `פעילים וקרובים (${counts.active})` },
    { key: "past", label: `טיולי עבר (${counts.past})` },
  ];

  return (
    <section aria-label="מפת הטיולים" className="order-2 flex min-w-0 flex-col gap-2 lg:order-none">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <h2 className="text-[18px] font-bold leading-6 text-foreground">
            מפת המסעות והיעדים שלי
          </h2>
          <span className="text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-muted-strong">
            הסיכות האישיות ברחבי הגלובוס
          </span>
        </div>
        {/* Back to the whole world — the map is still, so there is no
            zooming out by hand. */}
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setWorld(true);
          }}
          className="flex items-center gap-0.5 rounded-full text-[12px] font-medium leading-4 tracking-[0.01em] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span>עולם אישי</span>
        </button>
      </div>

      <div
        role="group"
        aria-label="סינון הטיולים במפה"
        className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]"
      >
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={filter === chip.key}
            onClick={() => {
              setFilter(chip.key);
              select(null);
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1 text-[12px] font-medium leading-4 tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === chip.key
                ? "bg-primary text-white shadow-sm"
                : "bg-surface-high text-muted-strong",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="relative h-64 w-full overflow-hidden rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,97,148,0.12)] lg:h-80 [&_.leaflet-bottom]:bottom-auto [&_.leaflet-bottom]:top-0">
        <HomeMap
          trips={pins}
          selectedId={selected}
          focusId={world ? null : (focus?.entry.trip.id ?? null)}
          onSelect={select}
          insetBottomShare={focus ? 0.32 : 0}
        />

        {focus && (
          <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between gap-2 rounded-2xl bg-surface/95 p-2 shadow-lg backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-[18px] font-bold leading-6 text-foreground">
                    {focus.entry.trip.name}
                  </span>
                  <PreviewBadge trip={focus} />
                </div>
                <span className="truncate text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-muted-strong">
                  {previewMeta(focus)}
                </span>
              </div>
            </div>
            <Link
              href={`/trips/${focus.entry.trip.id}`}
              className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl bg-primary px-4 text-[12px] font-semibold leading-4 text-white shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>חקור יעד</span>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function PreviewBadge({ trip }: { trip: HomeTrip }) {
  const { phase } = trip.entry;
  const [label, tone] =
    phase.kind === "during"
      ? ["פעיל עכשיו", "bg-cta-strong/15 text-cta-strong"]
      : phase.kind === "before"
        ? [`בעוד ${phase.daysUntilStart} ימים`, "bg-primary-tint text-primary"]
        : phase.kind === "undated"
          ? ["רעיון בטיוטה", "bg-surface-variant text-muted-strong"]
          : [
              `טיול עבר (${shortMonthYearLabel(trip.entry.trip.start_date)})`,
              "bg-border-strong/30 text-muted-strong",
            ];
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1 py-px text-[10px] font-semibold leading-[14px] tracking-[0.02em]",
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
  switch (phase.kind) {
    case "during":
      return trip.dayCount > 0
        ? `${days} • יום ${phase.dayNumber} מתוך ${trip.dayCount} • ${trip.placeCount} אתרים מתוכננים`
        : `יום ${phase.dayNumber} • ${trip.placeCount} אתרים מתוכננים`;
    case "before":
      return `${days} • ${trip.placeCount} מקומות ברשימת המשאלות`;
    case "undated":
      return `${days} • תכנון עם AI מוכן להפעלה`;
    case "after":
      return `הסתיים • ${days}`;
  }
}

// ---- 4 · the other trips ---------------------------------------------------

// Past four cards the list folds, and "כל הטיולים" opens the rest.
const FOLD = 4;

function TripCards({ trips, now }: { trips: HomeTrip[]; now: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? trips : trips.slice(0, FOLD);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-[18px] font-bold leading-6 text-foreground">
            הטיולים הבאים והשמורים
          </h2>
          <p className="text-[12px] leading-[18px] text-muted-strong">
            בחרו טיול לתכנון, שיתוף או צפייה בזיכרונות
          </p>
        </div>
        {trips.length > FOLD && (
          <button
            type="button"
            onClick={() => setAll((value) => !value)}
            aria-expanded={all}
            className="flex shrink-0 items-center gap-0.5 rounded-full text-[12px] font-semibold leading-4 tracking-[0.01em] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{all ? "פחות טיולים" : "כל הטיולים"}</span>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {shown.map((trip) =>
        trip.entry.phase.kind === "after" ? (
          <PastRow key={trip.entry.trip.id} trip={trip} />
        ) : trip.entry.phase.kind === "undated" ? (
          <DraftCard key={trip.entry.trip.id} trip={trip} now={now} />
        ) : (
          <UpcomingCard key={trip.entry.trip.id} trip={trip} />
        ),
      )}
    </section>
  );
}

const CARD =
  "flex w-full flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[0_4px_16px_-2px_rgba(2,132,199,0.06)] transition-transform active:scale-[0.99]";

function Thumb({ trip }: { trip: HomeTrip }) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
      <PlacePhoto
        query={trip.city ?? ""}
        className="h-full w-full"
        fallback={<MapPin className="h-7 w-7" aria-hidden="true" />}
      />
      <CountryFlag
        code={trip.countryCode}
        className="absolute bottom-1 right-1 h-2.5"
      />
    </div>
  );
}

function UpcomingCard({ trip: home }: { trip: HomeTrip }) {
  const { trip, phase } = home.entry;
  const href = `/trips/${trip.id}`;
  const badge =
    phase.kind === "before"
      ? phase.daysUntilStart === 1
        ? "מחר"
        : `בעוד ${phase.daysUntilStart} ימים`
      : phase.kind === "during"
        ? `יום ${phase.dayNumber} בטיול`
        : "";

  return (
    <article className={CARD}>
      <Link
        href={href}
        className="flex items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Thumb trip={home} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="rounded-full bg-primary-tint px-1 py-0.5 text-[10px] font-bold leading-[14px] tracking-[0.02em] text-primary-deep">
              {badge}
            </span>
            <Bookmark className="h-5 w-5 text-border-strong" aria-hidden="true" />
          </div>
          <h3 className="truncate text-[18px] font-bold leading-6 text-foreground">
            {trip.name}
          </h3>
          <span className="text-[12px] leading-[18px] text-muted-strong">
            {dateRangeLabel(trip.start_date, trip.end_date)}
          </span>
          <div className="mt-0.5 flex items-center gap-1 text-muted-strong">
            <Heart className="h-4 w-4 shrink-0 text-cta-strong" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-[14px] tracking-[0.02em]">
              {home.placeCount === 1
                ? "מקום אחד ברשימת החלומות"
                : `${home.placeCount} מקומות ברשימת החלומות`}{" "}
              <bdi dir="ltr" className="whitespace-nowrap">(Bucket List)</bdi>
            </span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-muted-strong">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>
            {home.dayCount > 0 ? `${home.dayCount} ימים בלו״ז` : "עוד אין לו״ז"}
          </span>
        </div>
        <Link
          href={href}
          className="flex items-center gap-0.5 rounded-xl bg-surface-high px-4 py-1 text-[12px] font-semibold leading-4 text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>חקור טיול זה</span>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function DraftCard({ trip: home, now }: { trip: HomeTrip; now: string }) {
  const { trip } = home.entry;
  const href = `/trips/${trip.id}`;

  return (
    <article className={CARD}>
      <div className="flex items-center gap-4">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="shrink-0 rounded-xl"
        >
          <Thumb trip={home} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="rounded-full bg-surface-variant px-1 py-0.5 text-[10px] font-medium leading-[14px] tracking-[0.02em] text-muted-strong">
              רעיון בטיוטה 💡
            </span>
            <Link
              href={`/trips/${trip.id}/more/trip`}
              aria-label={`הגדרות הטיול ${trip.name}`}
              className="rounded-full text-border-strong hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
          <Link
            href={href}
            className="truncate rounded text-[18px] font-bold leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {trip.name}
          </Link>
          <span className="text-[12px] leading-[18px] text-muted-strong">
            בלי תאריכים •{" "}
            {home.dayCount > 0 ? `${home.dayCount} ימים מתוכננים` : "עוד אין לו״ז"}
          </span>
          <div className="mt-0.5 flex items-center gap-1 text-success-strong">
            <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate text-[10px] font-medium leading-[14px] tracking-[0.02em]">
              עוזר ה-AI ממתין לתאריכים סופיים
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-semibold leading-[14px] tracking-[0.02em] text-muted-strong">
          נוצר {agoLabel(trip.created_at, new Date(now))}
        </span>
        <Link
          href={href}
          className="flex items-center gap-0.5 rounded-xl bg-cta-tint px-4 py-1 text-[12px] font-semibold leading-4 text-cta-deep transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>המשך תכנון</span>
          <CalendarCog className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function PastRow({ trip: home }: { trip: HomeTrip }) {
  const { trip } = home.entry;
  const facts = [
    monthYearLabel(trip.start_date),
    home.dayCount > 0 ? `${home.dayCount} ימים בלו״ז` : null,
    home.placeCount > 0 ? `${home.placeCount} מקומות` : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-surface-2/70 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-muted-strong">
          <ScrollText className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <h4 className="truncate text-base font-bold leading-[22px] text-foreground">
            {trip.name}
            {" "}
            <CountryFlag code={home.countryCode} />
          </h4>
          <span className="truncate text-[12px] leading-[18px] text-muted-strong">
            {facts.join(" • ")}
          </span>
        </div>
      </div>
      <span className="shrink-0 rounded-xl bg-surface p-1 text-primary shadow-sm">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </span>
    </Link>
  );
}

// ---- 5 · the concierge ------------------------------------------------------

const CONCIERGE_QUESTION = "לאן כדאי לטוס בחודש הבא?";

function ConciergeCard({ tripId }: { tripId: string }) {
  return (
    <section className="relative flex w-full flex-col gap-2 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-tint to-surface-variant p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
            <BrainCircuit className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold leading-[14px] tracking-[0.02em] text-primary">
              MyTrip Concierge AI
            </span>
            <h3 className="text-[18px] font-bold leading-6 text-foreground">
              צריכים רעיון ליעד הבא?
            </h3>
          </div>
        </div>
        <Sparkles className="h-8 w-8 text-primary/40" aria-hidden="true" />
      </div>
      <p className="text-sm leading-relaxed text-muted-strong">
        ספרו לנו מה הסגנון שלכם (חופשת בטן-גב, טרקים הרריים, או קולינריה
        עירונית) וה-AI ייצר עבורכם הצעת מסלול מקיפה תוך 10 שניות.
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        {/* The question is written into the chat, not sent — asking the model
            stays the traveller's press (see TripChat's initialDraft). */}
        <Link
          href={`${tripTabHref(tripId, "ai")}?q=${encodeURIComponent(CONCIERGE_QUESTION)}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold leading-4 text-white shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MessageSquareText className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">שאלו: ״{CONCIERGE_QUESTION}״</span>
        </Link>
        <Link
          href={tripTabHref(tripId, "discover")}
          aria-label="רולטת יעדים — גילוי מקומות"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface/80 text-muted-strong transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Dices className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
