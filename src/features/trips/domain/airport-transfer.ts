import * as z from "zod";
import { ARRIVAL_BUFFER_MIN } from "./day-hours";
import { formatMinutes } from "./timeline";

// Getting from the airport to where you are sleeping, on the day you land.
//
// Asked for as: "on the landing day, the build should offer to plan the route
// from the airport to a chosen destination (the hotel by default), show arrival
// options according to the timetables, with public transport or a taxi to
// choose between — and once added, the full route shows in the schedule."
//
// **What this is not.** It is not live departure times, and it does not pretend
// to be. There is no free public-transport routing API — the note on
// ItineraryEntry.travelNote has said so since migration 0013, and the rule for
// this project is free services only — so the options come from the model,
// which knows the standing answer to "how do you get from Narita into Tokyo"
// very well and knows nothing about the 14:12 being cancelled. Every option
// therefore carries a *typical* duration and frequency, and the UI says so.
//
// What the app contributes is the arithmetic, which is the half the model
// cannot do: it knows the actual landing time of the actual booked flight, and
// it turns "53 minutes, every 30" into "you are through the airport around
// 10:00 and at the hotel around 11:05".

export const TRANSFER_MODES = ["transit", "taxi"] as const;
export const transferModeSchema = z.enum(TRANSFER_MODES);
export type TransferMode = z.infer<typeof transferModeSchema>;

export const TRANSFER_MODE_LABELS: Record<TransferMode, string> = {
  transit: "תחבורה ציבורית",
  taxi: "מונית",
};

// One move within a way in: board here, ride this, get off there.
//
// Asked for as "reduce it to a point per stage — from the airport take a train
// at X for about this much, then a second point from the train to the bus, the
// same, and the boarding and alighting stop for each stage."
//
// It was a `steps: string[]` of free prose, which reads fine and cannot be used:
// nothing could put a time on a stage, price it, link it, or put its two ends on
// a map, because none of those were fields. They are now.
//
// **No ticket URL, deliberately.** The obvious field here is a link straight to
// the operator's booking page, and asking a model for one is asking it to
// invent plausible URLs — a dead or wrong link under "buy a ticket" is worse
// than no link, and it is not checkable from here. The operator's *name* is
// something a model does know reliably, so that is what is asked for, and the
// link is built as a search from it. One more click, and it cannot be wrong.
export const transferLegSchema = z.object({
  // "רכבת", "אוטובוס", "הליכה", "מונית" — the vehicle, in a word or two.
  mode: z.string().trim().min(1).max(40),
  // Where you get on and where you get off. The pair that was missing.
  from: z.string().trim().min(1).max(120),
  to: z.string().trim().min(1).max(120),
  // This stage alone, including the wait before boarding it — so the stages
  // add up to the door-to-door total rather than under-counting it.
  durationMinutes: z.number().int().min(1).max(600),
  // "~¥3,250". Empty when the stage is a walk or is covered by the fare above.
  costText: z.string().max(60),
  // Who runs it — "JR East", "Airport Limousine". Used to search for tickets.
  operator: z.string().max(80),
});
export type TransferLeg = z.infer<typeof transferLegSchema>;

// One way in, as the model returns it.
//
// Free text for cost and frequency rather than numbers: a fare is "¥3,250" in
// one city, "£25 return" in another and "about 45 AED on the meter" in a third,
// and forcing that into an amount plus a currency would either lose the
// qualifier or invent a precision nobody has. The duration *is* a number,
// because the app does arithmetic with it.
export const transferOptionSchema = z.object({
  mode: transferModeSchema,
  // "נריטה אקספרס", "מונית מהטרמינל".
  name: z.string().min(1).max(80),
  // One line on what it is and where it drops you.
  summary: z.string().min(1).max(200),
  // Door to door, typical. Capped at ten hours — anything longer is the model
  // having answered a different question.
  //
  // Zero is allowed, which it was not at first. Once the stages carry their own
  // durations this field is the weaker of two answers, and a model that filled
  // in the stages and left the total at 0 had its *entire* reply rejected —
  // three good options thrown away over a redundant number. transferDuration
  // adds the stages up anyway.
  durationMinutes: z.number().int().min(0).max(600),
  // "כ-₪120", "~¥3,250 לאדם".
  costText: z.string().max(60),
  // "כל 30 דק׳", "לפי דרישה". Empty for a taxi is fine.
  frequencyText: z.string().max(60),
  // The moves this option is made of, one row each. Empty for a taxi, which is
  // one move and has nothing to break down.
  legs: z.array(transferLegSchema).max(6),
});
export type TransferOption = z.infer<typeof transferOptionSchema>;

export const transferOptionsSchema = z.object({
  options: z.array(transferOptionSchema),
});

export const transferRequestSchema = z.object({
  tripId: z.uuid(),
  // Where you land. Free text, because that is what the booking holds.
  airport: z.string().trim().min(1).max(120),
  // Where you are going — the hotel by default, but the traveller can type
  // anything, which is the point of asking.
  destination: z.string().trim().min(1).max(200),
  // The city, so the model does not have to infer it from an airport code.
  city: z.string().trim().max(120).optional(),
  // "08:30" — the landing, in the trip's own clock. Used in the prompt so a
  // 02:00 arrival is not offered the first train of the morning as though it
  // were waiting.
  landsAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
});
export type TransferRequest = z.infer<typeof transferRequestSchema>;

// What the browser sends back once one of the offered options is chosen.
//
// The option travels out to the client and returns, so it is re-validated on
// the way in — by then it is ordinary user input, whatever produced it.
export const addTransferSchema = z.object({
  // The landing day. The entry may end up on the day after it — see
  // transferTimes — which is why the length of the trip has to come too.
  dayNumber: z.number().int().min(1).max(60),
  dayCount: z.number().int().min(1).max(60),
  airport: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).nullable().optional(),
  // Minutes from midnight, in the trip's clock — the landing this transfer
  // follows. The server does not recompute it from the booking: the day screen
  // already resolved which arrival this is, and two answers to "when did we
  // land" is exactly the drift this avoids.
  landingMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
  option: transferOptionSchema,
});
export type AddTransferInput = z.infer<typeof addTransferSchema>;

// The arrival a day begins with, if it begins with one: a transport booking
// whose landing falls on this date.
//
// Returns the place it lands and the minute of the day it lands at, which is
// everything the transfer planner needs and nothing it does not. Null when the
// day has no arrival, which is every day but one or two of a trip — and the
// offer is drawn from this being non-null, so a day that did not fly does not
// get asked how it is getting out of the airport.
export function arrivalOnDay(
  bookings: {
    kind: string;
    destination: string | null;
    ends_at: string | null;
  }[],
  date: string | null,
  zone: string,
): { place: string; minutes: number } | null {
  if (!date) return null;

  for (const booking of bookings) {
    if (booking.kind !== "flight" && booking.kind !== "train") continue;
    if (!booking.ends_at || !booking.destination) continue;

    const at = new Date(booking.ends_at);
    if (Number.isNaN(at.getTime())) continue;
    if (new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(at) !== date)
      continue;

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value);
    const hour = read("hour") % 24;
    const minute = read("minute");
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

    return { place: booking.destination, minutes: hour * 60 + minute };
  }

  return null;
}

// When the traveller is actually out of the airport, and when this option puts
// them at the door.
//
// The buffer is the same one the itinerary builder uses to decide a landing
// day's earliest free hour — immigration, baggage and getting to the platform.
// Shared rather than re-picked, so the day cannot say "nothing before 10:00"
// while the transfer it suggests leaves at 09:00.
const MINUTES_PER_DAY = 24 * 60;

export type TransferTiming = {
  // Clock times within the day each one falls on, not offsets from the landing.
  leavesAt: number;
  arrivesAt: number;
  // How many days after the landing the traveller actually leaves the airport.
  // 0 almost always; 1 when the landing is late enough that clearing it takes
  // you past midnight.
  dayOffset: number;
  // The ride itself crosses midnight — it starts on one day and ends on the
  // next. Distinct from `dayOffset`, which is about where it starts.
  arrivesNextDay: boolean;
};

// When the traveller is actually out of the airport, and when this option puts
// them at the door.
//
// **Midnight is a real case here, not an edge one.** Reported: "my landing is
// late, so leaving the airport is at the start of the next day — the schedule
// has to continue into the next day's times."
//
// It does, and the first version of this got it wrong in a way that hid the
// problem instead of showing it: it clamped the arrival to 23:59 and left the
// entry on the landing day, so a 23:30 landing produced "leaves 01:00, arrives
// 23:59" on a day that was already over. Both numbers wrong, on the wrong day.
//
// So the day is part of the answer now. Land at 23:30, clear the airport at
// 01:00, and this returns 01:00 with `dayOffset: 1` — the schedule continues
// on the next day, at the next day's times, which is what was asked for.
// Door to door.
//
// The legs win when there are any, because the header and the breakdown under
// it have to agree: a total of 55 above three stages adding to 61 is the screen
// arguing with itself, and the stages are the more specific claim. Falls back
// to the model's own figure for a taxi, which has no stages.
export function transferDuration(option: TransferOption): number {
  const fromLegs = option.legs.reduce(
    (sum, leg) => sum + leg.durationMinutes,
    0,
  );
  // Never zero. Both figures are the model's and either can come back empty;
  // a zero here would put the arrival at the same minute as the departure and
  // make the option look free of time.
  return Math.max(1, fromLegs > 0 ? fromLegs : option.durationMinutes);
}

export function transferTimes(
  landingMinutes: number,
  option: TransferOption,
): TransferTiming {
  const leavesRaw = landingMinutes + ARRIVAL_BUFFER_MIN;
  const arrivesRaw = leavesRaw + transferDuration(option);

  const dayOffset = Math.floor(leavesRaw / MINUTES_PER_DAY);
  const leavesAt = leavesRaw % MINUTES_PER_DAY;
  const arrivesNextDay =
    Math.floor(arrivesRaw / MINUTES_PER_DAY) > dayOffset;

  return {
    leavesAt,
    // The true clock time either way. A ride that crosses midnight reads
    // "23:40 — 00:25", which is how a ticket writes it and how the timeline
    // already draws an overnight flight; inventing 23:59 to keep end > start
    // would be replacing a fact with a tidier fiction.
    arrivesAt: arrivesRaw % MINUTES_PER_DAY,
    dayOffset,
    arrivesNextDay,
  };
}

// Each stage with the clock time it starts at.
//
// The app's arithmetic again, and the half the model cannot do: it knows a ride
// takes 25 minutes, and only the app knows this particular flight lands at
// 08:30, so only the app can say the ride starts at 10:13. Minutes are returned
// raw — past 1440 when a late landing pushes a stage into the next day — and
// formatting wraps them, the same way transferTimes does.
export function transferLegTimes(
  landingMinutes: number,
  option: TransferOption,
): { leg: TransferLeg; startsAt: number; endsAt: number }[] {
  let at = landingMinutes + ARRIVAL_BUFFER_MIN;

  return option.legs.map((leg) => {
    const startsAt = at;
    at += leg.durationMinutes;
    return { leg, startsAt, endsAt: at };
  });
}

// Where to buy, as a search rather than a guessed deep link.
//
// See the note on transferLegSchema: a model asked for a booking URL will
// produce a convincing one whether or not it exists, and "buy a ticket" is the
// worst possible label for a dead link. A search for the operator and the
// route lands on the official site among the first results and cannot 404.
export function ticketSearchUrl(leg: TransferLeg): string | null {
  const operator = leg.operator.trim();
  // A walk has no ticket, and a stage with no named operator has nothing to
  // search for that would not just be the city's name.
  if (!operator) return null;

  const query = `${operator} ${leg.from} ${leg.to} tickets`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// The stops a Maps route should thread through: the airport, every place a
// stage gets off at, and the destination.
//
// Consecutive repeats are dropped — a stage's `to` is usually the next one's
// `from`, and Google treats a waypoint equal to the one before it as a detour
// to where you already are.
export function transferRouteStops(
  airport: string,
  destination: string,
  option: TransferOption,
): string[] {
  const stops = [airport, ...option.legs.map((leg) => leg.to), destination];

  return stops.reduce<string[]>((kept, stop) => {
    const value = stop.trim();
    if (!value) return kept;
    if (kept[kept.length - 1] === value) return kept;
    kept.push(value);
    return kept;
  }, []);
}

// The itinerary entry a chosen option becomes.
//
// An ordinary entry, not a new kind of row: it has a time, it happens on a day,
// and it is the first thing on that day. The mode, the cost and the frequency
// go into `travelNote`, the field that has existed since 0013 for exactly this
// — "how you get there and how long it takes, in words, because the app cannot
// work it out".
export function transferEntry(
  option: TransferOption,
  input: { airport: string; destination: string; landingMinutes: number },
): {
  // Days after the landing day that this entry belongs on. The caller adds it
  // to the day number — see addAirportTransfer, which also clamps it to the
  // trip's length.
  dayOffset: number;
  title: string;
  startLabel: string;
  endLabel: string;
  note: string;
  travelNote: string;
  travelMinutes: number;
} {
  const { leavesAt, arrivesAt, dayOffset, arrivesNextDay } = transferTimes(
    input.landingMinutes,
    option,
  );

  const details = [
    TRANSFER_MODE_LABELS[option.mode],
    option.costText,
    option.frequencyText,
  ].filter((part) => part.trim().length > 0);

  return {
    dayOffset,
    title: `${input.airport} ← ${input.destination}`,
    startLabel: formatMinutes(leavesAt),
    endLabel: formatMinutes(arrivesAt),
    // The stages are what you actually read while standing in arrivals, so
    // each one is a line of its own: when, what, from where to where.
    //
    // One string because that is what the column is, but built as lines rather
    // than as one run of text joined by dots — three moves flattened into a
    // paragraph is the crowding this was reported for, and a newline costs
    // nothing.
    //
    // A ride that crosses midnight says so in words. The two labels are
    // "23:40" and "00:25", which is correct and also the one case where an end
    // earlier than a start is not a mistake — so it is named rather than left
    // to be worked out.
    note: [
      option.name,
      ...transferLegTimes(input.landingMinutes, option).map(
        ({ leg, startsAt }) =>
          [
            formatMinutes(startsAt),
            leg.mode,
            `${leg.from} ← ${leg.to}`,
            leg.costText,
          ]
            .filter((part) => part && part.trim())
            .join(" · "),
      ),
      arrivesNextDay ? "ההגעה כבר למחרת" : "",
    ]
      .filter(Boolean)
      .join("\n"),
    travelNote: details.join(" · "),
    travelMinutes: option.durationMinutes,
  };
}
