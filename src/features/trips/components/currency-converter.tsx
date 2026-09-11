"use client";

import { useState } from "react";
import { ArrowLeftRight, Coins } from "lucide-react";
import { Dialog, Input } from "@/components/ui";
import { convert, rateLine } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { currencySymbol, formatMoney } from "../domain/expenses";

// The money tile on the day screen and the converter behind it.
//
// The tile says the two lines a traveller actually needs at a glance — what
// one shekel buys, and what a round amount of the local money costs. Tapping
// it opens a two-way converter: type in either box and the other follows.
export function CurrencyTile({ rate }: { rate: ExchangeRate | null }) {
  const [open, setOpen] = useState(false);

  if (!rate) {
    return (
      <div className="flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card border border-border bg-surface px-2 py-2.5 text-center">
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card border border-border bg-surface px-2 py-2.5 text-center transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center justify-center gap-1 text-caption font-semibold text-muted">
          <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{rate.quote}</span>
        </span>
        <span className="min-w-0 truncate text-sm font-black tabular-nums" dir="ltr">
          {lines.forward}
        </span>
        <span className="min-w-0 truncate text-caption tabular-nums text-muted" dir="ltr">
          {lines.backward}
        </span>
      </button>

      <ConverterDialog rate={rate} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const QUICK = [10, 50, 100, 500, 1000, 5000];

function ConverterDialog({
  rate,
  open,
  onClose,
}: {
  rate: ExchangeRate;
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
