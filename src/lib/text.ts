// Name matching across the app.
//
// Several places have to decide whether two names refer to the same thing:
// linking an AI itinerary entry back to the item it came from, and linking a
// search result back to the itinerary day it was scheduled on. Both compare
// text that has passed through the AI, which echoes names back with different
// spacing or casing often enough to matter — so they have to normalise the
// same way, or one will match where the other doesn't.
export function normaliseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Attaches a single-letter Hebrew prefix (מ, ב, ל, ה…) to a name.
//
// Hebrew prefixes bind directly to a Hebrew word — "מריוקאן קיוטו" — but glue
// badly onto Latin or other scripts: "מShinjuku Granbell Hotel" runs the two
// writing directions together with nothing between them. The convention, which
// this app already follows in "פתח ב-Google Maps", is a maqaf before a
// non-Hebrew word.
//
// Decided on the first letter rather than the whole string, because that is the
// only one the prefix actually touches.
export function withHebrewPrefix(prefix: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return prefix;
  // Hebrew block, including the presentation forms in יִ–ﭏ.
  const startsHebrew = /^[֐-׿יִ-ﭏ]/.test(trimmed);
  return startsHebrew ? `${prefix}${trimmed}` : `${prefix}-${trimmed}`;
}
