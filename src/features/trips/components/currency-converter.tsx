"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowUpDown, ChevronDown } from "lucide-react";
import { Dialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { convert } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { currencySymbol, formatMoney } from "../domain/expenses";
import { toolTileClasses, ToolTileBody } from "./tool-tile";

// The money tile on the day screen and the converter behind it.
//
// A trip can cross borders, so the tile is handed every currency the trip
// touches and opens on the one for today's country (the itinerary says where
// you are). Tapping it opens the converter sheet; when there is more than one
// currency, the destination's pill in the sheet is a picker — the tile follows.

// A unit big enough to read: "€1 = ₪4.02", but "100¥ = ₪2.16" rather than
// "1¥ = ₪0.02".
function unitOf(rate: ExchangeRate): { unit: number; one: number } {
  const perOne = convert(1, rate, "toBase");
  const unit = perOne >= 0.1 ? 1 : perOne >= 0.01 ? 100 : 1000;
  return { unit, one: perOne * unit };
}

// The quick amounts under the converter, in whichever currency is on top.
// €5–€100 is what a day in Rome costs in pieces; for yen the same pieces are
// ¥500–¥10,000, so the list scales with the unit rather than being one list
// that is useless in half the world.
function quickAmounts(unit: number): number[] {
  return [5, 10, 20, 50, 100].map((amount) => amount * unit);
}
const QUICK_HOME = [20, 50, 100, 200, 500];

// Pencil's "ממיר" tile: the rate as the value ("₪4.02"), and what one unit is
// under it ("ממיר · €1").
export function CurrencyTile({
  rates,
  initialQuote = null,
}: {
  rates: ExchangeRate[];
  // The currency of today's country, per the itinerary. Null falls back to
  // the trip's most-used currency.
  initialQuote?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<string | null>(initialQuote);

  const rate =
    rates.find((candidate) => candidate.quote === (quote ?? initialQuote)) ??
    rates[0] ??
    null;

  if (!rate) {
    return (
      <div className={cn(toolTileClasses, "hover:shadow-card")}>
        <ToolTileBody icon={<ArrowLeftRight />} value="—" label="אין שער" />
      </div>
    );
  }

  const { unit, one } = unitOf(rate);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`ממיר מטבע, ${unit} ${rate.quote} שווה ${trim(one)} ${rate.base}`}
        className={toolTileClasses}
      >
        <ToolTileBody
          icon={<ArrowLeftRight />}
          value={formatMoney(Number(trim(one)), rate.base)}
          valueDir="ltr"
          label={
            <>
              ממיר ·{" "}
              <span dir="ltr">
                {currencySymbol(rate.quote)}
                {unit}
              </span>
            </>
          }
        />
      </button>

      <ConverterDialog
        rates={rates}
        rate={rate}
        onPick={setQuote}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// Pencil's converter sheet: the amount you type on top, in a teal outline; what
// it is in the other currency under it, on the quiet fill; a round dark button
// between them that swaps which is which; quick amounts; the rate as a caption.
function ConverterDialog({
  rates,
  rate,
  onPick,
  open,
  onClose,
}: {
  rates: ExchangeRate[];
  rate: ExchangeRate;
  onPick: (quote: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { unit, one } = unitOf(rate);
  // The top box is the one typed in; the bottom is derived on render, so the
  // two can never disagree. Swapping flips which currency is on top and
  // carries the converted amount up with it, so it stays a two-way converter.
  const [amount, setAmount] = useState(() => String(25 * unit));
  const [direction, setDirection] = useState<"toBase" | "toQuote">("toBase");

  const value = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
  const result = valid ? convert(value, rate, direction) : null;

  const top = direction === "toBase" ? rate.quote : rate.base;
  const bottom = direction === "toBase" ? rate.base : rate.quote;
  const quick = direction === "toBase" ? quickAmounts(unit) : QUICK_HOME;

  const quotePicker =
    rates.length > 1 ? { rates, onPick } : null;

  function swap() {
    setDirection(direction === "toBase" ? "toQuote" : "toBase");
    if (result !== null) setAmount(trim(result));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <>
          <span className="block">ממיר מטבע</span>
          <span className="mt-0.5 block text-sm leading-5 font-normal text-muted">
            שער הבנק המרכזי האירופי · עודכן {rate.date.slice(8, 10)}.
            {rate.date.slice(5, 7)}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="relative flex flex-col gap-2">
          <label className="flex min-h-[4.75rem] min-w-0 items-center gap-3 rounded-[1.25rem] border-2 border-primary bg-surface px-4">
            <CurrencyPill
              code={top}
              className="bg-surface-2"
              picker={top === rate.quote ? quotePicker : null}
            />
            <input
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label={`סכום ב-${top}`}
              className="w-full min-w-0 flex-1 bg-transparent text-start text-[2rem] leading-10 font-bold tabular-nums text-foreground focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={swap}
            aria-label="החלפת כיוון ההמרה"
            className="absolute top-1/2 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background ring-4 ring-surface transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-ring"
          >
            <ArrowUpDown className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex min-h-[4.75rem] min-w-0 items-center gap-3 rounded-[1.25rem] bg-surface-2 px-4">
            <CurrencyPill
              code={bottom}
              className="bg-surface"
              picker={bottom === rate.quote ? quotePicker : null}
            />
            <output
              dir="ltr"
              aria-live="polite"
              className="w-full min-w-0 flex-1 truncate text-start text-[2rem] leading-10 font-bold tabular-nums text-primary"
            >
              {result === null ? "—" : trim(result)}
            </output>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {quick.map((amountOption) => (
            <button
              key={amountOption}
              type="button"
              onClick={() => setAmount(String(amountOption))}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center rounded-full border border-border bg-surface px-1 font-semibold tabular-nums text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // "¥10,000" in a fifth of a phone does not fit at 14px.
                formatMoney(amountOption, top).length > 5 ? "text-xs" : "text-sm",
              )}
            >
              <span dir="ltr" className="truncate">
                {formatMoney(amountOption, top)}
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted">
          <span dir="ltr" className="font-medium tabular-nums">
            {currencySymbol(rate.quote)}
            {unit} = {currencySymbol(rate.base)}
            {trim(one)}
          </span>
          <span className="mt-1 block text-xs text-outline">
            הכרטיס שלכם עשוי לגבות עמלה נוספת.
          </span>
        </p>
      </div>
    </Dialog>
  );
}

// "EUR €" in a pill. The destination's pill is also where another of the
// trip's currencies is picked, when it has more than one — a native select laid
// over the pill, so the phone's own picker opens.
function CurrencyPill({
  code,
  className,
  picker,
}: {
  code: string;
  className?: string;
  picker: { rates: ExchangeRate[]; onPick: (quote: string) => void } | null;
}) {
  return (
    <span
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-foreground",
        className,
      )}
    >
      <span dir="ltr">
        {code} {currencySymbol(code) !== code && currencySymbol(code).trim()}
      </span>
      {picker && (
        <>
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
          <select
            aria-label="מטבע"
            value={code}
            onChange={(event) => picker.onPick(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {picker.rates.map((candidate) => (
              <option key={candidate.quote} value={candidate.quote}>
                {candidate.quote}
              </option>
            ))}
          </select>
        </>
      )}
    </span>
  );
}

function trim(amount: number): string {
  if (amount >= 100) return String(Math.round(amount));
  if (amount >= 10) return amount.toFixed(1).replace(/\.0$/, "");
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

// The converter inline rather than behind a tile — an amount in the
// destination's currency on one side, what it is in shekels on the other, and
// the rate as a chip that opens the full sheet. The day screen now uses the
// tile; this stays for layouts that want the converter open.
export function CurrencyCard({
  rates,
  initialQuote = null,
}: {
  rates: ExchangeRate[];
  initialQuote?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<string | null>(initialQuote);
  const [amount, setAmount] = useState("25");

  const rate =
    rates.find((candidate) => candidate.quote === (quote ?? initialQuote)) ??
    rates[0] ??
    null;
  if (!rate) return null;

  const value = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
  const inBase = valid ? convert(value, rate, "toBase") : null;
  const { unit, one } = unitOf(rate);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary"
          >
            <ArrowLeftRight className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <h4 className="text-base leading-6 font-bold text-foreground">
            ממיר מטבע
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          dir="ltr"
          className="flex min-h-9 items-center rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted tabular-nums transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {currencySymbol(rate.quote)}
          {unit} = {currencySymbol(rate.base)}
          {trim(one)}
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <label className="flex min-w-0 flex-1 flex-col rounded-2xl bg-surface-2 px-3 py-2">
          <span className="text-xs text-muted">
            {rate.quote} ({currencySymbol(rate.quote)})
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full min-w-0 bg-transparent text-lg! leading-7 font-bold text-foreground tabular-nums focus:outline-none"
          />
        </label>
        <ArrowLeftRight className="h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl bg-surface-2 px-3 py-2">
          <span className="text-xs text-muted">
            {rate.base} ({currencySymbol(rate.base)})
          </span>
          <span className="truncate text-lg leading-7 font-bold text-primary tabular-nums" dir="ltr">
            {inBase === null ? "—" : formatMoney(inBase, rate.base)}
          </span>
        </div>
      </div>

      <ConverterDialog
        rates={rates}
        rate={rate}
        onPick={setQuote}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
