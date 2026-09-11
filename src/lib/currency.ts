import type { ExchangeRate } from "@/features/trips/domain/currency";

// ECB reference rates via Frankfurter — free, no key, no quota to speak of.
// Rates update once a working day, so a 12-hour cache is generous, not stale.
// https://frankfurter.dev
const ENDPOINT = "https://api.frankfurter.dev/v1/latest";

export async function getExchangeRate(
  base: string,
  quote: string,
): Promise<ExchangeRate | null> {
  if (base === quote) return null;
  const params = new URLSearchParams({ base, symbols: quote });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      next: { revalidate: 43_200 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      base?: string;
      date?: string;
      rates?: Record<string, number>;
    };
    const rate = json.rates?.[quote];
    if (typeof rate !== "number" || !Number.isFinite(rate) || !json.date) {
      return null;
    }
    return { base, quote, rate, date: json.date };
  } catch {
    return null;
  }
}
