// What to tell the user when an AI request fails.
//
// Every AI-backed screen had its own copy of the same branches, which is how
// the 503 "busy" case ended up handled in none of them. One rule, in one place.
//
// The three failure states an AI route can report are deliberately distinct,
// because the right thing for the reader to do differs in each:
//   429 ai_rate_limited  — our own limiter. Wait a moment.
//   503 ai_quota_exceeded — the free tier's daily quota. Come back tomorrow.
//   503 ai_busy           — the provider is overloaded. Try again shortly.
// Collapsing any two of them produces advice that is wrong half the time.

// The error codes an AI route puts in its response body.
export type AiErrorCode =
  | "ai_quota_exceeded"
  | "ai_busy"
  | "ai_failed"
  | "rate_limited";

const RATE_LIMITED = "יותר מדי בקשות. נסו שוב בעוד רגע.";
const QUOTA_EXCEEDED = "מכסת ה-AI היומית נגמרה. נסו שוב מחר.";
const BUSY = "שירות ה-AI עמוס כרגע. נסו שוב בעוד רגע.";

// Pure: the message for a given status and body code.
//
// `fallback` is the screen's own wording for a generic failure ("building the
// itinerary failed"), which is more useful than one shared sentence.
//
// Both quota and busy are 503 — the honest status for either — so the body's
// code is what tells them apart. A 503 with no recognisable code is read as
// quota: it is the more common cause and the more conservative advice, since
// telling someone to retry a request that cannot succeed until tomorrow wastes
// their time.
export function aiErrorMessage(
  status: number,
  code: string | undefined,
  fallback: string,
): string {
  if (status === 429) return RATE_LIMITED;
  if (status === 503) return code === "ai_busy" ? BUSY : QUOTA_EXCEEDED;
  return fallback;
}

// Reads the code out of a failed response and picks the message.
//
// The body is parsed defensively: a proxy or a crash can return HTML where JSON
// was expected, and that must not turn a handled failure into a thrown one.
export async function aiErrorFromResponse(
  response: Response,
  fallback: string,
): Promise<string> {
  let code: string | undefined;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body?.error === "string") code = body.error;
  } catch {
    // Leave it undefined and let the status decide.
  }
  return aiErrorMessage(response.status, code, fallback);
}
