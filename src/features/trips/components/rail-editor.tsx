"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Backpack,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  HelpCircle,
  Languages,
  Map as MapIcon,
  MessageCircle,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  DEFAULT_RAIL,
  MAX_RAIL_SHORTCUTS,
  moveRailKey,
  normalizeRail,
  RAIL_CATALOG,
  toggleRailKey,
  type RailShortcutKey,
} from "../domain/rail-shortcuts";

// --- storage ------------------------------------------------------------------
//
// The rail's shortcuts live in localStorage, read through useSyncExternalStore
// so the server render (the default rail) and the first client paint agree,
// and the stored rail takes over without an effect setting state.

const STORAGE_KEY = "mytrip:rail";
const CHANGE_EVENT = "mytrip:rail-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Cached by raw string so the store returns a stable array for an unchanged
// value — useSyncExternalStore compares snapshots by reference.
let lastRaw: string | null = null;
let lastKeys: RailShortcutKey[] = [...DEFAULT_RAIL];

function readRail(): RailShortcutKey[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastKeys;
  lastRaw = raw;
  try {
    lastKeys = normalizeRail(raw ? JSON.parse(raw) : null);
  } catch {
    lastKeys = [...DEFAULT_RAIL];
  }
  return lastKeys;
}

const serverRail = [...DEFAULT_RAIL];
function readServerRail(): RailShortcutKey[] {
  return serverRail;
}

function writeRail(keys: RailShortcutKey[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage unavailable: the rail keeps its defaults, and the editor still
    // works for the rest of the page's life through the event below.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRailShortcuts(): RailShortcutKey[] {
  return useSyncExternalStore(subscribe, readRail, readServerRail);
}

// --- icons ----------------------------------------------------------------------

export const RAIL_ICONS: Record<RailShortcutKey, LucideIcon> = {
  today: MapIcon,
  days: CalendarDays,
  explore: Compass,
  guides: BookOpen,
  chat: MessageCircle,
  gear: Backpack,
  phrases: Languages,
  members: Users,
  share: Share2,
  trip: FileText,
  guide: HelpCircle,
};

// --- the editor -----------------------------------------------------------------

// The button at the foot of the rail, and the dialog it opens: every part of
// the trip as a row with a tick, the pinned ones on top in rail order with
// up/down arrows, the rest below to add. A reset puts the app's default back.
export function RailEditorButton() {
  const [open, setOpen] = useState(false);
  const keys = useRailShortcuts();

  const pinned = keys.flatMap((key) =>
    RAIL_CATALOG.filter((shortcut) => shortcut.key === key),
  );
  const available = RAIL_CATALOG.filter((shortcut) => !keys.includes(shortcut.key));
  const full = keys.length >= MAX_RAIL_SHORTCUTS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="עריכת הקיצורים"
        aria-label="עריכת הקיצורים ברַיל"
        className="flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors duration-press ease-snap hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="הקיצורים ברַיל">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            מה מופיע בצד, ובאיזה סדר. עד {MAX_RAIL_SHORTCUTS} קיצורים; לפחות אחד.
            נשמר בדפדפן הזה.
          </p>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-caption font-bold text-muted">ברַיל · {pinned.length}</h3>
            <ul className="divide-y divide-border rounded-card border border-border">
              {pinned.map((shortcut, index) => {
                const Icon = RAIL_ICONS[shortcut.key];
                return (
                  <li key={shortcut.key} className="flex items-center gap-2 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => writeRail(toggleRailKey(keys, shortcut.key))}
                      disabled={pinned.length === 1}
                      aria-pressed
                      aria-label={`הסירו את ${shortcut.label} מהרַיל`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {shortcut.label}
                    </span>
                    <Arrow
                      label={`העלו את ${shortcut.label}`}
                      disabled={index === 0}
                      onClick={() => writeRail(moveRailKey(keys, shortcut.key, -1))}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </Arrow>
                    <Arrow
                      label={`הורידו את ${shortcut.label}`}
                      disabled={index === pinned.length - 1}
                      onClick={() => writeRail(moveRailKey(keys, shortcut.key, 1))}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Arrow>
                  </li>
                );
              })}
            </ul>
          </section>

          {available.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-caption font-bold text-muted">
                {full ? "הרַיל מלא — הסירו משהו כדי להוסיף" : "אפשר להוסיף"}
              </h3>
              <ul className="divide-y divide-border rounded-card border border-border">
                {available.map((shortcut) => {
                  const Icon = RAIL_ICONS[shortcut.key];
                  return (
                    <li key={shortcut.key}>
                      <button
                        type="button"
                        onClick={() => writeRail(toggleRailKey(keys, shortcut.key))}
                        disabled={full}
                        className={cn(
                          "flex w-full items-center gap-2 px-2 py-1.5 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          full && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface"
                        />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {shortcut.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => writeRail([...DEFAULT_RAIL])}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ברירת המחדל
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              סיימתי
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}
