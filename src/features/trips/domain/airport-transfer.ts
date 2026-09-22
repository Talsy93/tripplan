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
  durationMinutes: z.number().int().min(1).max(600),
  // "כ-₪120", "~¥3,250 לאדם".
  costText: z.string().max(60),
  // "כל 30 דק׳", "לפי דרישה". Empty for a taxi is fine.
  frequencyText: z.string().max(60),
  // The actual moves, when there is more than one — "רכבת עד שינג׳וקו, ואז
  // 8 דק׳ הליכה". Empty for a taxi.
  steps: z.array(z.string().max(160)).max(6),
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
  dayNumber: z.number().int().min(1).max(60),
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
export function transferTimes(
  landingMinutes: number,
  option: TransferOption,
): { leavesAt: number; arrivesAt: number } {
  const leavesAt = landingMinutes + ARRIVAL_BUFFER_MIN;
  return {
    leavesAt,
    // Clamped to the end of the day. A transfer that would spill past midnight
    // is real — a 23:00 landing exists — and the schedule has no day after this
    // one to put it on, so it ends at 23:59 rather than wrapping to 00:45 and
    // sorting to the top of the morning.
    arrivesAt: Math.min(leavesAt + option.durationMinutes, 24 * 60 - 1),
  };
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
  title: string;
  startLabel: string;
  endLabel: string;
  note: string;
  travelNote: string;
  travelMinutes: number;
} {
  const { leavesAt, arrivesAt } = transferTimes(input.landingMinutes, option);

  const details = [
    TRANSFER_MODE_LABELS[option.mode],
    option.costText,
    option.frequencyText,
  ].filter((part) => part.trim().length > 0);

  return {
    title: `${input.airport} ← ${input.destination}`,
    startLabel: formatMinutes(leavesAt),
    endLabel: formatMinutes(arrivesAt),
    // The steps are the thing you actually read while standing in arrivals.
    note: [option.name, option.summary, ...option.steps]
      .filter(Boolean)
      .join(" · "),
    travelNote: details.join(" · "),
    travelMinutes: option.durationMinutes,
  };
}
