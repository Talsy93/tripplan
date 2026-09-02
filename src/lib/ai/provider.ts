import { ApiError, GoogleGenAI } from "@google/genai";
import * as z from "zod";
import { classifyQuotaError, parseQuotaLimit } from "./quota";

// Provider-agnostic entry point for structured generation. The rest of the app
// depends only on this function; swapping Gemini for another provider means
// changing this file alone.
//
// A single Zod schema does double duty: it constrains the model's output
// (converted to JSON Schema) and validates the response.

// Pinned, not the "-latest" alias. The alias was tried first specifically to
// avoid this file needing updates when a model is retired (as gemini-2.5-flash
// was for new users) — but it turned out to be the cause of a real outage, not
// the fix for one. Direct calls to the API (bypassing this app entirely) showed
// `gemini-flash-latest` returning 503 UNAVAILABLE on roughly 2 of every 3
// requests, while `gemini-3.6-flash` — the exact model Google's own 404 message
// for the deprecated gemini-2.5-flash names as the replacement — returned 200
// every time. The alias appears to route partial traffic to an overloaded
// preview tier; a named version does not.
//
// The tradeoff this reintroduces: Google will eventually retire this name too,
// and it will need to be updated here by hand. That is a known, visible cost.
// The alias's silent failure mode was worse.
const MODEL = "gemini-3.6-flash";

// Thrown when Gemini's free-tier daily quota is exhausted (HTTP 429 from the
// API itself — distinct from our own in-app rate limiter). Routes catch this
// specifically so the user sees "the quota ran out, try tomorrow" instead of
// a generic failure that implies retrying now would help.
export class AiQuotaExceededError extends Error {
  constructor(cause: unknown) {
    super("Gemini quota exceeded", { cause });
    this.name = "AiQuotaExceededError";
  }
}

// Also an HTTP 429, and for a while it was reported as the one above — which is
// how a user who pressed a button three times in a row got told to come back
// tomorrow. The free tier's per-minute cap clears in seconds; the daily one does
// not. Same status, opposite advice, so they cannot share a class.
export class AiRateLimitedError extends Error {
  readonly retryAfterSeconds: number | null;

  constructor(cause: unknown, retryAfterSeconds: number | null) {
    super("AI provider rate limited", { cause });
    this.name = "AiRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Thrown when Gemini itself is overloaded — HTTP 503 UNAVAILABLE, "this model
// is currently experiencing high demand". A third state, distinct from both of
// the above: the quota is fine and nothing is broken, it is busy. Waiting a
// moment genuinely helps, which is the opposite of the quota case.
//
// Observed in practice while verifying C5: two consecutive 503s, then success.
export class AiUnavailableError extends Error {
  constructor(cause: unknown) {
    super("AI provider unavailable", { cause });
    this.name = "AiUnavailableError";
  }
}

// Exported only for their edge-case tests, not for use outside this module —
// the API surface routes depend on is the two error classes.
export function isQuotaExceeded(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

export function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

// Every AI call used to end in a bare `catch { return 502 }`, so a failure
// was indistinguishable from a quota limit and neither left a trace — the
// only way to diagnose "AI stopped working" was to guess. This is the single
// place all seven routes funnel through, so logging and classifying here
// covers all of them.
function handleProviderError(label: string, error: unknown): never {
  console.error(`[ai] ${label} failed:`, error);
  if (isQuotaExceeded(error)) {
    // 429 covers both windows. The body says which, when it says anything —
    // see lib/ai/quota.ts.
    const raw = error instanceof Error ? error.message : String(error);
    const { window, retryAfterSeconds } = classifyQuotaError(raw);

    // Logged as one line with the numbers on it, so diagnosing this from the
    // hosting logs does not require re-deriving it from the raw body. The
    // observed free-tier body says "limit: 20" and "retry in 15.6s" and names no
    // window at all, which is what made the first attempt at this misclassify.
    console.error(
      `[ai] quota: window=${window} limit=${parseQuotaLimit(raw) ?? "?"} retryAfter=${retryAfterSeconds ?? "?"}s`,
    );

    if (window === "per-minute") {
      throw new AiRateLimitedError(error, retryAfterSeconds);
    }
    throw new AiQuotaExceededError(error);
  }
  if (isUnavailable(error)) {
    throw new AiUnavailableError(error);
  }
  throw error;
}

// How many extra attempts a 503 gets, and how long to wait before each.
//
// 503 UNAVAILABLE is Google saying "this model is currently experiencing high
// demand. Spikes in demand are usually temporary. Please try again later" —
// their words, verbatim, and they are describing something that clears in
// under a second. Until this existed the app took them at their word and made
// the *user* do the trying again: one unlucky request became "שירות ה-AI עמוס
// כרגע", while the very next one would have worked.
//
// Measured against the live API while diagnosing exactly that report: twelve
// structured calls returned one 503 among them, with the rest fine. A single
// blip in twelve is invisible with two retries and is an error page without
// them.
//
// **Only 503.** Retrying a 429 is worse than useless: the quota is the thing
// being exceeded, so another attempt spends a request that cannot succeed and
// pushes the window further out. That is why AiRateLimitedError and
// AiQuotaExceededError are separate classes from AiUnavailableError, and this
// is the first thing that depends on the distinction.
//
// Two extra attempts and 1.4s of worst-case added latency, which has to stay
// small: these calls already run for several seconds inside a serverless
// function with its own timeout, and a retry budget that risks the timeout
// trades a visible error for a mysterious one.
const UNAVAILABLE_RETRY_DELAYS_MS = [400, 1_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs `call`, retrying only the overloaded case.
//
// Wraps the provider call rather than living inside handleProviderError,
// because that function's job is to classify a failure that has already
// happened — it throws, and something that throws cannot retry. The retry has
// to sit above it, where the call itself can be made again.
async function withUnavailableRetry<T>(
  label: string,
  call: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const delay = UNAVAILABLE_RETRY_DELAYS_MS[attempt];
      // Out of attempts, or a failure that retrying cannot fix. Either way the
      // error goes on to be classified and reported as it always was.
      if (delay === undefined || !isUnavailable(error)) throw error;

      // Logged at every retry, not only at the end. "The AI is slow sometimes"
      // and "the AI fails and recovers" look identical from the outside, and
      // the hosting logs are the only place the difference is visible.
      console.warn(
        `[ai] ${label}: 503 from provider, retrying in ${delay}ms (attempt ${attempt + 1} of ${UNAVAILABLE_RETRY_DELAYS_MS.length})`,
      );
      await sleep(delay);
    }
  }
}

// A turn in a conversation. "model" rather than "assistant" because that is
// what Gemini calls it; the name stops here — nothing outside this file needs
// to know whose vocabulary it is.
export type ChatMessage = { role: "user" | "model"; text: string };

// Multi-turn plain-text generation, for the trip chat.
//
// Separate from generateStructured rather than an option on it: one returns
// prose to a person, the other returns a validated object to the database, and
// collapsing them would mean a function whose return type depends on a flag.
export async function generateText(params: {
  messages: ChatMessage[];
  systemInstruction?: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withUnavailableRetry("generateText", () =>
      ai.models.generateContent({
        model: MODEL,
        contents: params.messages.map((message) => ({
          role: message.role,
          parts: [{ text: message.text }],
        })),
        config: params.systemInstruction
          ? { systemInstruction: params.systemInstruction }
          : undefined,
      }),
    );

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI provider");
    }
    return text;
  } catch (error) {
    return handleProviderError("generateText", error);
  }
}

export async function generateStructured<T>(params: {
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const jsonSchema = z.toJSONSchema(params.schema) as Record<string, unknown>;
  // Gemini's responseJsonSchema does not accept the top-level $schema key.
  delete jsonSchema["$schema"];

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withUnavailableRetry("generateStructured", () =>
      ai.models.generateContent({
        model: MODEL,
        contents: params.prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      }),
    );

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI provider");
    }

    return params.schema.parse(JSON.parse(text));
  } catch (error) {
    return handleProviderError("generateStructured", error);
  }
}
