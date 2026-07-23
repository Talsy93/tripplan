// Basic in-memory fixed-window rate limiter.
//
// NOTE: state lives in the process, so on serverless (Vercel) each instance
// keeps its own counters — this is a lightweight guard for the free-tier
// quota, not a distributed limiter. Swap for Redis/Upstash if strict limits
// are needed later.

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || now > current.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, retryAfterMs: 0 };
}
