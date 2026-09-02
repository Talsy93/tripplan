// The carriers a booking can name, keyed by IATA code.
//
// A curated list rather than free text, and rather than an API.
//
// **Why not free text.** "אל על", "El Al", "ELAL" and "LY" are the same airline
// and would be four different values, which makes the field unsearchable and
// unsummarisable the moment anything wants to group by it. The code is the one
// identifier that is stable across the Hebrew name, the English name and the
// flight number printed on the ticket.
//
// **Why not an API.** There is no free, licensed airline directory this project
// can call — the ones that exist are paid, key-gated, or both, and the standing
// rule here is a free alternative or no feature. A list in the repo has no key,
// no rate limit, no outage and no bill; the cost is that it is incomplete, which
// is why the field is optional and why the flight number in the title still
// carries the airline for anything not listed.
//
// **Why IATA and not ICAO.** IATA is the two-letter code on the ticket and the
// boarding pass — LY086, not ELY086. The field is transcribed from what the
// traveller is holding.
//
// Scope: the carriers that actually fly to and from Israel, plus the majors a
// connecting itinerary runs into. Alphabetical by code so an addition has an
// obvious place and a diff stays readable.

import { toneByIndex } from "./tone";
import type { Tone } from "./tone";

export type Airline = {
  /** IATA code, uppercase. The stored value. */
  code: string;
  /** Hebrew name, as an Israeli traveller would say it. */
  name: string;
};

export const AIRLINES: readonly Airline[] = [
  { code: "A3", name: "אג׳יאן" },
  { code: "AA", name: "אמריקן איירליינס" },
  { code: "AC", name: "אייר קנדה" },
  { code: "AF", name: "אייר פראנס" },
  { code: "AZ", name: "ITA איירווייז" },
  { code: "BA", name: "בריטיש איירווייז" },
  { code: "BT", name: "אייר בולטיק" },
  { code: "CX", name: "קתאי פסיפיק" },
  { code: "DL", name: "דלתא" },
  { code: "EK", name: "אמירייטס" },
  { code: "ET", name: "אתיופיאן איירליינס" },
  { code: "EY", name: "אתיחאד" },
  { code: "FR", name: "ריינאייר" },
  { code: "HR", name: "חיליי" },
  { code: "IB", name: "איבריה" },
  { code: "IZ", name: "ארקיע" },
  { code: "JL", name: "ג׳פן איירליינס" },
  { code: "KL", name: "KLM" },
  { code: "LH", name: "לופטהנזה" },
  { code: "LO", name: "לוט" },
  { code: "LX", name: "סוויס" },
  { code: "LY", name: "אל על" },
  { code: "NH", name: "ANA" },
  { code: "OS", name: "אוסטריאן" },
  { code: "PC", name: "פגסוס" },
  { code: "QR", name: "קטאר איירווייז" },
  { code: "SN", name: "בריסל איירליינס" },
  { code: "SQ", name: "סינגפור איירליינס" },
  { code: "SU", name: "אירופלוט" },
  { code: "TK", name: "טורקיש איירליינס" },
  { code: "U2", name: "איזי ג׳ט" },
  { code: "UA", name: "יונייטד" },
  { code: "VY", name: "ויאלינג" },
  { code: "W6", name: "ויז אייר" },
  { code: "WK", name: "אדלוויס" },
] as const;

const BY_CODE = new Map(AIRLINES.map((airline) => [airline.code, airline]));

export function findAirline(code: string | null | undefined): Airline | null {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

// A code the app does not know is kept rather than rejected: the list is
// incomplete by construction, and a row written before an airline was added
// must not become invalid when it is. The label falls back to the code itself,
// which is still what the ticket says.
export function airlineLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const known = findAirline(code);
  return known ? known.name : code.trim().toUpperCase();
}

// Which of the six tones the airline's code chip is drawn in.
//
// Deliberately not a real logo. Airline logos are trademarks, and the sources
// that serve them are paid (Airhex), key-gated, or undocumented CDNs with no
// terms granting anyone else their use — none of which is free in the sense
// this project means it. The app also removed destination photographs on
// purpose and replaced them with light (see trip-aura-band.tsx and the empty
// images config in next.config.ts); pulling in third-party logo bitmaps would
// reverse that decision for a smaller reason than the one it was made for.
//
// Hashed rather than assigned by position, which is the opposite of what
// cityToneMap does and right here for the opposite reason. A city's colour has
// to be distinct from the other cities *on the same screen*, so position is what
// guarantees it. An airline's has to be the same everywhere the airline appears,
// across screens that never see each other, so it can only come from the code.
// Collisions are fine: two carriers sharing a tint is not a mistake, it is two
// chips that happen to match, and each still carries its own two letters.
//
// A sum of char codes, not a real hash: two characters, and the only property
// needed is that the same code always lands on the same tone.
export function airlineTone(code: string): Tone {
  const normalised = code.trim().toUpperCase();
  let sum = 0;
  for (let index = 0; index < normalised.length; index += 1) {
    sum += normalised.charCodeAt(index);
  }
  return toneByIndex(sum);
}
