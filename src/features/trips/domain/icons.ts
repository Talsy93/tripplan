// The names of the things this feature draws.
//
// Pure keys, no React and no lucide import — a domain table says *what* a
// booking kind or a gear category is, and the component layer decides what that
// looks like. Keeping the union here rather than in components/ui is what lets
// domain/booking.ts type its own table without either reaching into the UI or
// falling back to a bare `string` that nothing checks.
//
// Replaces the emoji that used to sit in those tables. The old rule — lucide for
// interface affordances, emoji for domain identity — had a real argument behind
// it, and it lost to three measured problems: an emoji renders as a different
// picture on every OS, it cannot take the city colour the tile beneath it is
// already set up to give, and at 17px next to a 2px-stroke lucide glyph it reads
// as a sticker rather than as part of the set.

export type DomainIconName =
  // bookings
  | "flight"
  | "train"
  | "lodging"
  // gear categories
  | "documents"
  | "clothing"
  | "toiletries"
  | "electronics"
  | "health"
  | "other"
  // place categories
  | "restaurant"
  | "cafe"
  | "bakery"
  | "shopping"
  | "temple"
  | "attraction"
  // weather conditions
  | "clear"
  | "partly-cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "snow-showers"
  | "thunder"
  | "unknown";
