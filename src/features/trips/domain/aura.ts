// A trip's light.
//
// Every trip's hero used to be the same colour: a photo over a neutral dark
// scrim. This gives each one a field of coloured light instead, drawn from the
// same six-hue palette the cities use (the --*-aura tokens in globals.css are
// the deep counterparts of the six .tone-* tints), so the app still speaks in
// one set of colours.
//
// What it does *not* share with ./tone is the assignment rule, and that is
// deliberate. cityToneMap assigns by position within a trip, which means every
// trip's first city is rose — fine for its job, which is telling two stops of
// one route apart, and useless for this one. Measured on the trip list: three
// trips, three tiles, all led by the same rose. A signature that every trip
// shares is not a signature.
//
// So the offset comes from the destinations themselves. ./tone rejects hashing
// because a hash can hand two adjacent stops the same colour; that reason does
// not carry here, because two trips in a list are not a route — nothing about
// them is adjacent. What matters instead is that the light is a function of
// where you are going, and stable: Tokyo-led trips always get the same light,
// and it is a different one from Rome's.

import { TONES, cityToneMap, toneByIndex, type Tone } from "./tone";

// Three is the ceiling, and not a stylistic preference: past three, blurred
// blooms of different hues overlap into brown instead of glowing.
const MAX_HUES = 3;

function auraVar(tone: Tone): string {
  return `var(--${tone}-aura)`;
}

// A small stable hash of the destination names.
//
// djb2, which is enough for choosing one of six and has the one property that
// matters: the same cities always produce the same light, on the server and in
// the browser, today and next month. Not a security or distribution concern —
// if it were, this would not be a hash written inline.
//
// Order must not count, and that is a correctness requirement rather than a
// nicety. The same trip reaches this from two directions with the cities in two
// different orders: the hero on the home screen gets them in itinerary order,
// and the tile in the list below it gets them in the order they were added. A
// sequential hash gave those two different offsets, so one trip appeared in two
// different colours on one screen. Sorting first makes the light a function of
// *which* cities, which is what it was always meant to be.
function offsetFromCities(cities: string[]): number {
  let hash = 5381;
  for (const city of [...cities].sort()) {
    for (let i = 0; i < city.length; i++) {
      hash = ((hash << 5) + hash + city.charCodeAt(i)) | 0;
    }
  }
  return Math.abs(hash) % TONES.length;
}

// The light for a trip, from its cities.
//
// Returns an empty array when the trip has no destinations yet — deliberately,
// not as a failure. AuraField with no hues renders the bare deep base, which is
// what "nothing chosen yet" should look like: a trip has no light until it has
// somewhere to go. Seeding off the trip id instead would hand a colour to a
// trip that has not earned one.
//
// Two trips can still land on the same offset — six hues, and no attempt to
// coordinate between trips. They are then told apart by how many hues each has
// and by the order, which differs with the cities. Guaranteeing distinctness
// would mean the list assigning light globally, and then a trip's light would
// change when an unrelated trip was created, which is worse.
export function tripAura(cities: string[]): string[] {
  // cityToneMap for the deduping and ordering, which it already does correctly
  // (a city revisited later keeps its first place); the offset is ours.
  const count = cityToneMap(cities).size;
  if (count === 0) return [];

  const offset = offsetFromCities(cities);
  return Array.from({ length: Math.min(count, MAX_HUES) }, (_, i) =>
    auraVar(toneByIndex(offset + i)),
  );
}
