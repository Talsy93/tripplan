import * as z from "zod";

// The trip planning conversation.
//
// Mirrors public.trip_chat_messages (migration 0010). "model" is the role name
// for the assistant's turns, matching the AI layer.

export const chatRoleSchema = z.enum(["user", "model"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatMessageSchema = z.object({
  id: z.uuid(),
  trip_id: z.uuid(),
  role: chatRoleSchema,
  content: z.string(),
  created_at: z.string(),
});
export type TripChatMessage = z.infer<typeof chatMessageSchema>;

export const sendChatRequestSchema = z.object({
  tripId: z.uuid(),
  message: z
    .string()
    .trim()
    .min(1, { error: "יש לכתוב הודעה." })
    .max(2000, { error: "ההודעה ארוכה מדי." }),
});
export type SendChatRequest = z.infer<typeof sendChatRequestSchema>;

// How much of the conversation to send back to the model.
//
// A trip's planning chat is not open-ended the way a general assistant's is,
// but it can still run long, and every turn is re-sent on every request — cost
// and latency grow with the square of the conversation otherwise. The oldest
// turns are the ones the answer depends on least.
export const MAX_HISTORY_TURNS = 24;

export function recentHistory<T>(messages: T[]): T[] {
  return messages.slice(-MAX_HISTORY_TURNS);
}
