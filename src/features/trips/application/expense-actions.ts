"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { dailyExpenseFormSchema } from "../domain/expenses";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "../infrastructure/expense-service";

const tripIdSchema = z.uuid();

export type ExpenseResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

function firstErrors(error: z.ZodError<unknown>): Record<string, string> {
  const fieldErrors = z.flattenError(error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([key, messages]) =>
      messages?.[0] ? [[key, messages[0]]] : [],
    ),
  );
}

export async function addExpense(
  tripId: string,
  dayNumber: number,
  input: unknown,
): Promise<ExpenseResult> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 60) {
    return { ok: false, message: "יום לא תקין." };
  }
  const parsed = dailyExpenseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const ok = await createExpense({
    tripId,
    dayNumber,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    note: parsed.data.note?.trim() || null,
  });
  if (!ok) return { ok: false, message: "ההוספה נכשלה. נסו שוב." };

  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

export async function editExpense(
  tripId: string,
  id: string,
  input: unknown,
): Promise<ExpenseResult> {
  if (!tripIdSchema.safeParse(tripId).success) return { ok: false };
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const parsed = dailyExpenseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const ok = await updateExpense(id, {
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    note: parsed.data.note?.trim() || null,
  });
  if (!ok) return { ok: false, message: "העדכון נכשל. נסו שוב." };

  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: true };
}

export async function removeExpense(
  tripId: string,
  id: string,
): Promise<boolean> {
  if (!tripIdSchema.safeParse(tripId).success) return false;
  if (!z.uuid().safeParse(id).success) return false;
  const ok = await deleteExpense(id);
  if (ok) revalidatePath(`/trips/${tripId}`, "layout");
  return ok;
}
