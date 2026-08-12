"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { clearChat } from "../infrastructure/chat-service";

export async function resetChat(tripId: string) {
  const parsed = z.uuid().safeParse(tripId);
  if (!parsed.success) return false;

  const ok = await clearChat(parsed.data);
  if (ok) revalidatePath(`/trips/${parsed.data}`);
  return ok;
}
