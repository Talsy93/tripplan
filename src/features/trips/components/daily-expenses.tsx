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
  rate,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  // The currency to default a new expense to — the destination's.
  currency: string;
  rate: ExchangeRate | null;
}) {
  const [open, setOpen] = useState(false);
  const totals = expenseTotals(expenses);
  const main = totals[0] ?? null;

  const inHome =
    main && rate && main.currency === rate.quote
      ? formatMoney(convert(main.total, rate, "toBase"), rate.base)
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-card border border-border bg-surface px-2 py-2.5 text-center transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        rate={rate}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

type Draft = { amount: string; currency: string; note: string };

function ExpensesDialog({
  tripId,
  dayNumber,
  expenses,
  currency,
  rate,
  open,
  onClose,
}: {
  tripId: string;
  dayNumber: number;
  expenses: DailyExpense[];
  currency: string;
  rate: ExchangeRate | null;
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
            {totals.map((total) => (
              <span key={total.currency} className="flex flex-col">
                <span className="text-title font-black tabular-nums">
                  {formatMoney(total.total, total.currency)}
                </span>
                {rate && total.currency === rate.quote && (
                  <span className="text-caption tabular-nums text-muted">
                    ≈ {formatMoney(convert(total.total, rate, "toBase"), rate.base)}
                  </span>
                )}
              </span>
            ))}
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
