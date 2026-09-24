"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Banner, Button, Dialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { convert } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { currencySymbol, expenseTotals, formatMoney } from "../domain/expenses";
import type { DailyExpense } from "../domain/expenses";
import {
  addExpense,
  editExpense,
  removeExpense,
} from "../application/expense-actions";
import { toolTileClasses, ToolTileBody } from "./tool-tile";

// The "today's spend" tile and the sheet behind it.
//
// The tile shows what was spent today in the local currency. The sheet (Pencil,
// v7) has the total with its shekel value, the day's expenses as rows — tap one
// to fix its amount or remove it — and a quick-add line at the foot with the
// screen's one orange button. Bookings' costs are not here: they were paid for
// before the trip and live under פרטי הטיול.
export function DailyExpensesTile({
  tripId,
  dayNumber,
  expenses,
  currency,
  rates = [],
  city = null,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  // The currency to default a new expense to — today's country's.
  currency: string;
  // Every rate the trip has, so a total in any of its currencies converts.
  rates?: ExchangeRate[];
  // For the sheet's subtitle, "יום 3 · רומא".
  city?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const totals = expenseTotals(expenses);
  const main = totals[0] ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={toolTileClasses}
      >
        <ToolTileBody
          icon={<Wallet />}
          value={main ? formatMoney(main.total, main.currency) : formatMoney(0, currency)}
          valueDir="ltr"
          label={
            totals.length > 1
              ? `הוצאות היום · ועוד ${totals.length - 1}`
              : "הוצאות היום"
          }
        />
      </button>

      <ExpensesDialog
        tripId={tripId}
        dayNumber={dayNumber}
        expenses={expenses}
        currency={currency}
        rates={rates}
        city={city}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

type Draft = { amount: string; currency: string; note: string };

function rateFor(rates: ExchangeRate[], currency: string): ExchangeRate | null {
  return rates.find((rate) => rate.quote === currency) ?? null;
}

// The currencies an expense can be entered in: today's, every one the trip
// touches, and home — plus, when fixing an old row, whatever it was entered in.
function currencyOptions(
  currency: string,
  rates: ExchangeRate[],
  extra?: string,
): string[] {
  return [
    ...new Set(
      [currency, ...rates.map((rate) => rate.quote), rates[0]?.base, extra].filter(
        (code): code is string => Boolean(code),
      ),
    ),
  ];
}

function ExpensesDialog({
  tripId,
  dayNumber,
  expenses,
  currency,
  rates,
  city,
  open,
  onClose,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  currency: string;
  rates: ExchangeRate[];
  city: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const empty: Draft = { amount: "", currency, note: "" };
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(empty);
  const [newDraft, setNewDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const totals = expenseTotals(expenses);
  const main = totals[0] ?? null;
  const mainRate = main ? rateFor(rates, main.currency) : null;

  function startEdit(expense: DailyExpense) {
    setEditDraft({
      amount: String(expense.amount),
      currency: expense.currency,
      note: expense.note ?? "",
    });
    setErrors({});
    setMessage(null);
    setEditing(expense.id);
  }

  function toInput(draft: Draft) {
    return {
      amount: Number(draft.amount.replace(",", ".")),
      currency: draft.currency,
      note: draft.note,
    };
  }

  function submitNew(event: React.FormEvent) {
    event.preventDefault();
    setEditing(null);
    startTransition(async () => {
      const result = await addExpense(tripId, dayNumber, toInput(newDraft));
      if (result.ok) {
        setNewDraft({ amount: "", currency: newDraft.currency, note: "" });
        setErrors({});
        setMessage(null);
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    });
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    if (editing === null) return;
    const id = editing;
    startTransition(async () => {
      const result = await editExpense(tripId, id, toInput(editDraft));
      if (result.ok) {
        setEditing(null);
        setErrors({});
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    });
  }

  function remove(expense: DailyExpense) {
    startTransition(async () => {
      if (await removeExpense(tripId, expense.id)) {
        setEditing(null);
      } else {
        showToast("ההסרה נכשלה. נסו שוב.", "danger");
      }
    });
  }

  // Field errors belong to whichever form was submitted last: the row being
  // edited when there is one, the quick-add line otherwise.
  const newErrors = editing === null ? errors : {};

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={
        <>
          <span className="block">הוצאות היום</span>
          <span className="mt-0.5 block text-sm leading-5 font-normal text-muted">
            יום {dayNumber}
            {city ? ` · ${city}` : ""}
          </span>
        </>
      }
      footer={
        <button
          type="submit"
          form={`new-expense-${dayNumber}`}
          disabled={pending}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-base font-bold text-cta-foreground shadow-card transition-colors hover:bg-cta-hover active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          הוספת הוצאה
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-end justify-between gap-3 rounded-[1.25rem] bg-surface-2 p-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm text-muted">סה״כ היום</span>
            <span dir="ltr" className="text-end text-[2rem] leading-10 font-bold tabular-nums text-foreground">
              {main ? formatMoney(main.total, main.currency) : formatMoney(0, currency)}
            </span>
            {totals.slice(1).map((total) => (
              <span key={total.currency} dir="ltr" className="text-end text-sm font-semibold tabular-nums text-muted">
                + {formatMoney(total.total, total.currency)}
              </span>
            ))}
          </div>
          {main && mainRate && (
            <span dir="ltr" className="shrink-0 pb-1 text-base font-semibold tabular-nums text-muted">
              ≈ {formatMoney(Math.round(convert(main.total, mainRate, "toBase")), mainRate.base)}
            </span>
          )}
        </div>

        {expenses.length === 0 ? (
          <p className="text-sm text-muted">
            עוד לא הוזנו הוצאות להיום. ארוחות, כרטיסים בכניסה, מונית — כל מה
            שלא הוזמן מראש.
          </p>
        ) : (
          <ul className="flex flex-col">
            {expenses.map((expense) => {
              const rate =
                expense.currency !== rates[0]?.base ? rateFor(rates, expense.currency) : null;
              return (
                <li
                  key={expense.id}
                  className="border-b border-border last:border-b-0"
                >
                  {editing === expense.id ? (
                    <div className="py-3">
                      <ExpenseForm
                        draft={editDraft}
                        options={currencyOptions(currency, rates, expense.currency)}
                        errors={errors}
                        pending={pending}
                        onChange={setEditDraft}
                        onSubmit={submitEdit}
                        onCancel={() => setEditing(null)}
                        onRemove={() => remove(expense)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(expense)}
                      aria-label={`עריכת ${expense.note ?? "ההוצאה"}`}
                      className="flex min-h-14 w-full min-w-0 items-center gap-3 py-2.5 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta-tint text-cta-ink"
                      >
                        <Receipt className="h-5 w-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base leading-6 font-semibold text-foreground">
                          {expense.note || "הוצאה"}
                        </span>
                        {rate && (
                          <span dir="ltr" className="text-end text-xs text-muted tabular-nums">
                            ≈ {formatMoney(Math.round(convert(expense.amount, rate, "toBase")), rate.base)}
                          </span>
                        )}
                      </span>
                      <span dir="ltr" className="shrink-0 text-base font-bold tabular-nums text-foreground">
                        {formatMoney(expense.amount, expense.currency)}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* The quick-add line. Always open: adding is what the sheet is opened
            for nine times out of ten, and the orange button at the foot
            submits it. */}
        <form
          id={`new-expense-${dayNumber}`}
          onSubmit={submitNew}
          className="flex flex-col gap-1.5"
        >
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
            <input
              value={newDraft.note}
              onChange={(event) => setNewDraft({ ...newDraft, note: event.target.value })}
              placeholder="על מה?"
              aria-label="על מה"
              maxLength={200}
              aria-invalid={Boolean(newErrors.note)}
              className="min-h-14 w-full min-w-0 rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none"
            />
            <AmountField
              draft={newDraft}
              options={currencyOptions(currency, rates)}
              invalid={Boolean(newErrors.amount || newErrors.currency)}
              onChange={setNewDraft}
            />
          </div>
          {(newErrors.amount || newErrors.currency || newErrors.note) && (
            <p className="text-xs text-danger">
              {newErrors.amount ?? newErrors.currency ?? newErrors.note}
            </p>
          )}
        </form>

        {message && <Banner tone="danger">{message}</Banner>}
      </div>
    </Dialog>
  );
}

// "€ 0" in a teal outline: the amount, with the currency as a small picker
// in front of it.
function AmountField({
  draft,
  options,
  invalid,
  onChange,
  autoFocus = false,
}: {
  draft: Draft;
  options: string[];
  invalid: boolean;
  onChange: (draft: Draft) => void;
  autoFocus?: boolean;
}) {
  return (
    <div
      dir="ltr"
      className={cn(
        "flex min-h-14 min-w-0 items-center gap-1 rounded-2xl border-2 bg-surface px-3 focus-within:border-primary",
        invalid ? "border-danger" : "border-primary",
      )}
    >
      <span className="relative flex shrink-0 items-center gap-0.5 text-base font-semibold text-muted">
        {currencySymbol(draft.currency).trim()}
        {options.length > 1 && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
        {options.length > 1 && (
          <select
            aria-label="מטבע"
            value={draft.currency}
            onChange={(event) => onChange({ ...draft, currency: event.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {options.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        )}
      </span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={draft.amount}
        onChange={(event) => onChange({ ...draft, amount: event.target.value })}
        placeholder="0"
        aria-label="סכום"
        aria-invalid={invalid}
        className="w-full min-w-0 bg-transparent text-xl! font-bold tabular-nums text-foreground placeholder:text-placeholder focus:outline-none"
      />
    </div>
  );
}

// Fixing one row, in place: the same two fields as the quick-add line, and
// save / cancel / remove.
function ExpenseForm({
  draft,
  options,
  errors,
  pending,
  onChange,
  onSubmit,
  onCancel,
  onRemove,
}: {
  draft: Draft;
  options: string[];
  errors: Record<string, string>;
  pending: boolean;
  onChange: (draft: Draft) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
        <input
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          placeholder="על מה?"
          aria-label="על מה"
          maxLength={200}
          className="min-h-12 w-full min-w-0 rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none"
        />
        <AmountField
          draft={draft}
          options={options}
          invalid={Boolean(errors.amount || errors.currency)}
          onChange={onChange}
          autoFocus
        />
      </div>
      {(errors.amount || errors.currency || errors.note) && (
        <p className="text-xs text-danger">
          {errors.amount ?? errors.currency ?? errors.note}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="me-auto flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          הסרה
        </button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          ביטול
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          שמירה
        </Button>
      </div>
    </form>
  );
}

// The expenses as one full-width row: an icon, "הוצאות היום ב…", the total with
// its shekel value beside it, and "הוספה", which opens the same sheet the tile
// does. The day screen now uses the tile; this stays for wider layouts.
export function DailyExpensesCard({
  tripId,
  dayNumber,
  expenses,
  currency,
  rates = [],
  city,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  currency: string;
  rates?: ExchangeRate[];
  city?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const totals = expenseTotals(expenses);
  const main = totals[0] ?? null;
  const mainRate = main ? rateFor(rates, main.currency) : null;
  const inHome =
    main && mainRate
      ? formatMoney(Math.round(convert(main.total, mainRate, "toBase")), mainRate.base)
      : null;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-[1.25rem] bg-surface p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary" aria-hidden="true">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs text-muted">
            הוצאות היום{city ? ` ב${city}` : ""}
          </span>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-lg leading-6 font-bold text-foreground tabular-nums" dir="ltr">
              {main ? formatMoney(main.total, main.currency) : formatMoney(0, currency)}
            </span>
            {inHome && (
              <span className="truncate text-xs text-muted tabular-nums" dir="ltr">
                ≈ {inHome}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        הוספה
      </button>

      <ExpensesDialog
        tripId={tripId}
        dayNumber={dayNumber}
        expenses={expenses}
        currency={currency}
        rates={rates}
        city={city ?? null}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
