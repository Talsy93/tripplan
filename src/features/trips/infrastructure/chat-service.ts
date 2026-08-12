import { createClient } from "@/lib/supabase/server";
import type { ChatRole, TripChatMessage } from "../domain/chat";

// The trip's conversation, oldest first.
export async function listChatMessages(
  tripId: string,
): Promise<TripChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_chat_messages")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("listChatMessages failed:", error.message);
    return [];
  }
  return data as TripChatMessage[];
}

// Appends turns. Both sides of an exchange are written in one call so a reply
// can never be saved without the question that produced it.
export async function appendChatMessages(
  tripId: string,
  turns: { role: ChatRole; content: string }[],
) {
  if (turns.length === 0) return true;

  const supabase = await createClient();
  const { error } = await supabase.from("trip_chat_messages").insert(
    turns.map((turn) => ({
      trip_id: tripId,
      role: turn.role,
      content: turn.content,
    })),
  );

  if (error) {
    console.error("appendChatMessages failed:", error.message);
    return false;
  }
  return true;
}

export async function clearChat(tripId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_chat_messages")
    .delete()
    .eq("trip_id", tripId);

  if (error) {
    console.error("clearChat failed:", error.message);
    return false;
  }
  return true;
}
