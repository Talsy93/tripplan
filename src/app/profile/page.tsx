import type { ReactNode } from "react";
import { Bell, Bot, CalendarDays, Compass, Luggage, Sun } from "lucide-react";
import {
  BottomNav,
  BrandHeader,
  HeaderDialogButton,
} from "@/components/layout";
import type { NavItem } from "@/components/layout";
import { getCurrentUser, LogoutButton } from "@/features/auth";
import {
  APP_TIME_ZONE,
  cityByDay,
  describeWeather,
  dominantCountry,
  gearProgress,
  getCachedStopsByTrip,
  getItinerary,
  getItineraryDayCountByTrip,
  getSelectedCitiesByTrip,
  getSelectedPlaceCountByTrip,
  HomeScreen,
  listGear,
  listMembers,
  listTrips,
  memberLabel,
  orderTripsByProximity,
  pickFeaturedTrip,
  PushToggle,
  todayIn,
  tripDayCount,
  tripTabHref,
} from "@/features/trips";
import type {
  FeaturedDetails,
  HomeTrip,
  MappedTrip,
  PinStanding,
  StandingTrip,
} from "@/features/trips";
import { getDailyForecast } from "@/lib/weather";

export const metadata = { title: "הטיולים שלי · MyTrip" };

// "הטיולים שלי", from the Pencil home (design/pencil/exports/home-mobile and
// home-desktop, phase PN): greeting, the featured trip on the teal card, one
// "new trip", every trip under a filter with the map, the idea card, and the
// five-tab footer. On a phone the design has no app bar — the bell and the
// avatar sit in the greeting row — so the top bar starts at md and the same
// two controls are handed to HomeScreen for that row.
//
// Everything is read here, on the server; HomeScreen is a client shell only
// for the map's filter and selection.
export default async function ProfilePage() {
  const [user, trips, dayCounts, pointsByTrip, citiesByTrip, placeCounts] =
    await Promise.all([
      getCurrentUser(),
      listTrips(),
      getItineraryDayCountByTrip(),
      getCachedStopsByTrip(),
      getSelectedCitiesByTrip(),
      getSelectedPlaceCountByTrip(),
    ]);

  const now = new Date();
  const today = todayIn(APP_TIME_ZONE, now);
  const ordered = orderTripsByProximity(trips, today, dayCounts);
  const featured = pickFeaturedTrip(ordered);

  const homeTrips: HomeTrip[] = ordered.map((entry) => {
    const id = entry.trip.id;
    const points = pointsByTrip.get(id) ?? [];
    const code =
      dominantCountry(points) ??
      points.find((point) => point.countryCode)?.countryCode ??
      null;
    return {
      entry,
      countryCode: code,
      // The saved cities are in the order they were chosen; the located points
      // are in no order at all.
      city: citiesByTrip.get(id)?.[0] ?? points[0]?.city ?? null,
      cities: citiesByTrip.get(id) ?? [],
      dayCount: dayCounts.get(id) ?? 0,
      placeCount: placeCounts.get(id) ?? 0,
    };
  });

  const details = featured
    ? await featuredDetails(featured, homeTrips, pointsByTrip, today)
    : null;

  const mapped: MappedTrip[] = homeTrips.flatMap((home, index) => {
    const { trip, phase } = home.entry;
    const points = pointsByTrip.get(trip.id) ?? [];
    if (points.length === 0) return [];
    const standing = STANDING[phase.kind];
    const hue =
      standing === "live"
        ? "var(--cta-bright)"
        : standing === "next"
          ? "var(--primary)"
          : "var(--border-strong)";
    return [
      {
        id: trip.id,
        name: trip.name,
        hue,
        activeHue: standing === "live" ? hue : "var(--primary)",
        position: index + 1,
        points,
        countryCode: home.countryCode,
        standing,
      },
    ];
  });

  const destinationCount = new Set(
    homeTrips.flatMap((home) => [
      ...(citiesByTrip.get(home.entry.trip.id) ?? []),
      ...(pointsByTrip.get(home.entry.trip.id) ?? []).map((p) => p.city),
    ]),
  ).size;

  // The first name to greet, from the account — Google gives a full name, an
  // email sign-up gives none, and then the greeting goes without one.
  const meta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
  const firstName =
    (meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0] || null;
  const avatar = meta.avatar_url ?? meta.picture ?? null;
  const initial = (firstName ?? user?.email ?? "?")[0]?.toUpperCase();

  // The footer's four trip tabs open the featured trip, or the nearest one.
  const target = featured ?? ordered[0] ?? null;
  const live = target?.phase.kind === "during";
  const tab = (
    segment: "today" | "days" | "discover" | "ai",
    label: string,
    icon: ReactNode,
  ): NavItem => ({
    href: target ? tripTabHref(target.trip.id, segment) : `/profile#${segment}`,
    label,
    icon,
    waiting: !target
      ? "נפתח אחרי שיוצרים טיול"
      : segment === "today" && !live
        ? "נפתח כשהטיול מתחיל"
        : undefined,
  });
  const icon = "h-[22px] w-[22px]";
  const nav: NavItem[] = [
    {
      href: "/profile",
      label: "הטיולים שלי",
      icon: <Luggage className={icon} />,
      active: true,
    },
    tab("today", "היום", <Sun className={icon} />),
    tab("days", "מסלול", <CalendarDays className={icon} />),
    tab("discover", "גילוי", <Compass className={icon} />),
    tab("ai", "עוזר AI", <Bot className={icon} />),
  ];

  // Round 44px discs, as the export draws them: a white bell with a hairline,
  // and the avatar in teal.
  const bell = (
    <HeaderDialogButton
      label="התראות"
      title="התראות"
      className="h-11 w-11 border border-border bg-surface text-foreground hover:text-primary"
      trigger={<Bell className="h-5 w-5" aria-hidden="true" />}
    >
      <PushToggle />
    </HeaderDialogButton>
  );
  const account = (
    <HeaderDialogButton
      label="החשבון שלי"
      title="החשבון שלי"
      trigger={
        avatar ? (
          // The provider's own avatar, on a host next/image does not know.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
            {initial}
          </span>
        )
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-muted-strong" dir="ltr">
          {user?.email}
        </span>
        <LogoutButton />
      </div>
    </HeaderDialogButton>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* `contents` from md, so the sticky bar sticks against the page rather
          than against a wrapper exactly its own height. */}
      <div className="hidden md:contents">
        <BrandHeader
          subtitle="My Trips"
          trailing={
            <>
              {bell}
              {account}
            </>
          }
        />
      </div>

      <HomeScreen
        firstName={firstName}
        trips={homeTrips}
        featuredId={featured?.trip.id ?? null}
        details={details}
        mapped={mapped}
        destinationCount={destinationCount}
        now={now.toISOString()}
        bell={bell}
        account={account}
      />

      <BottomNav items={nav} accent="cta" />
    </div>
  );
}

const STANDING: Record<StandingTrip["phase"]["kind"], PinStanding> = {
  during: "live",
  before: "next",
  undated: "draft",
  after: "past",
};

async function featuredDetails(
  featured: StandingTrip,
  homeTrips: HomeTrip[],
  pointsByTrip: Awaited<ReturnType<typeof getCachedStopsByTrip>>,
  today: string,
): Promise<FeaturedDetails> {
  const { trip, phase } = featured;
  const [itinerary, members, gear] = await Promise.all([
    getItinerary(trip.id),
    listMembers(trip.id),
    listGear(trip.id),
  ]);

  const scheduledCount = itinerary.reduce((sum, day) => sum + day.items.length, 0);

  const initials = [...members]
    .sort((a, b) => Number(b.is_owner) - Number(a.is_owner))
    .map((member) => memberLabel(member).trim()[0] ?? "?");

  // While the trip is on: how much of it has been lived. Before it: how much
  // is packed, when there is a list to pack.
  const length = Math.max(
    tripDayCount(trip.start_date, trip.end_date) ?? 0,
    itinerary.length,
  );
  const packed = gearProgress(gear);
  const progress =
    phase.kind === "during" && length > 0
      ? {
          percent: Math.min(100, Math.round((phase.dayNumber / length) * 100)),
          label: "התקדמות בטיול",
        }
      : packed.total > 0
        ? { percent: packed.percent, label: "מוכנות לטיול" }
        : null;

  // Today's weather where the trip is — the city of today's schedule while it
  // runs, the first city before it.
  const points = pointsByTrip.get(trip.id) ?? [];
  const home = homeTrips.find((entry) => entry.entry.trip.id === trip.id);
  const city =
    (phase.kind === "during" ? cityByDay(itinerary).get(phase.dayNumber) : null) ??
    home?.city ??
    points[0]?.city ??
    null;
  const point = points.find((p) => p.city === city) ?? points[0];
  let weather: FeaturedDetails["weather"] = null;
  if (point) {
    const forecast = await getDailyForecast({
      latitude: point.latitude,
      longitude: point.longitude,
      startDate: today,
      endDate: today,
    });
    const day = forecast?.[0];
    if (day) {
      weather = {
        city: point.city,
        tempC: day.maxC,
        icon: describeWeather(day.code).icon,
      };
    }
  }

  return { scheduledCount, members: initials, progress, weather };
}
