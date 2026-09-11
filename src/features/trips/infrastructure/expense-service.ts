import { createClient } from "@/lib/supabase/server";
import { dailyExpenseSchema, type DailyExpense } from "../domain/expenses";

export async function listExpenses(tripId: string): Promise<DailyExpense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_expenses")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("listExpenses failed:", error.message);
    return [];
  }
  return data.flatMap((row) => {
    const parsed = dailyExpenseSchema.safeParse({
      ...row,
      amount: Number(row.amount),
    });
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createExpense(input: {
  tripId: string;
  dayNumber: number;
  amount: number;
  currency: string;
  note: string | null;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_expenses").insert({
    trip_id: input.tripId,
    day_number: input.dayNumber,
    amount: input.amount,
    currency: input.currency,
    note: input.note,
  });
  if (error) console.error("createExpense failed:", error.message);
  return !error;
}

export async function updateExpense(
  id: string,
  patch: { amount: number; currency: string; note: string | null },
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_expenses")
    .update(patch, { count: "exact" })
    .eq("id", id);
  if (error) console.error("updateExpense failed:", error.message);
  return !error && count !== 0;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("trip_expenses")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("deleteExpense failed:", error.message);
  return !error && count !== 0;
}
