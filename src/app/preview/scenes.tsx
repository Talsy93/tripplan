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
  BookingForm,
  BookingList,
  CityDaysEditor,

  DayTimeline,
  ExpenseSummary,
  GearList,
  InviteForm,
  MemberList,
  NightStay,
  Phrasebook,

  RouteMap,
  ShareButton,
  ShareTrip,
  TripDatesForm,
  TripAuraBand,
  TripList,
  tripAura,
  UnlocatedCities,
  NowCard,
  UpNext,
  WeatherForecast,
  WorkflowGuide,
  WorkflowSummary,
} from "@/features/trips";
import { AuraField, Card, EmptyState, SectionHeading } from "@/components/ui";
import { BottomNav, SideNav, TwoPane } from "@/components/layout";
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
  render: () => ReactNode;
};

export const SCENES: Scene[] = [
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
            { href: "#days", label: "ימים", icon: <CalendarDays className="h-5 w-5" /> },
            { href: "#explore", label: "מה עושים", icon: <Compass className="h-5 w-5" /> },
            { href: "#map", label: "מפה", icon: <MapIcon className="h-5 w-5" /> },
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
    note: "שלוש פלטות זו לצד זו — האם הפריט הנבחר מנצח את האור מאחוריו בכל אחת מהן, והאם הלא-נבחרים עדיין קריאים",
    render: () => (
      <div className="flex gap-4">
        {[
          ["טוקיו", "קיוטו", "אוסקה", "נארה"],
          ["רומא", "פירנצה"],
          ["פראג"],
        ].map((cities, index) => (
          <div key={index} className="h-[26rem] w-60 overflow-hidden rounded-tile">
            <SideNav
              hues={tripAura(cities)}
              items={[
                { href: "#1", label: "היום", icon: <Sun className="h-5 w-5" />, active: index === 0 },
                { href: "#2", label: "ימים", icon: <CalendarDays className="h-5 w-5" />, active: index === 1 },
                { href: "#3", label: "מה עושים?", icon: <Compass className="h-5 w-5" /> },
                { href: "#4", label: "מפה", icon: <MapIcon className="h-5 w-5" />, active: index === 2 },
                { href: "#5", label: "עוד", icon: <Menu className="h-5 w-5" /> },
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
        <DayTimeline
          day={f.ITINERARY[0]}
          date="2026-09-11"
          origin="מלון שינג׳וקו גרנד"
        />
      </TwoPane>
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
    slug: "day-timeline",
    title: "ציר הזמן של היום",
    note: "שלוש פעילויות והזמנות על אותו ציר",
    render: () => (
      <DayTimeline
        day={f.ITINERARY[0]}
        bookings={f.BOOKINGS}
        date="2026-09-11"
        origin="מלון שינג׳וקו גרנד"
      />
    ),
  },
  {
    slug: "day-timeline-gaps",
    title: "ציר הזמן · הפערים",
    note: "אותו יום בלי הטיסה שמכסה אותו — כאן שורות הפער נראות, וזה מה שהחליף את רשת השעות",
    render: () => (
      <DayTimeline
        day={f.ITINERARY[0]}
        date="2026-09-11"
        origin="מלון שינג׳וקו גרנד"
      />
    ),
  },
  {
    slug: "day-timeline-empty",
    title: "ציר הזמן · יום ריק",
    note: "יום בלי פעילויות — המצב שמציע רעיונות",
    render: () => <DayTimeline day={f.ITINERARY[1]} bookings={[]} date="2026-09-12" />,
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
    render: () => (
      <ShareButton tripId={f.TRIP_ID} memberCount={2} isShared />
    ),
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
    slug: "primitives",
    title: "פרימיטיבים תחת לחץ",
    note: "כותרת ומצב ריק עם טקסט שלא נשבר",
    render: () => (
      <div className="flex flex-col gap-4">
        <SectionHeading level="page" description={f.LONG}>
          {f.UNBREAKABLE}
        </SectionHeading>
        <EmptyState icon={<Luggage />} title={f.LONG} description={f.UNBREAKABLE} />
      </div>
    ),
  },
];

export const SCENES_BY_SLUG = new Map(SCENES.map((scene) => [scene.slug, scene]));
