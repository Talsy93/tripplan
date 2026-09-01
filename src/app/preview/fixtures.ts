// Fixture data for the preview harness. Development only — see page.tsx.
//
// Three flavours of every string, because they fail differently:
//
//   TYPICAL     — what a real trip looks like. Checks the ordinary layout.
//   LONG        — a long Hebrew phrase with spaces. Must wrap.
//   UNBREAKABLE — one token with no break opportunity. This is the one that
//                 defeats `break-words` and needs `wrap-anywhere`, and it is
//                 what held a grid track open at 978px inside a 320px phone.
//
// Kept in the harness rather than in a feature, because it is test data and
// nothing in the app may import it.

import type { Booking } from "@/features/trips/domain/booking";
import type { ItineraryDay } from "@/features/trips/domain/ai-suggestion";
import type { RouteStop, TripRoute } from "@/features/trips/domain/route";
import type { GearItem } from "@/features/trips/domain/gear";
import type { Trip } from "@/features/trips/domain/trip";
import type { TripInvite, TripMember } from "@/features/trips/domain/membership";
import type { CityWeather, ForecastWindow } from "@/features/trips/domain/weather";
import type { AiPhrasebook } from "@/features/trips/domain/phrasebook";
import type { CityDayPlan } from "@/features/trips/domain/city-days";
import type { NightLodging } from "@/features/trips/domain/trip-days";

export const LONG =
  "מסעדה יפנית מסורתית עם תפריט אומקסה של שנים־עשר מנות ותצפית על הגן ההיסטורי";
export const UNBREAKABLE =
  "Supercalifragilisticexpialidociousandthensomemoreandmore1234567890";
export const LONG_URL =
  "https://www.example-travel-agency.co.jp/reservations/confirm?id=ABCDEFGH12345678&lang=he";

export const TRIP_ID = "00000000-0000-0000-0000-000000000001";
export const USER_ID = "00000000-0000-0000-0000-0000000000ff";
const id = (n: string) => `00000000-0000-0000-0000-0000000000${n}`;

export const NOW = "2026-09-11T09:30:00Z";
export const TODAY = "2026-09-11";

// Two departure dates measured from TODAY, for the day screen's before-state.
//
// FAR is 62 days out — the trip from the screenshot that made T1 necessary, and
// the far side of two thresholds at once: past the 16-day forecast horizon, so
// the context pane has no weather to show, and past the three weeks at which an
// unbooked hotel becomes urgent rather than informational.
//
// NEAR is 9 days out, inside both.
export const FAR_START = "2026-11-12";
export const NEAR_START = "2026-09-20";

// ---- trips ----------------------------------------------------------------

export const TRIPS: Trip[] = [
  {
    id: id("d1"),
    user_id: USER_ID,
    name: "יפן בסתיו",
    start_date: "2026-09-10",
    end_date: "2026-09-24",
    status: "planning",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id("d2"),
    user_id: USER_ID,
    name: LONG,
    start_date: "2027-03-02",
    end_date: null,
    status: "planning",
    created_at: "2026-02-01T00:00:00Z",
  },
  {
    id: id("d3"),
    user_id: USER_ID,
    name: UNBREAKABLE,
    start_date: null,
    end_date: null,
    status: "planning",
    created_at: "2026-03-01T00:00:00Z",
  },
];

// Cities per trip, for the light each trip is drawn in. Deliberately uneven:
// three cities, one city, and none at all — a trip with no destinations chosen
// is the case that has to render as the bare base rather than as a broken tile.
export const TRIP_CITIES = new Map<string, string[]>([
  [id("d1"), ["טוקיו", "קיוטו", "אוסקה", "נארה"]],
  [id("d2"), ["רומא"]],
]);

// ---- bookings -------------------------------------------------------------

const bookingBase = {
  trip_id: TRIP_ID,
  city: "טוקיו",
  address: null,
  confirmation: null,
  note: null,
  created_at: "2026-01-01T00:00:00Z",
  free_cancellation_until: null,
  book_by: null,
  booked: true,
  reminder_days_before: null,
  cancel_notified_at: null,
  book_by_notified_at: null,
  cost_amount: null,
  cost_currency: null,
} as const;

export const BOOKINGS: Booking[] = [
  {
    ...bookingBase,
    id: id("a1"),
    kind: "flight",
    title: "LY086 · אל על",
    origin: "נתב״ג",
    destination: "הנדה, טוקיו",
    starts_at: "2026-09-10T22:20:00Z",
    ends_at: "2026-09-11T17:05:00Z",
    confirmation: "ABC123",
    cost_amount: 3200,
    cost_currency: "ILS",
  },
  {
    ...bookingBase,
    id: id("a2"),
    kind: "lodging",
    title: "מלון שינג׳וקו גרנד",
    origin: null,
    destination: null,
    starts_at: "2026-09-11T15:00:00Z",
    ends_at: "2026-09-15T11:00:00Z",
    address: "1-2-3 Kabukicho, Shinjuku City, Tokyo",
    free_cancellation_until: "2026-09-04",
    note: "צאו מהיציאה המערבית של התחנה ואז שמאלה.",
    cost_amount: 4800,
    cost_currency: "ILS",
  },
  {
    ...bookingBase,
    id: id("a3"),
    kind: "train",
    title: UNBREAKABLE,
    origin: "Tokyoooooooooooooooooooooooooo",
    destination: "Kyotoooooooooooooooooooooooooo",
    starts_at: "2026-09-15T13:00:00Z",
    ends_at: "2026-09-15T15:20:00Z",
    confirmation: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    note: LONG_URL,
    booked: false,
    book_by: "2026-09-01",
  },
];

export const LODGING: NightLodging = {
  booking: BOOKINGS[1],
  isCheckIn: true,
  isLastNight: false,
};

// ---- itinerary ------------------------------------------------------------

export const ITINERARY: ItineraryDay[] = [
  {
    day: 1,
    items: [
      {
        id: id("b1"),
        title: "שוק צוקיג׳י החיצוני",
        startLabel: "09:00",
        endLabel: "11:00",
        note: "ללכת רעבים.",
        city: "טוקיו",
        latitude: 35.665,
        longitude: 139.77,
        travelNote: "קו הייביה עד צוקיג׳י, יציאה 1",
        travelMinutes: 25,
      },
      {
        id: id("b2"),
        title: LONG,
        startLabel: "12:30",
        endLabel: "14:00",
        note: LONG_URL,
        city: "טוקיו",
        latitude: null,
        longitude: null,
        travelNote: LONG,
        travelMinutes: 40,
      },
      {
        id: id("b3"),
        title: UNBREAKABLE,
        startLabel: "16:00",
        endLabel: "17:30",
        note: "",
        city: "טוקיו",
        latitude: null,
        longitude: null,
        travelNote: null,
        travelMinutes: null,
      },
    ],
  },
  { day: 2, items: [] },
];

// ---- route ----------------------------------------------------------------

export const STOPS: RouteStop[] = [
  {
    city: "טוקיו",
    latitude: 35.68,
    longitude: 139.77,
    itemCount: 14,
    nights: 4,
    days: [1, 2, 3, 4],
    country: "יפן",
    countryCode: "jp",
  },
  {
    city: "קיוטו",
    latitude: 35.01,
    longitude: 135.77,
    itemCount: 6,
    nights: 3,
    days: [5, 6, 7],
    country: "יפן",
    countryCode: "jp",
  },
  {
    city: UNBREAKABLE,
    latitude: 36.14,
    longitude: 137.25,
    itemCount: 2,
    nights: 1,
    days: [8],
    country: null,
    countryCode: null,
  },
];

export const ROUTE: TripRoute = {
  stops: STOPS,
  places: [],
  // The case the harness exists to make visible: a destination the geocoder
  // could not confirm, which now gets no pin rather than a wrong one.
  unlocatedCities: ["קנזאווה", UNBREAKABLE],
  repairedCities: ["קיוטו"],
};

export const ROUTE_EMPTY: TripRoute = {
  stops: [],
  places: [],
  unlocatedCities: ["קנזאווה"],
  repairedCities: [],
};

// ---- gear -----------------------------------------------------------------

const gearItem = (
  n: string,
  label: string,
  category: GearItem["category"],
  packed = false,
): GearItem => ({
  id: id(n),
  trip_id: TRIP_ID,
  label,
  category,
  packed,
  created_at: "2026-01-01T00:00:00Z",
});

export const GEAR: GearItem[] = [
  gearItem("c1", "דרכון", "documents", true),
  gearItem("c2", "ביטוח נסיעות", "documents"),
  gearItem("c3", "מתאם שקע ליפן", "electronics", true),
  gearItem("c4", LONG, "other"),
  gearItem("c5", UNBREAKABLE, "clothing"),
];

// ---- sharing --------------------------------------------------------------

export const MEMBERS: TripMember[] = [
  {
    member_id: USER_ID,
    member_email: "owner@example.com",
    member_name: "טל",
    member_role: "editor",
    joined_at: "2026-01-01T00:00:00Z",
    is_owner: true,
  },
  {
    member_id: id("e2"),
    member_email: "partner.with.a.long.address@an-extremely-long-domain.example",
    member_name: null,
    member_role: "editor",
    joined_at: "2026-01-02T00:00:00Z",
    is_owner: false,
  },
  {
    member_id: id("e3"),
    member_email: "viewer@example.com",
    member_name: LONG,
    member_role: "viewer",
    joined_at: "2026-01-03T00:00:00Z",
    is_owner: false,
  },
];

export const INVITES: TripInvite[] = [
  {
    token: "0123456789abcdef0123456789abcdef",
    trip_id: TRIP_ID,
    email: "pending.invitee@another-very-long-domain.example",
    role: "editor",
    created_at: "2026-01-04T00:00:00Z",
    accepted_at: null,
  },
];

// ---- weather, phrases, city days -------------------------------------------

export const WEATHER_WINDOW: ForecastWindow = {
  kind: "available",
  startDate: "2026-09-10",
  endDate: "2026-09-16",
};

export const WEATHER: CityWeather[] = [
  {
    city: "טוקיו",
    days: [
      { date: "2026-09-10", code: 61, maxC: 28, minC: 21, rainChance: 70 },
      { date: "2026-09-11", code: 0, maxC: 30, minC: 22, rainChance: 5 },
      { date: "2026-09-12", code: 3, maxC: 27, minC: 20, rainChance: 30 },
    ],
  },
  {
    city: UNBREAKABLE,
    days: [{ date: "2026-09-10", code: 95, maxC: 24, minC: 18, rainChance: 90 }],
  },
];

export const PHRASEBOOK: AiPhrasebook = {
  language: "יפנית",
  language_english: "Japanese",
  sections: [
    {
      title: "במסעדה",
      phrases: [
        {
          he: "אפשר תפריט באנגלית?",
          en: "May I have an English menu?",
          local: "英語のメニューはありますか",
          pronunciation: "eigo no menyū wa arimasu ka",
        },
        {
          he: LONG,
          en: UNBREAKABLE,
          local: UNBREAKABLE,
          pronunciation: UNBREAKABLE,
        },
      ],
    },
  ],
};

export const CITY_DAYS: CityDayPlan[] = [
  { city: "טוקיו", days: 4, source: "lodging" },
  { city: "קיוטו", days: 3, source: "override" },
  { city: UNBREAKABLE, days: null, source: "unset" },
];
