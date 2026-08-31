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
  CountdownHero,
  DayTimeline,
  ExpenseSummary,
  GearList,
  InviteForm,
  MemberList,
  NightStay,
  Phrasebook,
  RouteHero,
  RouteMap,
  ShareButton,
  ShareTrip,
  TripDatesForm,
  TripList,
  tripAura,
  UnlocatedCities,
  UpNext,
  WeatherForecast,
  WorkflowGuide,
  WorkflowSummary,
} from "@/features/trips";
import { AuraField, EmptyState, SectionHeading } from "@/components/ui";
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
  {
    slug: "countdown-hero",
    title: "הטיול הקרוב",
    note: "כרטיס גדול עם ספירה לאחור וצ׳יפים של ערים",
    render: () => (
      <CountdownHero
        tripId={f.TRIP_ID}
        name={f.LONG}
        startDate="2026-09-24"
        imageUrl={null}
        cities={["טוקיו", "קיוטו", f.UNBREAKABLE]}
        hues={tripAura(["טוקיו", "קיוטו", f.UNBREAKABLE])}
        href="#"
      />
    ),
  },
  {
    slug: "countdown-hero-photo",
    title: "הטיול הקרוב · עם תמונה",
    note: "האור צובע את התמונה במקום scrim שחור — האם הטקסט הלבן נשאר קריא",
    render: () => (
      <CountdownHero
        tripId={f.TRIP_ID}
        name="יפן בסתיו"
        startDate="2026-09-24"
        imageUrl={f.PHOTO}
        cities={["טוקיו", "קיוטו", "אוסקה"]}
        hues={tripAura(["טוקיו", "קיוטו", "אוסקה"])}
        href="#"
      />
    ),
  },
  {
    slug: "countdown-hero-lightless",
    title: "הטיול הקרוב · בלי יעדים",
    note: "טיול שעוד לא נבחרו לו יעדים — בסיס עמוק בלי אור, לא רקע שבור",
    render: () => (
      <CountdownHero
        tripId={f.TRIP_ID}
        name="סופ״ש בפראג"
        startDate={null}
        imageUrl={null}
        cities={[]}
        hues={[]}
        href="#"
      />
    ),
  },

  // ---- today ---------------------------------------------------------------
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
    slug: "route-hero",
    title: "כותרת המסלול",
    note: "תמונה עם שם הטיול מעליה",
    render: () => (
      <RouteHero tripName={f.UNBREAKABLE} stops={f.STOPS} imageUrl={null} />
    ),
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
        <EmptyState icon="🧳" title={f.LONG} description={f.UNBREAKABLE} />
      </div>
    ),
  },
];

export const SCENES_BY_SLUG = new Map(SCENES.map((scene) => [scene.slug, scene]));
