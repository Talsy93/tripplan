"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Banner, Button, Dialog, Field, Input, useToast } from "@/components/ui";
import { convert } from "../domain/currency";
import type { ExchangeRate } from "../domain/currency";
import { expenseTotals, formatMoney } from "../domain/expenses";
import type { DailyExpense } from "../domain/expenses";
import {
  addExpense,
  editExpense,
  removeExpense,
} from "../application/expense-actions";

// The "today's spend" tile and the dialog behind it.
//
// The tile shows what was spent today in the local currency — and, when there
// is a rate, what that is in shekels. The dialog lists the day's expenses,
// lets you fix an amount (the receipt said something else), add one, remove
// one. Bookings' costs are not here: they were paid for before the trip and
// live under פרטי הטיול.
export function DailyExpensesTile({
  tripId,
  dayNumber,
  expenses,
  currency,
  rates = [],
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  // The currency to default a new expense to — today's country's.
  currency: string;
  // Every rate the trip has, so a total in any of its currencies converts.
  rates?: ExchangeRate[];
}) {
  const [open, setOpen] = useState(false);
  const totals = expenseTotals(expenses);
  const main = totals[0] ?? null;

  const mainRate = main ? rateFor(rates, main.currency) : null;
  const inHome =
    main && mainRate
      ? formatMoney(convert(main.total, mainRate, "toBase"), mainRate.base)
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card bg-surface shadow-card px-2 py-2.5 text-center transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center justify-center gap-1 text-caption font-semibold text-muted">
          <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">הוצאות היום</span>
        </span>
        <span className="min-w-0 truncate text-sm font-black tabular-nums">
          {main ? formatMoney(main.total, main.currency) : "—"}
        </span>
        <span className="min-w-0 truncate text-caption text-muted">
          {main
            ? totals.length > 1
              ? `ועוד ${totals.length - 1} מטבעות`
              : (inHome ?? `${expenses.length} פריטים`)
            : "הוסיפו הוצאה"}
        </span>
      </button>

      <ExpensesDialog
        tripId={tripId}
        dayNumber={dayNumber}
        expenses={expenses}
        currency={currency}
        rates={rates}
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

function ExpensesDialog({
  tripId,
  dayNumber,
  expenses,
  currency,
  rates,
  open,
  onClose,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  currency: string;
  rates: ExchangeRate[];
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>({ amount: "", currency, note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const totals = expenseTotals(expenses);

  function startNew() {
    setDraft({ amount: "", currency, note: "" });
    setErrors({});
    setMessage(null);
    setEditing("new");
  }

  function startEdit(expense: DailyExpense) {
    setDraft({
      amount: String(expense.amount),
      currency: expense.currency,
      note: expense.note ?? "",
    });
    setErrors({});
    setMessage(null);
    setEditing(expense.id);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editing === null) return;
    const input = {
      amount: Number(draft.amount.replace(",", ".")),
      currency: draft.currency,
      note: draft.note,
    };
    startTransition(async () => {
      const result =
        editing === "new"
          ? await addExpense(tripId, dayNumber, input)
          : await editExpense(tripId, editing, input);
      if (result.ok) {
        setEditing(null);
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    });
  }

  function remove(expense: DailyExpense) {
    startTransition(async () => {
      if (!(await removeExpense(tripId, expense.id))) {
        showToast("ההסרה נכשלה. נסו שוב.", "danger");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={`הוצאות · יום ${dayNumber}`}
    >
      <div className="flex flex-col gap-4">
        {totals.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {totals.map((total) => {
              const rate = rateFor(rates, total.currency);
              return (
                <span key={total.currency} className="flex flex-col">
                  <span className="text-title font-black tabular-nums">
                    {formatMoney(total.total, total.currency)}
                  </span>
                  {rate && (
                    <span className="text-caption tabular-nums text-muted">
                      ≈ {formatMoney(convert(total.total, rate, "toBase"), rate.base)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {expenses.length === 0 && editing === null && (
          <p className="text-sm text-muted">
            עוד לא הוזנו הוצאות להיום. ארוחות, כרטיסים בכניסה, מונית — כל מה
            שלא הוזמן מראש.
          </p>
        )}

        {expenses.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border">
            {expenses.map((expense) =>
              editing === expense.id ? (
                <li key={expense.id} className="p-3">
                  <ExpenseForm
                    draft={draft}
                    errors={errors}
                    pending={pending}
                    onChange={setDraft}
                    onSubmit={submit}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li
                  key={expense.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold tabular-nums">
                      {formatMoney(expense.amount, expense.currency)}
                    </span>
                    {expense.note && (
                      <span className="block truncate text-caption text-muted">
                        {expense.note}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(expense)}
                    aria-label="עריכת הסכום"
                    className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(expense)}
                    disabled={pending}
                    aria-label="הסרת ההוצאה"
                    className="rounded-control p-1.5 text-muted hover:bg-danger-tint hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {editing === "new" ? (
          <ExpenseForm
            draft={draft}
            errors={errors}
            pending={pending}
            onChange={setDraft}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Button type="button" variant="outline" onClick={startNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוספת הוצאה
          </Button>
        )}

        {message && <Banner tone="danger">{message}</Banner>}
      </div>
    </Dialog>
  );
}

function ExpenseForm({
  draft,
  errors,
  pending,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  errors: Record<string, string>;
  pending: boolean;
  onChange: (draft: Draft) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <Field label="סכום" error={errors.amount}>
          <Input
            inputMode="decimal"
            dir="ltr"
            autoFocus
            value={draft.amount}
            onChange={(event) => onChange({ ...draft, amount: event.target.value })}
            placeholder="2400"
            className="text-center font-bold tabular-nums"
            aria-invalid={Boolean(errors.amount)}
          />
        </Field>
        <Field label="מטבע" error={errors.currency}>
          <Input
            dir="ltr"
            maxLength={3}
            value={draft.currency}
            onChange={(event) =>
              onChange({ ...draft, currency: event.target.value.toUpperCase() })
            }
            className="text-center uppercase"
            aria-invalid={Boolean(errors.currency)}
          />
        </Field>
      </div>
      <Field label="על מה" error={errors.note}>
        <Input
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          placeholder="צהריים בשוק"
          maxLength={200}
        />
      </Field>
      <div className="flex justify-end gap-2">
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

// Stitch's expenses row on the היום tab (v6): a pale terracotta disc, "הוצאות
// היום ב…", the total with its shekel value beside it, and a deep terracotta
// "הוסף" that opens the same dialog the tile does.
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
      ? formatMoney(convert(main.total, mainRate, "toBase"), mainRate.base)
      : null;

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-card bg-surface p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta-tint text-cta-deep" aria-hidden="true">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
            הוצאות היום{city ? ` ב${city}` : ""}
          </span>
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="text-lg leading-6 font-bold text-foreground tabular-nums" dir="ltr">
              {main ? formatMoney(main.total, main.currency) : formatMoney(0, currency)}
            </span>
            {inHome && (
              <span className="truncate font-mono text-[0.625rem] text-muted" dir="ltr">
                (~{inHome})
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-card bg-cta-strong px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        הוסף
      </button>

      <ExpensesDialog
        tripId={tripId}
        dayNumber={dayNumber}
        expenses={expenses}
        currency={currency}
        rates={rates}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
