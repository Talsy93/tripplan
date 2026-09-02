// Telling a per-minute rate limit apart from a per-day quota.
//
// Google answers 429 RESOURCE_EXHAUSTED for both, and the app used to call every
// 429 "the daily quota ran out, come back tomorrow". That advice is wrong half
// the time and expensively so: the per-minute cap on the free tier clears in
// well under a minute, and a user who presses a button a few times while
// debugging trips it easily. Being told to come back tomorrow, when waiting
// fifteen seconds would do, makes a working app look broken.
//
// The signal is in the error body, which @google/genai flattens into
// ApiError.message.
//
// The first version of this file guessed that shape and guessed wrong, which is
// why a per-minute limit went on being reported as the daily quota even after it
// was "fixed".
//
// The second version — this comment — then described the body from memory of a
// truncated log and got it wrong in the other direction. It claimed "there is no
// RetryInfo.retryDelay field, and the metric name mentions neither window", and
// captured against the live API in September 2026 both halves are false. What
// `ApiError.message` actually holds is the *entire* JSON body, `details` and
// all:
//
//   {"error":{"code":429,
//     "message":"... * Quota exceeded for metric:
//       generativelanguage.googleapis.com/generate_content_free_tier_requests,
//       limit: 20, model: gemini-3.6-flash
//       Please retry in 29.010467571s.",
//     "status":"RESOURCE_EXHAUSTED",
//     "details":[...
//       {"@type":".../QuotaFailure","violations":[{
//         "quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier",
//         "quotaValue":"20"}]},
//       {"@type":".../RetryInfo","retryDelay":"29s"}]}}
//
// Two things follow, and the second is the one that matters:
//
//   * The window IS named, in `quotaId` — "…PerDay…". The /per-?day/ test below
//     matches it, which is why a 429 on this model classifies correctly today.
//   * `retryDelay` and the prose "retry in 29s" are both present and both
//     MISLEADING on a daily quota. Google says 29 seconds; the quota resets
//     tomorrow. That is why the window name is checked before the delay and not
//     after it — reversing those two lines would tell a reader out of requests
//     for the day to try again in half a minute, forever.
//
// The free-tier ceiling this model reports is 20 requests per DAY, not per
// minute. Worth knowing before assuming a "quota exceeded" report is heavy use:
// twenty is a morning's worth of ordinary clicking.
//
// No imports on purpose: this is a pure string classifier, which is what lets it
// be tested against real captured bodies instead of through a mocked SDK.

export type QuotaWindow = "per-minute" | "per-day";

export type QuotaClassification = {
  window: QuotaWindow;
  // Seconds Google asked us to wait, when it said. Null when absent — the
  // caller must not invent a number.
  retryAfterSeconds: number | null;
};

// Anything longer than this is not a "wait a moment" situation, whatever the
// quota is called. Five minutes is generous for a per-minute window and far
// below the hours a daily reset implies.
const SHORT_WINDOW_LIMIT_SECONDS = 300;

function parseRetryDelay(message: string): number | null {
  // Prose first, because that is the form actually seen in production:
  // "Please retry in 15.659996788s."
  const prose = /retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i.exec(message);
  // The structured form, sent by other models and tiers.
  const field = /"?retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s?"?/i.exec(message);

  const raw = prose?.[1] ?? field?.[1];
  if (raw === undefined) return null;

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;

  // Rounded up: saying "wait 15 seconds" when the server said 15.66 sends the
  // reader back a moment too early, straight into the same error.
  return Math.ceil(seconds);
}

// The per-window request cap, when the message states it — "limit: 20". Used for
// the server log only: it is the number that explains why this keeps happening.
export function parseQuotaLimit(message: string): number | null {
  const match = /limit:\s*(\d+)/i.exec(message);
  if (!match) return null;
  const limit = Number(match[1]);
  return Number.isFinite(limit) ? limit : null;
}

export function classifyQuotaError(message: string): QuotaClassification {
  const retryAfterSeconds = parseRetryDelay(message);

  // An explicit window name is the most reliable signal when it is there. Day is
  // checked first because a body can name both — a request that exhausts the day
  // also exhausts the minute — and the daily one is the constraint that holds.
  if (/per\s*-?\s*day/i.test(message)) {
    return { window: "per-day", retryAfterSeconds };
  }
  if (/per\s*-?\s*minute/i.test(message)) {
    return { window: "per-minute", retryAfterSeconds };
  }

  // No window named — the common case. A short retry delay says plainly that
  // waiting works, and it is the only thing the observed body gives us.
  if (
    retryAfterSeconds !== null &&
    retryAfterSeconds <= SHORT_WINDOW_LIMIT_SECONDS
  ) {
    return { window: "per-minute", retryAfterSeconds };
  }

  // Nothing to go on. Reads as the daily quota, the same conservative default
  // the app already applied to an unrecognised 503: telling someone to retry
  // something that cannot succeed until tomorrow wastes more of their time than
  // the reverse.
  return { window: "per-day", retryAfterSeconds };
}
