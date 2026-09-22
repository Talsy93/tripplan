"use client";

import { useState, useTransition } from "react";
import { Bus, Car, PlaneLanding, Sparkles } from "lucide-react";
import {
  Banner,
  Button,
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
  transferOptionsSchema,
  transferTimes,
} from "../domain/airport-transfer";
import { formatMinutes } from "../domain/timeline";
import { addAirportTransfer } from "../application/itinerary-actions";
import type { TransferOption } from "../domain/airport-transfer";

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
  // Pre-filled destination — the hotel that covers this night, when there is
  // one, by name and address. The traveller can type over it, which is why it
  // is asked at all.
  defaultDestination,
  city,
}: {
  tripId: string;
  dayNumber: number;
  dayCount: number;
  airport: string;
  landingMinutes: number;
  defaultDestination: string;
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
          defaultDestination={defaultDestination}
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
  defaultDestination,
  city,
  onClose,
}: {
  tripId: string;
  dayNumber: number;
  dayCount: number;
  airport: string;
  landingMinutes: number;
  defaultDestination: string;
  city: string | null;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState(defaultDestination);
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
    steps: [],
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

        <Field label="לאן נוסעים" hint="ברירת המחדל היא הלינה של אותו לילה">
          <Input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            maxLength={200}
            placeholder="שם המלון או הכתובת"
          />
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
  busy,
  disabled,
  onChoose,
}: {
  option: TransferOption;
  landingMinutes: number;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { leavesAt, arrivesAt, dayOffset, arrivesNextDay } = transferTimes(
    landingMinutes,
    option,
  );
  const Icon = option.mode === "taxi" ? Car : Bus;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-control border border-border p-3",
        option.mode === "taxi" ? "bg-surface" : "bg-surface-sunken",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
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
      </div>

      <p className="text-caption text-muted wrap-anywhere">{option.summary}</p>

      {option.steps.length > 0 && (
        <ol className="flex flex-col gap-0.5 text-caption text-muted">
          {option.steps.map((step, index) => (
            <li key={index} className="flex min-w-0 gap-1.5">
              <span className="shrink-0 tabular-nums">{index + 1}.</span>
              <span className="min-w-0 wrap-anywhere">{step}</span>
            </li>
          ))}
        </ol>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        loading={busy}
        disabled={disabled && !busy}
        onClick={onChoose}
        className="self-start"
      >
        הוספה ללו&quot;ז
      </Button>
    </div>
  );
}
