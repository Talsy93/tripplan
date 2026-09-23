// The shortcuts a traveller can pin to the desktop rail while inside a trip.
//
// The rail used to be a fixed list chosen by the app. It is the traveller's
// now: any part of the trip can be pinned, unpinned, or moved, and the order is
// theirs. This file is the catalogue and the rules; the storage is the
// browser's (see components/rail-editor.tsx) because the rail only exists on
// a desktop, and which shortcuts you want at a desk is a preference about
// that desk.

export type RailShortcutKey =
  | "today"
  | "days"
  | "explore"
  | "guides"
  | "chat"
  | "gear"
  | "phrases"
  | "members"
  | "share"
  | "trip"
  | "guide";

export type RailShortcut = {
  key: RailShortcutKey;
  label: string;
  // Path under /trips/[id]/ — also what marks the shortcut active.
  path: string;
};

export const RAIL_CATALOG: readonly RailShortcut[] = [
  { key: "today", label: "היום", path: "today" },
  { key: "days", label: 'לו"ז', path: "days" },
  { key: "explore", label: "תכנון", path: "explore" },
  { key: "guides", label: "מדריכי הערים", path: "more/guides" },
  { key: "chat", label: "הצ׳אט של הטיול", path: "ai" },
  // The page keeps the countdown, what is still open and the forecast; the
  // packing list and the reminders moved to the documents tab.
  { key: "gear", label: "לפני היציאה", path: "more/gear" },
  { key: "phrases", label: "מילים שימושיות", path: "more/phrases" },
  { key: "members", label: "מי בא איתנו", path: "more/members" },
  { key: "share", label: "שיתוף הטיול", path: "more/share" },
  // "פרטי הטיול" became the documents tab — the key stays so saved rails keep
  // their slot.
  { key: "trip", label: "מסמכים", path: "more" },
  { key: "guide", label: "איך זה עובד", path: "more/guide" },
] as const;

export const DEFAULT_RAIL: readonly RailShortcutKey[] = [
  "today",
  "guides",
  "chat",
  "gear",
];

// The rail never shows more than this: past it the icons stop being a glance.
export const MAX_RAIL_SHORTCUTS = 8;

const KEYS = new Set<string>(RAIL_CATALOG.map((shortcut) => shortcut.key));

export function isRailShortcutKey(value: unknown): value is RailShortcutKey {
  return typeof value === "string" && KEYS.has(value);
}

// Whatever came out of storage, made safe: unknown keys dropped, duplicates
// collapsed, capped, and never empty — a rail with nothing on it is a bug,
// not a preference.
export function normalizeRail(value: unknown): RailShortcutKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_RAIL];
  const seen = new Set<RailShortcutKey>();
  const out: RailShortcutKey[] = [];
  for (const item of value) {
    if (!isRailShortcutKey(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_RAIL_SHORTCUTS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_RAIL];
}

export function railShortcuts(keys: readonly RailShortcutKey[]): RailShortcut[] {
  return keys.flatMap((key) => {
    const shortcut = RAIL_CATALOG.find((candidate) => candidate.key === key);
    return shortcut ? [shortcut] : [];
  });
}

export function moveRailKey(
  keys: readonly RailShortcutKey[],
  key: RailShortcutKey,
  delta: -1 | 1,
): RailShortcutKey[] {
  const index = keys.indexOf(key);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= keys.length) return [...keys];
  const next = [...keys];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleRailKey(
  keys: readonly RailShortcutKey[],
  key: RailShortcutKey,
): RailShortcutKey[] {
  if (keys.includes(key)) {
    const next = keys.filter((candidate) => candidate !== key);
    return next.length > 0 ? next : [...keys];
  }
  if (keys.length >= MAX_RAIL_SHORTCUTS) return [...keys];
  return [...keys, key];
}
