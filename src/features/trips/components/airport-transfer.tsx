"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Bus,
  Car,
  ChevronDown,
  ExternalLink,
  Hotel,
  Map,
  PlaneLanding,
  Sparkles,
  Ticket,
} from "lucide-react";
import {
  Banner,
  Button,
  buttonClasses,
  Chip,
  Dialog,
  Field,
  Input,
  Skeleton,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { aiErrorFromResponse } from "../domain/ai-errors";
import {
  TRANSFER_MODE_LABELS,
  ticketSearchUrl,
  transferLegTimes,
  transferOptionsSchema,
  transferRouteStops,
  transferTimes,
} from "../domain/airport-transfer";
import { formatMinutes } from "../domain/timeline";
import { googleMapsRouteUrl } from "@/lib/maps";
import { addAirportTransfer } from "../application/itinerary-actions";
import type { TransferOption } from "../domain/airport-transfer";

// One offered destination: what the chip says, and what actually goes to the
// model. They differ on purpose — the label is the hotel's name, which is what
// makes it recognisable at a glance, and the value carries the address too,
// which is what makes the answer accurate.
export type TransferDestination = { label: string; value: string };

// Lodgings turned into offered destinations, in the order given, without
// repeats or blanks.
//
// Deduped on the value rather than the booking id: the same hotel across two
// nights is two rows of `lodgingByDay` and one place to be driven to, and a
// chip offered twice is a choice that is not a choice.
export function transferDestinations(
  bookings: ({ title: string; address: string | null } | undefined)[],
): TransferDestination[] {
  const out: TransferDestination[] = [];

  for (const booking of bookings) {
    if (!booking?.title?.trim()) continue;
    const value = [booking.title, booking.address]
      .filter((part) => part && part.trim())
      .join(", ");
    if (out.some((existing) => existing.value === value)) continue;
    out.push({ label: booking.title, value });
  }

  return out;
}

// Planning the way out of the airport, on the day you land.
//
// Three steps, and the middle one is the only one that costs anything: say
// where you are going (the hotel is filled in), press to fetch the ways in, pick
// one. It lands in the day's schedule as an ordinary entry, timed from the
// actual landing.
//
// **The fetch is behind a press, on purpose.** It is a model call, and the
// owner's call was that building a schedule must not make one on its own — this
// is a question most trips ask once, and re-deriving "the Narita Express runs
// every half hour" on every rebuild would be paying rent on a fact.
//
// The figures are typical, not live. There is no free public-transport routing
// API — see the note on ItineraryEntry.travelNote, which has said so since
// migration 0013 — so the app supplies the arithmetic it can actually do: it
// knows when this flight lands, and turns "53 minutes" into a clock time.
export function AirportTransferButton({
  tripId,
  dayNumber,
  // How long the trip is, so a transfer pushed past midnight cannot be placed
  // on a day the trip does not have.
  dayCount,
  // The arrival this transfer follows: where it lands and at what minute of the
  // day, already resolved by the screen that knows which booking it is.
  airport,
  landingMinutes,
  // Where you might be going, as choices rather than as one pre-filled string.
  // The first is the default and starts selected: the lodging that covers this
  // night.
  suggestions,
  city,
}: {
  tripId: string;
  dayNumber: number;
  dayCount: number;
  airport: string;
  landingMinutes: number;
  suggestions: TransferDestination[];
  city: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [generation, setGeneration] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setGeneration((current) => current + 1);
          setOpen(true);
        }}
      >
        <PlaneLanding className="h-4 w-4" aria-hidden="true" />
        תכננו את ההגעה מהשדה
      </Button>

      {open && (
        <TransferDialog
          key={generation}
          tripId={tripId}
          dayNumber={dayNumber}
          dayCount={dayCount}
          airport={airport}
          landingMinutes={landingMinutes}
          suggestions={suggestions}
          city={city}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TransferDialog({
  tripId,
  dayNumber,
  dayCount,
  airport,
  landingMinutes,
  suggestions,
  city,
  onClose,
}: {
  tripId: string;
  dayNumber: number;
  dayCount: number;
  airport: string;
  landingMinutes: number;
  suggestions: TransferDestination[];
  city: string | null;
  onClose: () => void;
}) {
  // The first suggestion is the default, already chosen. The chip below shows
  // it as chosen rather than the field merely containing it.
  const [destination, setDestination] = useState(
    suggestions[0]?.value ?? "",
  );
  const [options, setOptions] = useState<TransferOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  // When the traveller is out of the terminal, independent of which option they
  // pick — the buffer is the same for all of them, so it can be said once at the
  // top. A zero-duration option is used only to reach that number.
  const clearing = transferTimes(landingMinutes, {
    mode: "taxi",
    name: "",
    summary: "",
    durationMinutes: 1,
    costText: "",
    frequencyText: "",
    legs: [],
  });
  const clearsAt = clearing.leavesAt;
  const clearsNextDay = clearing.dayOffset > 0;

  async function load() {
    setLoading(true);
    setError(null);
    setOptions(null);
    try {
      const res = await fetch("/api/ai/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          airport,
          destination,
          city: city ?? undefined,
          landsAt: formatMinutes(landingMinutes),
        }),
      });
      if (!res.ok) {
        throw new Error(
          await aiErrorFromResponse(res, "לא הצלחנו להביא אפשרויות. נסו שוב."),
        );
      }
      // Parsed on the way in as well as on the way out. The route validates
      // what the model returned; this validates what arrived over the wire,
      // which is the boundary this component is actually on.
      const parsed = transferOptionsSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error("התשובה חזרה בפורמט לא צפוי. נסו שוב.");
      }
      setOptions(parsed.data.options);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "משהו השתבש. נסו שוב.",
      );
    } finally {
      setLoading(false);
    }
  }

  function choose(option: TransferOption) {
    setAdding(option.name);
    startTransition(async () => {
      const result = await addAirportTransfer(tripId, {
        dayNumber,
        dayCount,
        airport,
        destination,
        city,
        landingMinutes,
        option,
      });
      setAdding(null);
      if (!result.ok) {
        showToast(result.message ?? "ההוספה נכשלה.", "danger");
        return;
      }
      showToast("ההגעה נוספה ללו״ז");
      onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      title="ההגעה מהשדה"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {/* Through the same function the options use, not `+ 90` inline. That
            shortcut printed "25:00" on a late landing — the exact case this
            screen now has to get right. */}
        <p className="text-caption text-muted">
          הנחיתה ב{airport} בשעה {formatMinutes(landingMinutes)}. אחרי ביקורת
          דרכונים, כבודה והגעה לרציף — יוצאים בערך ב{formatMinutes(clearsAt)}
          {clearsNextDay && ", כבר למחרת"}.
        </p>

        {clearsNextDay && (
          <Banner tone="info">
            הנחיתה מאוחרת, אז היציאה מהשדה היא כבר ביום שאחרי — ומה שתבחרו ייכנס
            ללו&quot;ז של אותו יום, בשעות שלו.
          </Banner>
        )}

        {/* The lodging as something to *press*, not only as text already in the
            box.

            Reported as "the default exists but there is no button to press it
            with", and that is exactly what was wrong: the hotel was pre-filled
            into a free-text field, so the app had made a choice without ever
            offering one. A filled input asks you to read a string and decide
            whether to trust it; a chip that is visibly selected says "this one,
            unless you say otherwise" — which is what a default is. */}
        <Field
          label="לאן נוסעים"
          hint={
            suggestions.length > 0
              ? "הלינה של אותו לילה כבר נבחרה — אפשר גם להקליד יעד אחר"
              : undefined
          }
        >
          <div className="flex min-w-0 flex-col gap-2">
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((option) => (
                  <Chip
                    key={option.value}
                    active={destination.trim() === option.value}
                    onClick={() => setDestination(option.value)}
                  >
                    <Hotel className="h-3.5 w-3.5" aria-hidden="true" />
                    {option.label}
                  </Chip>
                ))}
              </div>
            )}
            <Input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              maxLength={200}
              placeholder="שם המלון או הכתובת"
              aria-label="יעד ההגעה"
            />
          </div>
        </Field>

        {options === null && !loading && (
          <Button
            type="button"
            onClick={load}
            disabled={destination.trim().length === 0}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            הציגו אפשרויות הגעה
          </Button>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && <Banner tone="danger">{error}</Banner>}

        {options !== null && options.length === 0 && (
          <Banner tone="info">לא נמצאו אפשרויות. נסו לנסח את היעד אחרת.</Banner>
        )}

        {options !== null && options.length > 0 && (
          <>
            <ul className="flex flex-col gap-2">
              {options.map((option) => (
                <li key={`${option.mode}|${option.name}`}>
                  <OptionCard
                    option={option}
                    landingMinutes={landingMinutes}
                    airport={airport}
                    destination={destination}
                    busy={adding === option.name}
                    disabled={pending}
                    onChoose={() => choose(option)}
                  />
                </li>
              ))}
            </ul>

            {/* Said once, plainly, and not repeated on every card. The whole
                feature rests on the traveller knowing these are the standing
                figures rather than today's departures. */}
            <p className="text-caption text-muted">
              הזמנים והמחירים אופייניים ולא לוח זמנים חי — בדקו מול המפעיל לפני
              שסומכים על החיבור האחרון של הלילה.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

function OptionCard({
  option,
  landingMinutes,
  // The two ends of the whole journey, for the Maps route. The stages supply
  // everything in between.
  airport,
  destination,
  busy,
  disabled,
  onChoose,
}: {
  option: TransferOption;
  landingMinutes: number;
  airport: string;
  destination: string;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { leavesAt, arrivesAt, dayOffset, arrivesNextDay } = transferTimes(
    landingMinutes,
    option,
  );
  const legs = transferLegTimes(landingMinutes, option);
  const mapsUrl = googleMapsRouteUrl(
    transferRouteStops(airport, destination, option),
    "transit",
  );
  const Icon = option.mode === "taxi" ? Car : Bus;

  // A heading you can compare, and a disclosure for the rest.
  //
  // Asked for after seeing three of these fully unfolded: "show a heading only,
  // and a dropdown for the extra information." Right, and for a reason the
  // first version missed — the list is a *comparison*. Three options laid out
  // in full is three paragraphs and two numbered lists to read before you can
  // tell which is cheaper, and the answer to "which of these" lives entirely in
  // the header line.
  //
  // So the header carries exactly what a choice needs — how you travel, what it
  // costs, how often it runs, and when it gets you there — and the prose and
  // the step-by-step wait behind the chevron for the one you settled on.
  //
  // A <details>, not state: the disclosure belongs to the browser, which gives
  // the keyboard and screen-reader behaviour for free. Same call the booking
  // form's folded block makes.
  return (
    <details
      className={cn(
        "group/opt min-w-0 rounded-control border border-border",
        option.mode === "taxi" ? "bg-surface" : "bg-surface-sunken",
      )}
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2.5 p-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 text-sm font-bold wrap-anywhere">
            {option.name}
          </span>
          <span className="text-caption text-muted">
            {TRANSFER_MODE_LABELS[option.mode]}
            {option.frequencyText && ` · ${option.frequencyText}`}
            {option.costText && ` · ${option.costText}`}
          </span>
        </span>

        {/* The answer the traveller came for: not "53 minutes" but "you are
            there at 11:05". The "+1" is the same notation the timeline uses for
            a flight that lands the next day — an end earlier than its start is
            correct here, and the marker is what says so. */}
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-caption font-bold tabular-nums" dir="ltr">
            {formatMinutes(leavesAt)}–{formatMinutes(arrivesAt)}
            {arrivesNextDay && " +1"}
          </span>
          {dayOffset > 0 && (
            <span className="text-caption font-semibold text-callout-ink">
              למחרת
            </span>
          )}
        </span>

        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open/opt:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="flex min-w-0 flex-col gap-3 border-t border-border p-3">
        <p className="text-caption text-muted wrap-anywhere">
          {option.summary}
        </p>

        {/* One row per stage: when it starts, what you board, where you get on
            and off, what it costs, and where to buy it. Prose could carry the
            first two of those and none of the rest. */}
        {legs.length > 0 && (
          <ol className="flex min-w-0 flex-col gap-2">
            {legs.map(({ leg, startsAt }, index) => {
              const tickets = ticketSearchUrl(leg);
              return (
                <li
                  key={index}
                  className="flex min-w-0 gap-2.5 border-s-2 border-border ps-2.5"
                >
                  <span className="w-11 shrink-0 text-caption font-bold tabular-nums text-muted">
                    {formatMinutes(startsAt)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="min-w-0 text-caption font-semibold wrap-anywhere">
                      {leg.mode}
                      {leg.costText && (
                        <span className="font-normal text-muted">
                          {" · "}
                          {leg.costText}
                        </span>
                      )}
                    </span>
                    {/* The pair that was missing: where you get on and where
                        you get off. An arrow between them rather than "from X
                        to Y", because two station names are what you are
                        scanning for. */}
                    <span className="flex min-w-0 items-center gap-1 text-caption text-muted">
                      <span className="min-w-0 wrap-anywhere">{leg.from}</span>
                      <ArrowLeft
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 wrap-anywhere">{leg.to}</span>
                    </span>
                    {tickets && (
                      <a
                        href={tickets}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-fit items-center gap-1 rounded text-caption font-semibold text-primary-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Ticket className="h-3 w-3" aria-hidden="true" />
                        כרטיסים ל{leg.operator}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Inside the disclosure on purpose. Choosing one of these commits it
              to the schedule, and the press that does it belongs next to the
              detail you opened in order to be sure — not on a row you are still
              skimming. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            disabled={disabled && !busy}
            onClick={onChoose}
          >
            הוספה ללו&quot;ז
          </Button>

          {/* The route handed to Google, threading the stages' stops. This is
              the one thing the app genuinely cannot do itself — real transit
              routing is not available for free — so rather than pretend, it
              opens the tool that has it. A plain URL, no Maps API and no
              billing (see lib/maps.ts). */}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonClasses("ghost", "sm"),
                "text-primary-ink",
              )}
            >
              <Map className="h-4 w-4" aria-hidden="true" />
              המסלול בגוגל מפות
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </details>
  );
}
