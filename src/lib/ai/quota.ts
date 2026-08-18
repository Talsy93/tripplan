// Telling a per-minute rate limit apart from a per-day quota.
//
// Google answers 429 RESOURCE_EXHAUSTED for both, and the app used to call every
// 429 "the daily quota ran out, come back tomorrow". That advice is wrong half
// the time and expensively so: the per-minute cap on the free tier clears in
// well under a minute, and a user who presses a button four times while
// debugging trips it easily. Being told to come back tomorrow, when in fact
// waiting thirty seconds would do, is the kind of error message that makes an
// app look broken when it is working.
//
// The signal is in the error body, which @google/genai flattens into
// ApiError.message. Two fields matter:
//
//   QuotaFailure.violations[].quotaId  e.g. "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"
//                                      or  "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
//   RetryInfo.retryDelay               e.g. "31s"
//
// No imports on purpose: this is a pure string classifier, which is what lets it
// be tested directly rather than through a mocked SDK.

export type QuotaWindow = "per-minute" | "per-day";

export type QuotaClassification = {
  window: QuotaWindow;
  // Seconds Google asked us to wait, when it said. Null when absent — the
  // caller should not invent a number.
  retryAfterSeconds: number | null;
};

// Anything longer than this is not a "wait a moment" situation, whatever the
// quota is called. Five minutes is generous for a per-minute window and far
// below the hours a daily reset implies.
const SHORT_WINDOW_LIMIT_SECONDS = 300;

function parseRetryDelay(message: string): number | null {
  // "retryDelay":"31s" — also tolerates "31.5s" and a bare number of seconds.
  const match = /"retryDelay"\s*:\s*"?(\d+(?:\.\d+)?)s?"?/i.exec(message);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;

  return Math.ceil(seconds);
}

export function classifyQuotaError(message: string): QuotaClassification {
  const retryAfterSeconds = parseRetryDelay(message);

  // The quota's own name is the most reliable signal, so it is read first.
  // Checked in this order because a body can mention both windows — a request
  // that exhausts the daily allowance also exhausts the minute — and the daily
  // one is the constraint that actually holds.
  if (/per\s*-?\s*day/i.test(message)) {
    return { window: "per-day", retryAfterSeconds };
  }
  if (/per\s*-?\s*minute/i.test(message)) {
    return { window: "per-minute", retryAfterSeconds };
  }

  // No quota name. A short retry delay still says plainly that waiting works.
  if (
    retryAfterSeconds !== null &&
    retryAfterSeconds <= SHORT_WINDOW_LIMIT_SECONDS
  ) {
    return { window: "per-minute", retryAfterSeconds };
  }

  // Nothing to go on. Reads as the daily quota, which is the same conservative
  // default the app already applied to an unrecognised 503: telling someone to
  // retry something that cannot succeed until tomorrow wastes more of their
  // time than the reverse.
  return { window: "per-day", retryAfterSeconds };
}
