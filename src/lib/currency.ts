import type { ExchangeRate } from "@/features/trips/domain/currency";

// ECB reference rates via Frankfurter — free, no key, no quota to speak of.
// Rates update once a working day, so a 12-hour cache is generous, not stale.
// https://frankfurter.dev
const ENDPOINT = "https://api.frankfurter.dev/v1/latest";

// One request for every currency the trip touches. Frankfurter takes a list of
// symbols, so a trip through three countries costs the same call as one.
export async function getExchangeRates(
  base: string,
  quotes: string[],
): Promise<ExchangeRate[]> {
  const wanted = [...new Set(quotes)].filter((quote) => quote !== base);
  if (wanted.length === 0) return [];
  const params = new URLSearchParams({ base, symbols: wanted.join(",") });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      next: { revalidate: 43_200 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    if (!json.date || !json.rates) return [];
    const date = json.date;
    return wanted.flatMap((quote) => {
      const rate = json.rates?.[quote];
      return typeof rate === "number" && Number.isFinite(rate)
        ? [{ base, quote, rate, date }]
        : [];
    });
  } catch {
    return [];
  }
}

export async function getExchangeRate(
  base: string,
  quote: string,
): Promise<ExchangeRate | null> {
  const [rate] = await getExchangeRates(base, [quote]);
  return rate ?? null;
}
