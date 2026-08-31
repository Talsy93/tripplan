// A trip's light.
//
// Every trip's hero used to be the same colour: a photo over a neutral dark
// scrim. This gives each one a field of coloured light instead, and which light
// depends on where the trip goes.
//
// The hues live in globals.css as --aura-<palette>-1..3. This module decides
// which palette a trip gets.
//
// Palettes rather than N hues off a ring, and that is a correction worth
// recording. The first version took hues from the six city tones by position —
// one colour language, in principle. In practice cityToneMap assigns by position
// *within a trip*, so every trip's first city is rose, and measured on the trip
// list three trips came out led by the same rose. Worse, the trios were
// arbitrary: "Japan in autumn" got blue + orange + pink. A ring built to
// separate two stops of one route says nothing about which three colours belong
// together. The approved design never worked that way — each trip in it carried
// a trio chosen as a trio.

import { AURA_PALETTES, type AuraPalette } from "./aura-palette";

export function auraHues(palette: AuraPalette): string[] {
  return [1, 2, 3].map((n) => `var(--aura-${palette}-${n})`);
}

// Which palette a trip would like, before anyone else has a say.
//
// A small stable hash of the destination names, so the same cities always
// produce the same light — on the server and in the browser, today and next
// month. Not a security or distribution concern; if it were, this would not be a
// hash written inline.
//
// Order must not count, and that is a correctness requirement rather than a
// nicety. The same trip reaches this from two directions with its cities in two
// different orders: the hero gets them in itinerary order, the tile in the list
// below it in the order they were added. A sequential hash gave those two
// different palettes, so one trip appeared in two colours on one screen.
//
// The final mix is not decoration either. djb2's low bits are weak, and taking
// them mod 8 put seven of twenty-four sample trips on one palette and two on
// another. The avalanche step spreads them.
function preferredIndex(cities: string[]): number {
  let hash = 5381;
  for (const city of [...cities].sort()) {
    for (let i = 0; i < city.length; i++) {
      hash = ((hash << 5) + hash + city.charCodeAt(i)) | 0;
    }
  }
  let mixed = hash | 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x45d9f3b) | 0;
  mixed ^= mixed >>> 16;

  return Math.abs(mixed) % AURA_PALETTES.length;
}

export type AuraTrip = {
  id: string;
  // The trip's cities, in any order. No cities means no light.
  cities: string[];
  // Used only for ordering, and only so that the assignment below is stable.
  createdAt: string;
};

// The light for every trip at once, keyed by trip id: `[]` for a trip with no
// destinations yet, three CSS colours otherwise.
//
// Assigned as a set rather than one trip at a time, because the hash alone
// collides too often to be useful. With eight palettes and three trips there is
// a 34% chance two of them come out the same colour, and a signature two trips
// share is not much of a signature. So a trip takes its preferred palette when
// it is free and steps around the wheel when it is not.
//
// Ordered by creation, never by list order or by date, and that is what keeps it
// stable: an older trip is always assigned before a newer one, so creating a
// trip cannot change the colour of a trip that already existed. Renaming,
// re-dating or re-sorting cannot either. Only editing a trip's own destinations
// changes its own light, which is right — the light is what its destinations
// are.
//
// Past eight trips the wheel is full, so it resets and repeats begin. Cycling
// beats running out: the ninth trip gets the same treatment as the first rather
// than falling back to a colour that is already on screen twice.
//
// A trip with no cities is skipped entirely and holds no palette — it is not
// "assigned black", it simply has no light to reserve, and the next trip with
// destinations gets the palette it would have had.
export function assignTripAuras(trips: AuraTrip[]): Map<string, string[]> {
  const assigned = new Map<string, string[]>();
  const taken = new Set<AuraPalette>();

  const oldestFirst = [...trips].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  for (const trip of oldestFirst) {
    const cities = trip.cities.filter(Boolean);
    if (cities.length === 0) {
      assigned.set(trip.id, []);
      continue;
    }

    if (taken.size === AURA_PALETTES.length) taken.clear();

    const preferred = preferredIndex(cities);
    let palette = AURA_PALETTES[preferred];
    for (let step = 0; step < AURA_PALETTES.length; step++) {
      const candidate =
        AURA_PALETTES[(preferred + step) % AURA_PALETTES.length];
      if (!taken.has(candidate)) {
        palette = candidate;
        break;
      }
    }

    taken.add(palette);
    assigned.set(trip.id, auraHues(palette));
  }

  return assigned;
}

// One trip's light, with nothing to deconflict against.
//
// For a screen that shows a single trip and has no list to compare it with — the
// trip's own pages, and the preview harness. On the home screen, where the hero
// and the list sit together, both take their hues from assignTripAuras so the
// same trip cannot appear in two colours.
export function tripAura(cities: string[]): string[] {
  const named = cities.filter(Boolean);
  if (named.length === 0) return [];

  return auraHues(AURA_PALETTES[preferredIndex(named)]);
}
