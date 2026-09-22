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
// **The chain, best quality first.**
//
// Reported as "I hit overload really fast and can't get results". Researched in
// September 2026, and it turned out to be two different problems wearing one
// message:
//
//   503 UNAVAILABLE   shared serving capacity, measured per model and per
//                     version. Nothing to do with your usage — paid accounts
//                     see it too — and an overloaded pool can take 5–15 minutes
//                     to recover, which no in-request retry budget can wait out.
//   429 per-day       the free tier gives this model about **20 requests a
//                     day**. Twenty. See lib/ai/quota.ts, where that number is
//                     captured from a real 429 body rather than guessed.
//
// Both have the same answer, and it is the one fact that makes this cheap:
// **quota and capacity are per model.** Three models are three separate pools
// and three separate daily allowances, so falling through them adds up rather
// than averaging out — roughly 20 + 500 + 500 a day instead of 20, and a
// different serving pool each time something is busy.
//
// Ordered by quality, not by quota, and that ordering is the whole policy: the
// best model answers while it can, and the cheaper ones exist so that running
// out means a slightly weaker answer instead of no answer. Reversing it would
// trade the quality of every request for the reliability of the last few.
//
// All three are Google models on the same SDK and the same key. That is
// deliberate: every prompt and every answer in this app is in Hebrew, and
// swapping in a provider whose Hebrew is untested would buy quota with quality
// — which is the trade this is specifically trying not to make. Groq offers
// 1,000/day and strict JSON-schema decoding and is the obvious next step if
// this is not enough, but it needs a Hebrew comparison run against real
// prompts first, and only the owner can run those.
//
// Names are pinned rather than aliased, for the reason the previous version of
// this comment gives at length: `gemini-flash-latest` returned 503 on roughly
// two of every three requests while the pinned name returned 200 every time.
// The cost is that Google will retire these names and they must be updated by
// hand — a visible cost, unlike the alias's silent one.
const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

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

// How long a model is passed over after each kind of refusal.
//
// Not a guess at when it recovers — a bound on how often we are willing to
// spend a round trip finding out. Being wrong in either direction is cheap: too
// short wastes one request, too long uses a slightly weaker model for a while.
const COOLDOWN_MS = {
  // "Busy." Research puts real recovery at 5–15 minutes, but the in-request
  // retries above already covered the brief blips, so anything that reaches
  // here is the longer kind.
  unavailable: 5 * 60_000,
  // The per-minute cap, when the body did not say how long to wait.
  perMinute: 60_000,
  // The daily allowance. The true wait is until Google's reset, which the 429
  // body does not honestly report (quota.ts explains why its `retryDelay` lies
  // here). Half an hour rather than the rest of the day, deliberately: if this
  // classification is ever wrong, a good model is skipped for thirty minutes
  // instead of until tomorrow.
  perDay: 30 * 60_000,
} as const;

// Which models are being passed over, and until when.
//
// Module state, so it lives as long as the serverless instance and no longer.
// That is a real limit and it is fine: this is an optimisation that saves a
// wasted round trip on a warm instance, never a correctness mechanism. A cold
// instance simply tries the best model first, which is what it should do anyway
// — and the cooldown below is never allowed to block the *only* remaining
// attempt, so a stale map cannot lock the app out of its own provider.
const coolingUntil = new Map<string, number>();

function cool(model: string, ms: number, label: string, why: string) {
  coolingUntil.set(model, Date.now() + ms);
  console.warn(
    `[ai] ${label}: ${model} ${why}; passing over it for ${Math.round(ms / 1000)}s`,
  );
}

// How long this model still has to sit out, or 0 when it is available.
function coolingFor(model: string): number {
  return Math.max(0, (coolingUntil.get(model) ?? 0) - Date.now());
}

// Walks the chain until one model answers.
//
// Only the three "this model cannot help right now" failures move to the next
// one. Anything else — a bad schema, a missing key, a malformed prompt — fails
// the same way on every model, so trying two more would turn one clear error
// into three identical ones and three times the latency.
// Exported for the same reason isQuotaExceeded is: so the fall-through can be
// exercised against real ApiError bodies without calling the provider. The
// owner's free tier is 20 requests a day — a test that spends them to prove the
// fallback works would be spending the thing the fallback exists to protect.
export async function withModelChain<T>(
  label: string,
  call: (model: string) => Promise<T>,
): Promise<T> {
  // Available models first, then the rest in order of who frees up soonest.
  // Sorting rather than filtering is what guarantees there is always something
  // to try: when everything is cooling, the nearest one is attempted anyway.
  const order = [...MODEL_CHAIN].sort(
    (a, b) => coolingFor(a) - coolingFor(b),
  );

  let lastError: unknown;

  for (const [index, model] of order.entries()) {
    const waiting = coolingFor(model);
    // Skipped only while another model is still untried below it.
    if (waiting > 0 && index < order.length - 1) continue;

    try {
      const result = await withUnavailableRetry(label, () => call(model));
      // Logged on a fallback only. A line per successful call would bury the
      // one line that matters — that the first choice is no longer answering.
      if (model !== MODEL_CHAIN[0]) {
        console.warn(`[ai] ${label}: answered by ${model} (fallback)`);
      }
      return result;
    } catch (error) {
      lastError = error;

      if (isUnavailable(error)) {
        cool(model, COOLDOWN_MS.unavailable, label, "is overloaded");
        continue;
      }

      if (isQuotaExceeded(error)) {
        const raw = error instanceof Error ? error.message : String(error);
        const { window, retryAfterSeconds } = classifyQuotaError(raw);
        cool(
          model,
          window === "per-day"
            ? COOLDOWN_MS.perDay
            : (retryAfterSeconds ?? 0) * 1_000 || COOLDOWN_MS.perMinute,
          label,
          `hit its ${window} limit`,
        );
        continue;
      }

      // Not a capacity problem. The next model would fail identically.
      throw error;
    }
  }

  // Every model refused. The last refusal is the honest one to report: it is
  // the same *kind* of failure as the others by construction, and it carries a
  // real body for handleProviderError to classify.
  throw lastError;
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
    const response = await withModelChain("generateText", (model) =>
      ai.models.generateContent({
        model,
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
    const response = await withModelChain("generateStructured", (model) =>
      ai.models.generateContent({
        model,
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
