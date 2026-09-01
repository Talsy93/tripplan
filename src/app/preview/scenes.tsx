// The scene registry for the preview harness. Development only.
//
// A **server** module, deliberately. It was briefly "use client" so scenes could
// pass event handlers, and that broke the whole harness: a client module cannot
// import the feature barrel, because the barrel also re-exports infrastructure
// that reaches next/headers. No scene actually needs a handler, so the simpler
// shape is also the correct one — and it keeps the harness importing the feature
// only through its index, which is iron rule 1.
//
// Each scene is one component in one state. Splitting by *state* rather than by
// component is the point: the states that break layouts are the ones that are
// hard to reach in a real account — an empty trip, twenty bookings, a city the
// geocoder could not place, a name with no break opportunity in it. Reaching
// them through the UI means creating that data by hand every time.

import type { ReactNode } from "react";
import {
  AURA_PALETTES,
  assignTripAuras,
  AuraHero,
  AuraPanel,
  tripHueStyle,
  BookingForm,
  BookingList,
  CityDaysEditor,
  CreateTripForm,
  daysUntil,
  DayPager,
  DayTimeline,
  DayMapCard,
  DayWeatherCard,
  ExploreScreen,
  ExpenseSummary,
  GearList,
  HomeRail,
  InviteForm,
  Itinerary,
  CityGuideList,
  MemberList,
  MoreMenu,
  NewTripButton,
  NightStay,
  Phrasebook,
  RouteMap,
  SelectedList,
  ShareButton,
  StartHere,
  ShareTrip,
  TripDatesForm,
  TripAuraBand,
  TripList,
  tripAura,
  UnlocatedCities,
  NowCard,
  OpenItems,
  RailTripProgress,
  RailTripSwitcher,
  TodayBefore,
  TodayDuringAside,
  tripOpenItems,
  UpNext,
  WeatherForecast,
  WorkflowGuide,
  WorkflowSummary,
} from "@/features/trips";
import type { TripPhase } from "@/features/trips";
import {
  AuraField,
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeading,
  Skeleton,
} from "@/components/ui";
import {
  AppHeader,
  AppShell,
  BottomNav,
  SideNav,
  TwoPane,
} from "@/components/layout";
import {
  CalendarDays,
  Compass,
  Luggage,
  Map as MapIcon,
  Menu,
  Sun,
} from "lucide-react";
import * as f from "./fixtures";

export type Scene = {
  slug: string;
  title: string;
  // What this state is for — shown in the index so a scene is not just a name.
  note: string;
  // Renders outside the harness's padded column, against the window itself.
  // For the one scene that *is* the frame: a rail that has to touch the edge
  // of the window cannot be checked inside a box with 16px of padding, and the
  // 230px of white this task exists to remove was invisible to every scene
  // here precisely because no scene rendered the shell.
  bleed?: boolean;
  render: () => ReactNode;
};

// The five tabs, drawn for the frame scene below. Static hrefs: nothing here
// navigates, and the harness has no router state to be current in.
const FRAME_NAV = [
  {
    href: "#today",
    label: "היום",
    icon: <Sun className="h-5 w-5" />,
    active: true,
  },
  { href: "#days", label: "ימים", icon: <CalendarDays className="h-5 w-5" /> },
  {
    href: "#explore",
    label: "מה עושים?",
    icon: <Compass className="h-5 w-5" />,
  },
  { href: "#map", label: "מפה", icon: <MapIcon className="h-5 w-5" /> },
  { href: "#more", label: "עוד", icon: <Menu className="h-5 w-5" /> },
];

const FRAME_CITIES = ["טוקיו", "קיוטו", "אוסקה", "נארה"];

// Computed by the real domain function rather than written out as rows, so a
// scene cannot go on looking right after the ordering changes underneath it.
// Four cities, lodging booked in one of them, an itinerary two days long
// against a fourteen-day trip with one of those two empty.
//
// The days-to-departure is derived from the date with the same `daysUntil` the
// band and the rail use, not typed in beside it. Written in, the scene said 62
// while the band above it said 72 — the harness has absolute dates and a real
// clock, so any number spelled out twice will disagree with itself eventually.
const FAR_OPEN = tripOpenItems({
  startDate: f.FAR_START,
  daysUntilStart: daysUntil(f.FAR_START),
  dayCount: 14,
  cities: FRAME_CITIES,
  itinerary: f.ITINERARY,
  bookings: f.BOOKINGS,
});

// The whole shell around a tab's content, so that more than one scene can be a
// real screen rather than a component floating in a padded column.
//
// A function and not a second copy of the JSX: the frame is the thing T0 fixed,
// and two scenes drawing their own version of it is how the harness would come
// to disagree with itself about what the frame is.
function appFrame({
  title,
  badge,
  active,
  phase,
  startDate,
  // The route. Not defaulted to the four Japanese cities: a scene for a trip
  // with no destinations was drawing chips for four of them in the band above
  // the row that said it had none.
  cities,
  // The band, which the map tab does not have: TripBandSlot hides it there, and
  // that is the reason the map can start at the app bar at all.
  showBanner = true,
  children,
}: {
  title: string;
  badge?: ReactNode;
  active: string;
  phase: TripPhase;
  startDate: string | null;
  cities: string[];
  showBanner?: boolean;
  children: ReactNode;
}) {
  const items = FRAME_NAV.map((item) => ({
    ...item,
    active: item.href === `#${active}`,
  }));

  return (
    <AppShell
      header={
        <AppHeader
          title={title}
          badge={badge}
          trailing={<ShareButton tripId={f.TRIP_ID} memberCount={2} isShared />}
        />
      }
      sidebar={
        <SideNav
          items={items}
          hues={tripAura(cities)}
          initial="ט"
          header={<RailTripSwitcher name={title} phase={phase} />}
          footer={
            <RailTripProgress
              phase={phase}
              dayCount={14}
              startDate={startDate}
            />
          }
        />
      }
      // All three presentations at once, the way TripNav renders them: the
      // floating bar below md, the pill row between md and lg, the rail from
      // lg. Only one is ever visible, and the shell's bottom padding is sized
      // for the first — so it has to be here or that padding is untested at
      // 375.
      nav={
        <>
          <div className="mt-4 hidden gap-1 self-start rounded-full border border-border bg-surface-2 p-1 md:flex lg:hidden">
            {items.map((item) => (
              <span
                key={item.href}
                className={
                  item.active
                    ? "flex items-center gap-2 rounded-full bg-surface px-4 py-1.5 text-sm font-semibold shadow-soft"
                    : "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-muted"
                }
              >
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
          <BottomNav items={items} />
        </>
      }
      banner={
        showBanner ? (
          <TripAuraBand
            name={title}
            startDate={startDate}
            phase={phase}
            dayCount={14}
            cities={cities}
            hues={tripAura(cities)}
          />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}

export const SCENES: Scene[] = [
  // ---- the frame itself ----------------------------------------------------
  //
  // Every other scene here is a component measured on its own. This one is the
  // shell those components live in, and it exists because the shell was the
  // thing that was actually broken: at 1911px the rail sat 230px in from the
  // right edge with white on both sides of the app, and no scene could show
  // that because no scene rendered a rail and a content column together.
  //
  // Check it at 1920 first, then 1440, 1280, 768 and 375.
  {
    slug: "app-frame",
    title: "המסגרת · רַיל, כותרת, שתי חלוניות",
    note: "ב-1920 הרַיל חייב לגעת בקצה החלון והתוכן להיות ממורכז במה שנשאר; ב-768 הרַיל יורד ושורת הגלולות עולה",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "today",
        phase: { kind: "during", dayNumber: 3 },
        startDate: "2026-09-09",
        cities: FRAME_CITIES,
        badge: (
          <span className="hidden shrink-0 sm:inline-flex">
            <Badge tone="success">בטיול</Badge>
          </span>
        ),
        children: (
          <TwoPane
            aside={
              <>
                <SectionHeading level="section">מה קרוב</SectionHeading>
                <UpNext
                  bookings={f.BOOKINGS}
                  now={`${f.TODAY}T09:00:00.000Z`}
                  cities={FRAME_CITIES}
                />
              </>
            }
          >
            {/* Prose, to make the measure countable. The card is 660px, the
              width the design draws cards at; the paragraph inside it stops at
              the measure. Both numbers are on screen at once, which is the
              point of having them here. */}
            <Card className="flex flex-col gap-2">
              <SectionHeading
                level="section"
                description="גם התיאור הזה מקבל את אותה מידה, ומקבל אותה מ-SectionHeading עצמו ולא מהעמוד שקורא לו."
              >
                אורך שורה
              </SectionHeading>
              <p className="max-w-measure text-sm text-muted">
                השורה הזאת קיימת כדי שאפשר יהיה לספור אותה. הכרטיס שמסביבה רוחבו
                660 פיקסלים, כמו במוקאפ, אבל הפסקה עצמה נעצרת קודם — כי בעברית
                שורה של 660 פיקסלים מגיעה ל-87 תווים, וזה כבר מעבר לטווח שנוח
                לקרוא בו. המידה יושבת על הטקסט, לא על הטור, כדי שהכרטיסים לידה
                יישארו ברוחב שהעיצוב נתן להם.
              </p>
            </Card>
            <NowCard
              day={f.ITINERARY[0]}
              date={f.TODAY}
              now={`${f.TODAY}T07:10:00Z`}
            />
          </TwoPane>
        ),
      }),
  },
  // ---- the day screen before departure -------------------------------------
  //
  // The state T1 exists for. Measured at 1911px before the fix, the main column
  // was 817px of nothing: today/page.tsx rendered NowCard only when there is a
  // current day and DayPager only during or after the trip, and on a trip
  // leaving in 62 days both are false — so the column drew an sr-only heading
  // and stopped, while the whole screen sat in the 372px pane beside it.
  //
  // Three scenes, because the pane's content is what varies: two months out
  // there is no forecast and there may be no costs, and the pane has to
  // disappear rather than stand there empty.
  // ---- the day screen while the trip runs ----------------------------------
  //
  // The pane the mockup draws for this state, which carried "מה קרוב" alone
  // until now. The two fetching panels arrive as nodes, so the scene can draw
  // the layout with fixed data instead of going to Overpass and Open-Meteo.
  {
    slug: "today-during",
    title: "היום · בטיול, עם החלונית המלאה",
    note: "ארבעה כרטיסים בחלונית בסדר של המוקאפ: התחנות של היום, מזג האוויר, דורש תשומת לב, ומה שזה עלה. הכרטיס הכהה נשאר הדבר היחיד המואר בטור",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "today",
        phase: { kind: "during", dayNumber: 3 },
        startDate: "2026-09-09",
        cities: FRAME_CITIES,
        badge: (
          <span className="hidden shrink-0 sm:inline-flex">
            <Badge tone="success">בטיול</Badge>
          </span>
        ),
        children: (
          <TwoPane
            aside={
              <TodayDuringAside
                tripId={f.TRIP_ID}
                bookings={f.BOOKINGS}
                now={f.NOW}
                cities={FRAME_CITIES}
                urgent={FAR_OPEN.filter((item) => item.urgency === "now")}
                stops={
                  <DayMapCard
                    tripId={f.TRIP_ID}
                    stops={[f.STOPS[0]]}
                    places={[]}
                  />
                }
                forecast={
                  <DayWeatherCard
                    city="טוקיו"
                    days={f.WEATHER[0].days}
                    today={f.TODAY}
                  />
                }
              />
            }
          >
            <NowCard
              day={f.ITINERARY[0]}
              date={f.TODAY}
              now={`${f.TODAY}T07:10:00Z`}
            />
            <DayPager
              tripId={f.TRIP_ID}
              days={f.ITINERARY_LONG}
              initialDay={3}
              startDate="2026-09-09"
              currentDay={3}
              bookingsByDay={{}}
              lodgingByDay={{}}
            />
          </TwoPane>
        ),
      }),
  },
  {
    slug: "today-before",
    title: "היום · לפני היציאה",
    note: "המצב שהיה 817px של כלום: אין ״עכשיו״ ואין יום נוכחי. יותר מ-16 יום מהיציאה אז אין תחזית, אבל יש עלויות — החלונית נושאת רק אותן",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "today",
        phase: { kind: "before", daysUntilStart: daysUntil(f.FAR_START) },
        startDate: f.FAR_START,
        cities: FRAME_CITIES,
        badge: (
          <span className="hidden shrink-0 sm:inline-flex">
            <Badge tone="neutral">בתכנון</Badge>
          </span>
        ),
        children: (
          <TodayBefore
            tripId={f.TRIP_ID}
            tripName="יפן בסתיו"
            bookings={f.BOOKINGS}
            now={`${f.TODAY}T09:00:00.000Z`}
            cities={FRAME_CITIES}
            open={FAR_OPEN}
          />
        ),
      }),
  },
  {
    slug: "today-before-bare",
    title: "היום · טיול חדש לגמרי",
    note: "בלי תאריכים, בלי יעדים, בלי הזמנות — אין לחלונית מה לומר, אז היא נעלמת והטור היחיד ממורכז",
    bleed: true,
    render: () =>
      appFrame({
        title: "טיול חדש",
        active: "today",
        phase: { kind: "undated" },
        startDate: null,
        cities: [],
        children: (
          <TodayBefore
            tripId={f.TRIP_ID}
            tripName="טיול חדש"
            bookings={[]}
            now={`${f.TODAY}T09:00:00.000Z`}
            cities={[]}
            open={tripOpenItems({
              startDate: null,
              daysUntilStart: null,
              dayCount: 0,
              cities: [],
              itinerary: [],
              bookings: [],
            })}
          />
        ),
      }),
  },
  // ---- the days tab --------------------------------------------------------
  //
  // The interaction T2 changed. The tab rendered all fourteen days in sequence
  // with a sticky day index beside them on lg — an index into a list is what you
  // need when the list itself is the problem. It opens on one day now, with the
  // strip above it and the month, the route and the empty days in the pane.
  //
  // A fortnight that crosses a month boundary, so the pane draws two grids.
  {
    slug: "days-tab",
    title: "ימים · יום אחד עם רצועה",
    note: "14 ימים, ארבע ערים, שלושה ימים ריקים ומעבר חודש. הרצועה, כותרת היום, לוח החודש, הערים והימים הריקים — כולם על מסך אחד",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "days",
        phase: { kind: "during", dayNumber: 3 },
        startDate: f.LONG_START,
        cities: FRAME_CITIES,
        children: (
          <Itinerary
            tripId={f.TRIP_ID}
            initialItinerary={f.ITINERARY_LONG}
            startDate={f.LONG_START}
            endDate={f.LONG_END}
            tripDayCount={14}
            currentDay={3}
            lodgingByDay={{ 1: f.LODGING }}
            bookingsByDay={{ 1: [f.BOOKINGS[0]] }}
            cityDays={f.CITY_DAYS}
          />
        ),
      }),
  },
  {
    slug: "days-tab-unbuilt",
    title: "ימים · לפני שנבנה לו״ז",
    note: "אין על מה לעמוד יום-יום, אז המסך הוא צורה אחרת: מה שהבנייה צריכה, ואז הבנייה",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "days",
        phase: { kind: "before", daysUntilStart: daysUntil(f.LONG_START) },
        startDate: f.LONG_START,
        cities: FRAME_CITIES,
        children: (
          <Itinerary
            tripId={f.TRIP_ID}
            initialItinerary={[]}
            startDate={f.LONG_START}
            endDate={f.LONG_END}
            tripDayCount={14}
            cityDays={f.CITY_DAYS}
          />
        ),
      }),
  },
  // ---- the explore tab -----------------------------------------------------
  //
  // T3's order: the category grid first, then the one lit thing on the screen,
  // then — in the pane, under the map — what the trip has picked, as rows with a
  // green check. It was a heading, the search, the manual form, a two-column
  // grid of picked cards, and discovery last.
  //
  // The map is a placeholder here on purpose: RouteMapPanel geocodes, and the
  // map has its own scene (`route-map`) that draws it with fixed stops.
  {
    slug: "explore-tab",
    title: "מה עושים? · רשת, כרטיס מואר, חלונית",
    note: "שלושת הדברים שה-DoD מבקש על מסך אחד. הרשת בשלוש עמודות עם אריח מגוון לכל קטגוריה, ו״נבחרו לטיול״ כשורות עם וי — הווי הוא גם הכיבוי, בלי X במנוחה",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "explore",
        phase: { kind: "before", daysUntilStart: daysUntil(f.LONG_START) },
        startDate: f.LONG_START,
        cities: FRAME_CITIES,
        children: (
          <ExploreScreen
            tripId={f.TRIP_ID}
            searchCities={FRAME_CITIES}
            knownCities={FRAME_CITIES}
            selected={f.SELECTED}
            addedPlaces={[]}
            savedCities={[]}
            map={
              <div className="flex h-[20rem] items-center justify-center rounded-tile border border-border bg-surface-2 text-caption text-muted">
                המפה — סצנה נפרדת, ‎/preview/route-map
              </div>
            }
          />
        ),
      }),
  },
  // ---- the "more" menu -----------------------------------------------------
  //
  // Seven rows and a card, which is T5's whole definition of done. Two rows were
  // missing entirely — the city guides had no index anywhere, and the member
  // list shared a heading with the public link — and "פרטי הטיול" moved out of
  // the list into the card at the bottom, where the delete row joins it.
  {
    slug: "more-tab",
    title: "עוד · שבע שורות וכרטיס",
    note: "כל שורה נושאת מצב אמיתי בשורת המשנה. הכרטיס השני מופרד: פרטי הטיול, ומתחתיו המחיקה בצבע הסכנה — לא אייקון מחיקה בין שבע שורות שלוחצים עליהן כל יום",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "more",
        phase: { kind: "during", dayNumber: 3 },
        startDate: f.LONG_START,
        cities: FRAME_CITIES,
        children: (
          <MoreMenu
            tripId={f.TRIP_ID}
            tripName="יפן בסתיו"
            bookings={f.BOOKINGS}
            gear={f.GEAR}
            members={f.MEMBERS}
            cities={FRAME_CITIES}
            shareToken="abcdef0123456789"
            now={f.NOW}
          />
        ),
      }),
  },
  // ---- the home screen -----------------------------------------------------
  //
  // T6, and the check is frame continuity: /profile had no rail at all, so the
  // one screen everybody starts on was the only one that did not look like the
  // app, and crossing into a trip moved the whole frame 248px sideways. Compare
  // this scene with `app-frame` — the rail must be in the same place, the same
  // width, and carrying the same colour.
  {
    slug: "home-frame",
    title: "בית · הרַיל שלא היה",
    note: "אותה מסגרת בדיוק כמו בתוך טיול: רַיל 248 בקצה, אותו אור. הרַיל נושא את האור של הטיול הקרוב, כי זה מה שהמסך הזה עוסק בו",
    bleed: true,
    render: () => (
      <AppShell
        header={<AppHeader trailing={<NewTripButton />} />}
        sidebar={
          <HomeRail
            initial="ט"
            hues={tripAura(FRAME_CITIES)}
            upcoming={{
              id: f.TRIP_ID,
              name: "יפן בסתיו",
              startDate: f.LONG_START,
              phase: {
                kind: "before",
                daysUntilStart: daysUntil(f.LONG_START),
              },
              dayCount: 14,
            }}
          />
        }
        banner={
          <AuraHero
            tripId={f.TRIP_ID}
            name="יפן בסתיו"
            startDate={f.LONG_START}
            cities={FRAME_CITIES}
            hues={tripAura(FRAME_CITIES)}
            initial="ט"
            className="-mt-5"
          />
        }
      >
        <TwoPane
          aside={
            <>
              <SectionHeading level="section">מה מתקרב</SectionHeading>
              <UpNext bookings={f.BOOKINGS} now={f.NOW} cities={FRAME_CITIES} />
              <OpenItems tripId={f.TRIP_ID} items={FAR_OPEN} />
            </>
          }
        >
          <SectionHeading level="sub">כל הטיולים · 3</SectionHeading>
          <TripList
            trips={f.TRIPS}
            today={f.TODAY}
            citiesByTrip={f.TRIP_CITIES}
            auraByTrip={assignTripAuras(
              f.TRIPS.map((trip) => ({
                id: trip.id,
                cities: f.TRIP_CITIES.get(trip.id) ?? [],
                createdAt: trip.created_at,
              })),
            )}
          />
        </TwoPane>
      </AppShell>
    ),
  },
  {
    slug: "home-frame-empty",
    title: "בית · חשבון בלי טיול קרוב",
    note: "אין ספירה לאחור ואין יעד לקפוץ אליו, אז לרַיל יש שורה אחת וכפתור — והמסגרת עדיין לא זזה",
    bleed: true,
    render: () => (
      <AppShell
        header={<AppHeader trailing={<NewTripButton />} />}
        sidebar={<HomeRail initial="ט" hues={[]} upcoming={null} />}
      >
        <SectionHeading level="page">הטיולים שלי</SectionHeading>
        <TripList trips={[]} today={f.TODAY} />
      </AppShell>
    ),
  },
  {
    slug: "city-guide-list",
    title: "מדריכי הערים · האינדקס שלא היה",
    note: "ערים שיש בהן בחירות, וערים שהגילוי הציע ואיש לא פתח — השורה השנייה היא זו שהאינדקס הזה קיים בשבילה",
    render: () => (
      <div className="flex flex-col gap-6">
        <CityGuideList
          tripId={f.TRIP_ID}
          entries={[
            { city: "טוקיו", picked: 12, description: null },
            { city: "קיוטו", picked: 1, description: "מקדשים וגנים" },
            {
              city: "אוסקה",
              picked: 0,
              description: "אוכל רחוב, טירה, ואנשים שמדברים אחרת",
            },
            { city: f.UNBREAKABLE, picked: 0, description: f.LONG },
          ]}
        />
        <CityGuideList tripId={f.TRIP_ID} entries={[]} />
      </div>
    ),
  },
  {
    slug: "selected-list",
    title: "נבחרו לטיול · שורות עם וי",
    note: "שש בחירות בשלוש ערים, כולל שם בלי נקודת שבירה. ריחוף על הווי הופך אותו ל-X — זה הכיבוי, ולכן אין אייקון מחיקה במנוחה",
    render: () => (
      <div className="flex flex-col gap-6">
        <SelectedList tripId={f.TRIP_ID} items={f.SELECTED} />
        <SelectedList tripId={f.TRIP_ID} items={[]} />
      </div>
    ),
  },
  {
    slug: "open-items",
    title: "עדיין פתוח · שלושת המצבים",
    note: "רשימה מלאה, שורה דחופה אחת, וטיול שאין בו כלום פתוח — הסדר הוא מה שחוסם את מה",
    render: () => (
      <div className="flex flex-col gap-8">
        <OpenItems tripId={f.TRIP_ID} items={FAR_OPEN} />
        <OpenItems
          tripId={f.TRIP_ID}
          items={tripOpenItems({
            startDate: f.NEAR_START,
            // Inside the three-week window, so lodging and transport turn
            // urgent rather than staying informational.
            daysUntilStart: 9,
            dayCount: 14,
            cities: FRAME_CITIES,
            itinerary: f.ITINERARY,
            bookings: [],
          })}
        />
        <OpenItems tripId={f.TRIP_ID} items={[]} />
      </div>
    ),
  },
  // ---- the home hero -------------------------------------------------------
  //
  // Full-bleed by design, so it is the one component whose scene wrapper is
  // doing something: the harness renders scenes inside a padded column, and the
  // hero undoes that padding with negative margins. Seen here it therefore
  // reaches the edge of the frame, which is what it does on the real screen.
  {
    slug: "aura-hero",
    title: "הגיבור · יפן בסתיו",
    note: "ארבע תחנות, ספירה תלת־ספרתית קרובה, ואור מלא",
    render: () => (
      <AuraHero
        tripId={f.TRIP_ID}
        name="יפן בסתיו"
        startDate="2026-09-24"
        cities={["טוקיו", "קיוטו", "אוסקה", "נארה"]}
        hues={tripAura(["טוקיו", "קיוטו", "אוסקה", "נארה"])}
        initial="t"
      />
    ),
  },
  {
    slug: "aura-hero-long",
    title: "הגיבור · שם ארוך, עיר בלי שבירה",
    note: "המצב ששבר את הגיבור הקודם: שם לשלוש שורות ושם עיר בלי נקודת שבירה",
    render: () => (
      <AuraHero
        tripId={f.TRIP_ID}
        name={f.LONG}
        startDate="2027-03-02"
        cities={["רומא", f.UNBREAKABLE]}
        hues={tripAura(["רומא", f.UNBREAKABLE])}
        initial="t"
      />
    ),
  },
  {
    slug: "aura-hero-lightless",
    title: "הגיבור · בלי יעדים ובלי תאריך",
    note: "טיול חדש לגמרי — בסיס עמוק בלי אור, ובלי ספירה לאחור",
    render: () => (
      <AuraHero
        tripId={f.TRIP_ID}
        name="סופ״ש בפראג"
        startDate={null}
        cities={[]}
        hues={[]}
        initial="t"
      />
    ),
  },
  {
    slug: "aura-palettes",
    title: "הפלטות",
    note: "כל פלטה בשדה מלא, זו ליד זו — לראות שאף שילוב לא נהפך לחום בוץ, ושאין שתיים דומות מדי",
    render: () => (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AURA_PALETTES.map((palette) => (
          <div
            key={palette}
            className="relative h-40 min-w-0 overflow-hidden rounded-tile bg-aura-base"
          >
            <AuraField
              hues={[1, 2, 3].map((n) => `var(--aura-${palette}-${n})`)}
            />
            <span className="absolute bottom-3 right-4 text-caption font-extrabold tracking-latin text-white">
              {palette.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    ),
  },

  // ---- the phone navigation bar ---------------------------------------------
  //
  // Fixed, so it escapes the scene box on purpose: it is measured against the
  // viewport, which is the only frame it ever lives in. The filler rows exist
  // to show content passing under the glass, which is the whole reason the bar
  // floats — and to make it obvious if the shell's bottom padding stops
  // clearing it.
  {
    slug: "bottom-nav",
    title: "סרגל הניווט בטלפון",
    note: "זכוכית מרחפת שהתוכן נוסע מתחתיה — והאם השורה האחרונה נשארת קריאה",
    render: () => (
      <>
        <div className="flex flex-col gap-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={i} variant="interactive" data-filler-row>
              שורה {i + 1}
            </Card>
          ))}
        </div>
        <BottomNav
          items={[
            {
              href: "#today",
              label: "היום",
              icon: <Sun className="h-5 w-5" />,
              active: true,
            },
            {
              href: "#days",
              label: "ימים",
              icon: <CalendarDays className="h-5 w-5" />,
            },
            {
              href: "#explore",
              label: "מה עושים",
              icon: <Compass className="h-5 w-5" />,
            },
            {
              href: "#map",
              label: "מפה",
              icon: <MapIcon className="h-5 w-5" />,
            },
            { href: "#more", label: "עוד", icon: <Menu className="h-5 w-5" /> },
          ]}
        />
      </>
    ),
  },

  // ---- the trip list -------------------------------------------------------
  {
    slug: "trip-list",
    title: "רשימת הטיולים",
    note: "שלושה טיולים: רגיל, שם ארוך, ושם בלי נקודת שבירה",
    render: () => (
      <TripList
        trips={f.TRIPS}
        today={f.TODAY}
        citiesByTrip={f.TRIP_CITIES}
        auraByTrip={assignTripAuras(
          f.TRIPS.map((trip) => ({
            id: trip.id,
            cities: f.TRIP_CITIES.get(trip.id) ?? [],
            createdAt: trip.created_at,
          })),
        )}
      />
    ),
  },
  {
    slug: "trip-list-empty",
    title: "רשימת הטיולים · ריקה",
    note: "המצב של משתמש חדש",
    render: () => <TripList trips={[]} today={f.TODAY} />,
  },
  // ---- the band every trip screen opens with --------------------------------
  //
  // Full-bleed and fixed to the viewport width, like the home hero, so it
  // reaches the edge of the frame here too. The three states are the three
  // headlines it can carry, and they are the reason it has a scene at all: the
  // band is in the (tabs) layout, so a mistake in it is a mistake on ten
  // screens at once.
  {
    slug: "side-nav",
    title: "הרַיל של הדסקטופ",
    note: "שלוש פלטות ושלושה שלבים — האם הפריט הנבחר מנצח את האור מאחוריו, והאם המחליף למעלה והספירה למטה קריאים על כל אחת",
    render: () => (
      <div className="flex gap-4">
        {[
          {
            cities: ["טוקיו", "קיוטו", "אוסקה", "נארה"],
            name: "יפן בסתיו",
            phase: { kind: "during", dayNumber: 3 } as const,
          },
          {
            cities: ["רומא", "פירנצה"],
            name: "איטליה באביב",
            phase: { kind: "before", daysUntilStart: 24 } as const,
          },
          {
            cities: ["פראג"],
            name: f.LONG,
            phase: { kind: "undated" } as const,
          },
        ].map(({ cities, name, phase }, index) => (
          <div
            key={index}
            className="h-[32rem] w-sidebar overflow-hidden rounded-tile"
          >
            <SideNav
              hues={tripAura(cities)}
              initial="ט"
              header={<RailTripSwitcher name={name} phase={phase} />}
              footer={
                <RailTripProgress
                  phase={phase}
                  dayCount={14}
                  startDate="2026-09-24"
                />
              }
              items={[
                {
                  href: "#1",
                  label: "היום",
                  icon: <Sun className="h-5 w-5" />,
                  active: index === 0,
                },
                {
                  href: "#2",
                  label: "ימים",
                  icon: <CalendarDays className="h-5 w-5" />,
                  active: index === 1,
                },
                {
                  href: "#3",
                  label: "מה עושים?",
                  icon: <Compass className="h-5 w-5" />,
                },
                {
                  href: "#4",
                  label: "מפה",
                  icon: <MapIcon className="h-5 w-5" />,
                  active: index === 2,
                },
                {
                  href: "#5",
                  label: "עוד",
                  icon: <Menu className="h-5 w-5" />,
                },
              ]}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    slug: "trip-band-before",
    title: "פס הטיול · לפני היציאה",
    note: "ספירה לאחור על האור של הטיול — בלי תמונה, שזה מה שהשתנה",
    render: () => (
      <div className="pt-5">
        <TripAuraBand
          name="יפן בסתיו"
          startDate="2026-09-24"
          phase={{ kind: "before", daysUntilStart: 13 }}
          dayCount={14}
          cities={["טוקיו", "קיוטו", "אוסקה", "נארה"]}
          hues={tripAura(["טוקיו", "קיוטו", "אוסקה", "נארה"])}
        />
      </div>
    ),
  },
  {
    slug: "trip-band-during",
    title: "פס הטיול · באמצע הטיול",
    note: "יום 3 מתוך 14 — הכותרת מתחלפת לפי מקום הטיול בחיים של עצמו",
    render: () => (
      <div className="pt-5">
        <TripAuraBand
          name="יפן בסתיו"
          startDate="2026-09-10"
          phase={{ kind: "during", dayNumber: 3 }}
          dayCount={14}
          cities={["טוקיו", "קיוטו"]}
          hues={tripAura(["טוקיו", "קיוטו"])}
        />
      </div>
    ),
  },
  {
    slug: "trip-band-bare",
    title: "פס הטיול · בלי תאריך ובלי יעדים",
    note: "טיול חדש לגמרי — בסיס עמוק בלי אור, והאם השם נשאר קריא עליו",
    render: () => (
      <div className="pt-5">
        <TripAuraBand
          name={f.LONG}
          startDate={null}
          phase={{ kind: "undated" }}
          dayCount={0}
          cities={[]}
          hues={[]}
        />
      </div>
    ),
  },

  // ---- today ---------------------------------------------------------------
  {
    slug: "two-pane",
    title: "שתי חלוניות",
    note: "מה שקורה ב-1280 ומעלה: הלו״ז בטור הראשי, ״מה קרוב״ בחלונית. מתחת ל-1280 החלונית פשוט יורדת מתחת לתוכן — כלום לא נעלם, רק זז",
    render: () => (
      <TwoPane
        aside={
          <>
            <SectionHeading level="section">מה קרוב</SectionHeading>
            <UpNext
              bookings={f.BOOKINGS}
              now="2026-09-11T05:00:00Z"
              cities={["טוקיו", "קיוטו"]}
            />
          </>
        }
      >
        <NowCard
          day={f.ITINERARY[0]}
          date="2026-09-11"
          now="2026-09-11T07:10:00Z"
        />
        <DayTimeline day={f.ITINERARY[0]} date="2026-09-11" />
      </TwoPane>
    ),
  },
  {
    slug: "today-stats",
    title: "רצועת הנתונים",
    note: "שלוש המשבצות מתחת לכרטיס ״עכשיו״. הן נבנות בשרת מול Open-Meteo, ולכן כאן מוצג המצב שאי אפשר להגיע אליו בחשבון אמיתי — טעינה, ואין תשובה",
    render: () => (
      <div className="flex flex-col gap-4">
        <p className="text-caption text-muted">
          בזמן טעינה — מה שרואים לפני שהתחזית חוזרת
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[4.75rem] rounded-card" />
          ))}
        </div>
      </div>
    ),
  },
  {
    slug: "now-card",
    title: "כרטיס ״עכשיו״",
    note: "אמצע היום — מה קורה עכשיו, כמה נשאר, ומה אחר כך",
    render: () => (
      <NowCard
        day={f.ITINERARY[0]}
        date="2026-09-11"
        now="2026-09-11T07:10:00Z"
      />
    ),
  },
  {
    slug: "now-card-soon",
    title: "כרטיס ״עכשיו״ · נגמר בקרוב",
    note: "פחות מ-45 דקות לסוף — התג עובר לצבע ההתראה",
    render: () => (
      <NowCard
        day={f.ITINERARY[0]}
        date="2026-09-11"
        now="2026-09-11T07:50:00Z"
      />
    ),
  },
  {
    slug: "now-card-next",
    title: "כרטיס ״עכשיו״ · בין פריטים",
    note: "שום דבר לא קורה כרגע, אז הכרטיס מדבר על הבא בתור",
    render: () => (
      <NowCard
        day={f.ITINERARY[0]}
        date="2026-09-11"
        now="2026-09-11T09:00:00Z"
      />
    ),
  },
  {
    slug: "up-next",
    title: "מה מתקרב",
    note: "מסך ״היום״ — ההזמנות הקרובות",
    render: () => (
      <UpNext bookings={f.BOOKINGS} now={f.NOW} cities={["טוקיו", "קיוטו"]} />
    ),
  },
  {
    slug: "night-stay",
    title: "איפה ישנים הלילה",
    note: "רצועת הלינה במסך ״היום״",
    render: () => <NightStay stay={f.LODGING} />,
  },

  // ---- bookings ------------------------------------------------------------
  {
    slug: "booking-list",
    title: "טיסות, רכבות ולינה",
    note: "טיסה, מלון עם ביטול חינם, ורכבת שלא הוזמנה עם קוד ארוך",
    render: () => (
      <BookingList
        tripId={f.TRIP_ID}
        bookings={f.BOOKINGS}
        cities={["טוקיו", "קיוטו"]}
        now={f.NOW}
      />
    ),
  },
  {
    slug: "booking-list-empty",
    title: "הזמנות · ריק",
    note: "לפני שהוזנה הזמנה ראשונה",
    render: () => (
      <BookingList tripId={f.TRIP_ID} bookings={[]} cities={[]} now={f.NOW} />
    ),
  },
  {
    slug: "booking-form",
    title: "טופס הזמנה",
    note: "השדות הצפופים ביותר באפליקציה — datetime-local, מספר, בורר",
    render: () => (
      <BookingForm tripId={f.TRIP_ID} cities={["טוקיו", f.UNBREAKABLE]} />
    ),
  },
  {
    slug: "expenses",
    title: "הוצאות הטיול",
    note: "סיכום לפי מטבע, עם פריט אחד בלי עלות",
    render: () => <ExpenseSummary bookings={f.BOOKINGS} />,
  },
  {
    slug: "trip-dates",
    title: "תאריכי הטיול",
    note: "שני שדות תאריך זה לצד זה",
    render: () => (
      <TripDatesForm tripId={f.TRIP_ID} startDate={null} endDate={null} />
    ),
  },

  // ---- itinerary -----------------------------------------------------------
  {
    slug: "day-pager",
    title: "רצועת הימים",
    note: "יום בשבוע מעל תאריך, לא ״יום N״ — והנבחר בדיו ולא בכחול הפעולה. היום הנוכחי מסומן בטבעת, כדי ש״היום״ ו״נבחר״ יוכלו להיות נכונים בו-זמנית",
    render: () => (
      <DayPager
        tripId={f.TRIP_ID}
        days={f.ITINERARY}
        initialDay={1}
        startDate="2026-09-11"
        currentDay={2}
        bookingsByDay={{ 1: f.BOOKINGS }}
        lodgingByDay={{}}
      />
    ),
  },
  {
    slug: "day-pager-undated",
    title: "רצועת הימים · בלי תאריך התחלה",
    note: "אין לוח שנה להתייחס אליו, אז הגלולות חוזרות ל״יום N״ — הנפילה לאחור שהיא הסיבה שהעוזר בדומיין מחזיר null",
    render: () => (
      <DayPager
        tripId={f.TRIP_ID}
        days={f.ITINERARY}
        initialDay={1}
        startDate={null}
        currentDay={null}
        bookingsByDay={{}}
        lodgingByDay={{}}
      />
    ),
  },
  {
    slug: "day-timeline",
    title: "ציר הזמן של היום",
    note: "שלוש פעילויות והזמנות על אותו ציר",
    render: () => (
      <DayTimeline
        day={f.ITINERARY[0]}
        bookings={f.BOOKINGS}
        date="2026-09-11"
      />
    ),
  },
  {
    slug: "day-timeline-gaps",
    title: "ציר הזמן · הפערים",
    note: "אותו יום בלי הטיסה שמכסה אותו — כאן שורות הפער נראות, וזה מה שהחליף את רשת השעות",
    render: () => <DayTimeline day={f.ITINERARY[0]} date="2026-09-11" />,
  },
  {
    slug: "day-timeline-empty",
    title: "ציר הזמן · יום ריק",
    note: "יום בלי פעילויות — המצב שמציע רעיונות",
    render: () => (
      <DayTimeline day={f.ITINERARY[1]} bookings={[]} date="2026-09-12" />
    ),
  },
  {
    slug: "city-days",
    title: "ימים בכל עיר",
    note: "נגזר מלינה, נדרס ידנית, ולא נקבע",
    render: () => (
      <CityDaysEditor tripId={f.TRIP_ID} plan={f.CITY_DAYS} tripDayCount={14} />
    ),
  },

  // ---- map -----------------------------------------------------------------
  //
  // T4 is a measurement, not a redraw: the map runs full-bleed from the app bar
  // to the bottom of the viewport, and its height is arithmetic against the
  // chrome above it — chrome that T0 rearranged. So the map needs a scene inside
  // the frame, which is what `map-tab` is; `map` below still measures the
  // component on its own.
  //
  // No band: TripBandSlot hides it on this tab, and it is the reason the map can
  // start at the app bar at all.
  {
    slug: "map-tab",
    title: "מפה · בתוך המסגרת",
    note: "בטלפון המפה נוגעת בשלוש הקצוות ומתחת לסרגל; בדסקטופ היא חולקת שורה עם חלונית התחנות. אין רצועה לבנה סביבה באף אחד מהם",
    bleed: true,
    render: () =>
      appFrame({
        title: "יפן בסתיו",
        active: "map",
        phase: { kind: "during", dayNumber: 3 },
        startDate: f.LONG_START,
        cities: FRAME_CITIES,
        showBanner: false,
        children: (
          <RouteMap
            tripId={f.TRIP_ID}
            route={f.ROUTE}
            itinerary={f.ITINERARY_LONG}
            tripName="יפן בסתיו"
          />
        ),
      }),
  },
  {
    slug: "map",
    title: "מפת המסלול",
    note: "תחנות, תיקון אוטומטי, ושני יעדים בלי מיקום",
    render: () => (
      <RouteMap
        tripId={f.TRIP_ID}
        route={f.ROUTE}
        itinerary={f.ITINERARY}
        tripName="יפן בסתיו"
      />
    ),
  },
  {
    slug: "map-all-unlocated",
    title: "מפה · אף עיר לא נמקמה",
    note: "המקרה שבו המסך אמר ״הוסיפו יעדים״ למי שכבר יש לו",
    render: () => (
      <RouteMap
        tripId={f.TRIP_ID}
        route={f.ROUTE_EMPTY}
        itinerary={[]}
        tripName="יפן בסתיו"
      />
    ),
  },
  {
    slug: "unlocated",
    title: "יעדים בלי מיקום",
    note: "התיקון: לכתוב את השם באנגלית",
    render: () => (
      <UnlocatedCities
        tripId={f.TRIP_ID}
        cities={["קנזאווה", f.UNBREAKABLE]}
        tripName="יפן בסתיו"
      />
    ),
  },

  // ---- sharing -------------------------------------------------------------
  {
    slug: "members",
    title: "מי יכול להיכנס",
    note: "בעלים, עורך ומצפה, עם הזמנה שממתינה",
    render: () => (
      <MemberList
        tripId={f.TRIP_ID}
        members={f.MEMBERS}
        invites={f.INVITES}
        isOwner
        currentUserId={f.USER_ID}
      />
    ),
  },
  {
    slug: "members-as-viewer",
    title: "מי יכול להיכנס · כמצפה",
    note: "בלי בוררי הרשאה ובלי הסרה — מה שחבר רואה",
    render: () => (
      <MemberList
        tripId={f.TRIP_ID}
        members={f.MEMBERS}
        invites={[]}
        isOwner={false}
        currentUserId={f.MEMBERS[2].member_id}
      />
    ),
  },
  {
    slug: "invite",
    title: "הזמנת אדם",
    note: "אימייל, הרשאה, ואז ערוצי המסירה",
    render: () => (
      <InviteForm
        tripId={f.TRIP_ID}
        tripName="יפן בסתיו"
        origin="https://tripplan-ten.vercel.app"
      />
    ),
  },
  {
    slug: "share-link",
    title: "קישור פומבי",
    note: "המצב שקרס בפרודקשן כשהיה טוקן",
    render: () => (
      <ShareTrip
        tripId={f.TRIP_ID}
        initialToken="0123456789abcdef0123456789abcdef"
        origin="https://tripplan-ten.vercel.app"
      />
    ),
  },
  {
    slug: "share-button",
    title: "כפתור השיתוף בכותרת",
    note: "הגרסה המצומצמת לטלפון והמלאה לרוחב",
    render: () => <ShareButton tripId={f.TRIP_ID} memberCount={2} isShared />,
  },

  // ---- more ----------------------------------------------------------------
  {
    slug: "gear",
    title: "ציוד",
    note: "רשימה עם התקדמות, קטגוריות והצעות התחלה",
    render: () => <GearList tripId={f.TRIP_ID} items={f.GEAR} />,
  },
  {
    slug: "gear-empty",
    title: "ציוד · ריק",
    note: "מצב ההתחלה עם שש רשימות מוצעות",
    render: () => <GearList tripId={f.TRIP_ID} items={[]} />,
  },
  {
    slug: "weather",
    title: "מזג אוויר",
    note: "גלילה אופקית של ימים, לשתי ערים",
    render: () => (
      <WeatherForecast window={f.WEATHER_WINDOW} cities={f.WEATHER} />
    ),
  },
  {
    slug: "phrasebook",
    title: "שיחון",
    note: "ביטוי רגיל וביטוי בלי נקודת שבירה",
    render: () => (
      <Phrasebook tripId={f.TRIP_ID} initialPhrasebook={f.PHRASEBOOK} />
    ),
  },
  {
    slug: "guide",
    title: "איך זה עובד",
    note: "שמונת השלבים, עם קישור לכל מסך",
    render: () => <WorkflowGuide tripId={f.TRIP_ID} />,
  },
  {
    slug: "guide-summary",
    title: "איך זה עובד · תמצית",
    note: "הגרסה שבדיאלוג ״טיול חדש״",
    render: () => <WorkflowSummary />,
  },

  // ---- primitives ----------------------------------------------------------
  {
    slug: "aura-panel",
    title: "הפאנל המואר",
    note: "האלמנט המואר היחיד במסך גילוי. הצבע מגיע ממשתני CSS שהלייאאוט מפרסם, לא מ-props — כאן הם מוגדרים ידנית כדי לבדוק שתי פלטות",
    render: () => (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["טוקיו", "קיוטו", "אוסקה", "נארה"],
          ["רומא", "פירנצה"],
        ].map((cities, index) => (
          <div key={index} style={tripHueStyle(tripAura(cities))}>
            <AuraPanel>
              <span className="text-caption font-extrabold text-white/75">
                הצעות בשבילכם
              </span>
              <p className="text-title font-bold">מה ה-AI ממליץ בשינג׳וקו?</p>
              <p className="text-caption text-white/75">
                OpenStreetMap יודע אילו מקומות יש ומתי הם פתוחים. את מה שהאזור
                עצמו שווה בשבילו — לא.
              </p>
              <Button variant="onLight" size="sm" className="mt-1 self-start">
                בקשו הצעות
              </Button>
            </AuraPanel>
          </div>
        ))}
      </div>
    ),
  },
  {
    slug: "start-here",
    title: "בואו נתחיל מהמקום",
    note: "מה שמופיע מתחת לגיבור חסר-האור: שתי הדרכים לבחור יעד — לבקש הצעות, או להוסיף עיר בעצמך",
    render: () => <StartHere tripId={f.TRIP_ID} />,
  },
  {
    slug: "create-trip",
    title: "טופס טיול חדש",
    note: "שם ותאריכים — התאריכים עברו ליצירה כי כמעט הכול באפליקציה נגזר מהם. הם עדיין אופציונליים",
    render: () => <CreateTripForm />,
  },
  {
    slug: "primitives",
    title: "פרימיטיבים תחת לחץ",
    note: "כותרת ומצב ריק עם טקסט שלא נשבר",
    render: () => (
      <div className="flex flex-col gap-4">
        <SectionHeading level="page" description={f.LONG}>
          {f.UNBREAKABLE}
        </SectionHeading>
        <EmptyState
          icon={<Luggage />}
          title={f.LONG}
          description={f.UNBREAKABLE}
        />
      </div>
    ),
  },
];

export const SCENES_BY_SLUG = new Map(
  SCENES.map((scene) => [scene.slug, scene]),
);
