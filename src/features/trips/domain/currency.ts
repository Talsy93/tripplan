// Which money a destination uses, and how to turn one amount into another.
//
// The rate itself is fetched in lib/currency.ts (ECB reference rates through
// Frankfurter, free and keyless). This file is the part that does not need a
// network: the country → currency table, the choice of *which* currency a trip
// is in, and the arithmetic.

// ISO 3166-1 alpha-2 → ISO 4217. Only the currencies the ECB publishes a rate
// for are useful here; a country whose currency it does not cover (Vietnam,
// Morocco, Georgia…) is left out on purpose, so the tile says "no rate" rather
// than inventing one.
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  JP: "JPY",
  US: "USD",
  GB: "GBP",
  CH: "CHF",
  TH: "THB",
  KR: "KRW",
  TR: "TRY",
  IN: "INR",
  CZ: "CZK",
  HU: "HUF",
  PL: "PLN",
  AU: "AUD",
  CA: "CAD",
  MX: "MXN",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  CN: "CNY",
  HK: "HKD",
  SG: "SGD",
  ZA: "ZAR",
  BR: "BRL",
  ID: "IDR",
  PH: "PHP",
  RO: "RON",
  BG: "BGN",
  IS: "ISK",
  NZ: "NZD",
  MY: "MYR",
  IL: "ILS",
  // The euro area.
  AT: "EUR",
  BE: "EUR",
  HR: "EUR",
  CY: "EUR",
  EE: "EUR",
  FI: "EUR",
  FR: "EUR",
  DE: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SK: "EUR",
  SI: "EUR",
  ES: "EUR",
  ME: "EUR",
  AD: "EUR",
  MC: "EUR",
  SM: "EUR",
  VA: "EUR",
};

export const HOME_CURRENCY = "ILS";

// The currency of the trip: the one most of its stops use. Ties go to the
// first stop, which is where the trip begins. Home currency is never an
// answer — converting shekels to shekels is not a tile worth drawing.
export function destinationCurrency(
  countryCodes: (string | null | undefined)[],
): string | null {
  const counts = new Map<string, number>();
  for (const code of countryCodes) {
    if (!code) continue;
    const currency = CURRENCY_BY_COUNTRY[code.toUpperCase()];
    if (!currency || currency === HOME_CURRENCY) continue;
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
}

export type ExchangeRate = {
  base: string;
  quote: string;
  // How many `quote` one `base` buys.
  rate: number;
  // The ECB reference date the rate is for, YYYY-MM-DD.
  date: string;
};

export function convert(
  amount: number,
  rate: ExchangeRate,
  direction: "toQuote" | "toBase",
): number {
  return direction === "toQuote" ? amount * rate.rate : amount / rate.rate;
}

// "1 ₪ = 46.2 ¥" reads better than "1 ₪ = 46.2154 ¥"; the round amount on the
// other side ("100 ¥ = 2.16 ₪") is what people actually check.
export function rateLine(
  rate: ExchangeRate,
  format: (amount: number, currency: string) => string,
): { forward: string; backward: string } {
  const unit = roundUnit(rate.rate);
  return {
    forward: `${format(1, rate.base)} = ${format(rate.rate, rate.quote)}`,
    backward: `${format(unit, rate.quote)} = ${format(unit / rate.rate, rate.base)}`,
  };
}

// A round amount of the quote currency worth roughly one unit of the base:
// 100 for yen, 10 for baht, 1 for euros.
function roundUnit(rate: number): number {
  if (rate >= 20) return 100;
  if (rate >= 3) return 10;
  return 1;
}
