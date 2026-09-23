"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronDown, Coins } from "lucide-react";
import { Dialog, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { convert, rateLine } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { currencySymbol, formatMoney } from "../domain/expenses";

// The money tile on the day screen and the converter behind it.
//
// A trip can cross borders, so the tile is handed every currency the trip
// touches and opens on the one for today's country (the itinerary says where
// you are). Tapping it opens a two-way converter; when there is more than one
// currency, a row of chips switches between them — the tile follows.
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
      <div className="flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card bg-surface shadow-card px-2 py-2.5 text-center">
        <span className="flex min-w-0 items-center justify-center gap-1 text-caption font-semibold text-muted">
          <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">מטבע</span>
        </span>
        <span className="min-w-0 truncate text-sm font-black">—</span>
        <span className="min-w-0 truncate text-caption text-muted">אין שער</span>
      </div>
    );
  }

  const lines = rateLine(rate, formatMoney);
  const several = rates.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card bg-surface shadow-card px-2 py-2.5 text-center transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center justify-center gap-1 text-caption font-semibold text-muted">
          <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{rate.quote}</span>
          {several && (
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 truncate text-sm font-black tabular-nums" dir="ltr">
          {lines.forward}
        </span>
        <span className="min-w-0 truncate text-caption tabular-nums text-muted" dir="ltr">
          {lines.backward}
        </span>
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

const QUICK = [10, 50, 100, 500, 1000, 5000];

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
  // Whichever box was typed in last is the source of truth; the other is
  // derived on render, so the two can never disagree.
  const [amount, setAmount] = useState("100");
  const [side, setSide] = useState<"quote" | "base">("quote");

  const value = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
  const other = valid
    ? convert(value, rate, side === "quote" ? "toBase" : "toQuote")
    : null;

  const quoteValue = side === "quote" ? amount : other === null ? "" : trim(other);
  const baseValue = side === "base" ? amount : other === null ? "" : trim(other);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`המרה · ${rate.quote} ⇄ ${rate.base}`}
    >
      <div className="flex flex-col gap-4">
        {rates.length > 1 && (
          <div
            role="group"
            aria-label="מטבע"
            className="flex flex-wrap gap-1.5"
          >
            {rates.map((candidate) => {
              const active = candidate.quote === rate.quote;
              return (
                <button
                  key={candidate.quote}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(candidate.quote)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-surface text-foreground hover:bg-surface-2",
                  )}
                >
                  <span dir="ltr">{currencySymbol(candidate.quote).trim()}</span>
                  {candidate.quote}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <AmountBox
            label={rate.quote}
            symbol={currencySymbol(rate.quote)}
            value={quoteValue}
            onChange={(next) => {
              setSide("quote");
              setAmount(next);
            }}
          />
          <span className="flex h-10 items-center justify-center text-muted">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </span>
          <AmountBox
            label={rate.base}
            symbol={currencySymbol(rate.base)}
            value={baseValue}
            onChange={(next) => {
              setSide("base");
              setAmount(next);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => {
                setSide("quote");
                setAmount(String(quick));
              }}
              className="rounded-control border border-border-strong bg-surface px-2.5 py-1 text-caption font-semibold tabular-nums transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formatMoney(quick, rate.quote)}
            </button>
          ))}
        </div>

        <p className="text-caption text-muted">
          שער הבנק המרכזי האירופי ל-{rate.date.slice(8, 10)}.{rate.date.slice(5, 7)}
          {" · "}
          {rateLine(rate, formatMoney).forward}. הכרטיס שלכם עשוי לגבות עמלה נוספת.
        </p>
      </div>
    </Dialog>
  );
}

function AmountBox({
  label,
  symbol,
  value,
  onChange,
}: {
  label: string;
  symbol: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-semibold text-muted">
        {label} <span className="font-normal">({symbol.trim()})</span>
      </span>
      <Input
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-center text-base font-bold tabular-nums"
      />
    </label>
  );
}

function trim(amount: number): string {
  if (amount >= 100) return String(Math.round(amount));
  if (amount >= 10) return amount.toFixed(1).replace(/\.0$/, "");
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

// Stitch's "ממיר מטבע מהיר" (v6): the converter inline on the היום tab rather
// than behind a tile — an amount in the destination's currency on one side,
// what it is in shekels on the other, and the rate as a chip. The chip opens
// the full dialog, which is where another currency is picked.
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
  // A unit big enough to read: "1€ = 4.02 ₪", but "100¥ = 2.16 ₪" rather than
  // "1¥ = 0.02 ₪".
  const perOne = convert(1, rate, "toBase");
  const unit = perOne >= 0.1 ? 1 : perOne >= 0.01 ? 100 : 1000;
  const one = perOne * unit;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden="true" />
          <h4 className="text-base leading-[1.375rem] font-semibold text-foreground">
            ממיר מטבע מהיר
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          dir="ltr"
          className="rounded-full bg-surface-high px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-muted tabular-nums transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {unit}{currencySymbol(rate.quote)} = {trim(one)} {currencySymbol(rate.base)}
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <label className="flex min-w-0 flex-1 flex-col rounded-lg bg-surface-2 p-2">
          <span className="text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
            סכום ב-{rate.quote} ({currencySymbol(rate.quote)})
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full min-w-0 bg-transparent text-lg leading-6 font-semibold text-foreground tabular-nums focus:outline-none"
          />
        </label>
        <ArrowLeftRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col rounded-lg bg-surface-2 p-2">
          <span className="text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
            שווה ב-{rate.base} ({currencySymbol(rate.base)})
          </span>
          <span className="truncate text-lg leading-6 font-bold text-primary tabular-nums" dir="ltr">
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
