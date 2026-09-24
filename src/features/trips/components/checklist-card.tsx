"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  BellRing,
  ChevronDown,
  CirclePlus,
  ExternalLink,
  Eye,
  EyeOff,
  Luggage,
  Plus,
  X,
} from "lucide-react";
import {
  Banner,
  Button,
  ChipRadio,
  Dialog,
  Input,
  SwipeAction,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  GEAR_CATEGORIES,
  GEAR_CATEGORY_ORDER,
  starterSuggestions,
  type GearCategory,
  type GearFormState,
  type GearItem,
} from "../domain/gear";
import type { PrepFormState, PrepItem, PrepSuggestion } from "../domain/prep";
import {
  addGearItem,
  addGearItems,
  removeGearItem,
  toggleGearItem,
} from "../application/gear-actions";
import {
  addPrepItem,
  addPrepSuggestions,
  removePrepItem,
  togglePrepItem,
} from "../application/prep-actions";
import { DomainIcon } from "./domain-icon";

// "ציוד ורשימת הכנות" — the Stitch export's packing card, holding both lists
// the app keeps: what to pack (trip_gear) and what to do before leaving
// (trip_prep_items, the reminders). The export draws them as one list —
// "מתאם שקעים" beside "חבילת eSIM מותקנת" — and one list is also what they are
// to a traveller: things that have to be true before the door closes.
//
// They used to be a page of their own (/more/gear) with two editors. Asked for
// as "the gear list and the reminders, as in the design and not on a separate
// page": five rows by default, "הצג עוד" for the rest, and adding in a modal.
//
// Removing is a swipe or a hold, as on every list in the app; the export draws
// no delete control, and a bin on every row of a checklist is a row of bins.

type Row =
  | { kind: "gear"; id: string; label: string; done: boolean; item: GearItem }
  | { kind: "prep"; id: string; label: string; done: boolean; item: PrepItem };

// How many rows the card shows until "הצג עוד". The export draws five.
const DEFAULT_ROWS = 5;

export function ChecklistCard({
  tripId,
  gear,
  prepItems,
  suggestions,
  today,
}: {
  tripId: string;
  gear: GearItem[];
  prepItems: PrepItem[];
  // The app's own reminder suggestions (suggestPrepItems), offered in the
  // add modal as one-tap chips.
  suggestions: PrepSuggestion[];
  // YYYY-MM-DD in the trip's zone, for "due soon".
  today: string;
}) {
  // Ticks land here first and are sent after, so a tick is instant; the
  // server's next render replaces the props and this map is only ever the
  // difference between the two. Removals are the same.
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows: Row[] = [
    ...prepItems.map((item) => ({
      kind: "prep" as const,
      id: item.id,
      label: item.title,
      done: item.done,
      item,
    })),
    ...gear.map((item) => ({
      kind: "gear" as const,
      id: item.id,
      label: item.label,
      done: item.packed,
      item,
    })),
  ]
    .filter((row) => !removed.includes(row.id))
    .map((row) => (row.id in local ? { ...row, done: local[row.id] } : row));

  const total = rows.length;
  const done = rows.filter((row) => row.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // What is done is hidden until asked for: a checklist is read for what is
  // left, and ticked rows pushing the open ones below "הצג עוד" is the list
  // hiding its own point. Asked for as "a button that also shows the ones
  // marked done". When shown they are drawn above the open rows, as the
  // export draws them; the five shown by default are still chosen open-first,
  // and "הצג עוד" then shows every visible row in the same order.
  const pending = rows.filter((row) => !row.done);
  const finished = rows.filter((row) => row.done);
  const visible = showDone ? [...finished, ...pending] : pending;
  const chosen = new Set(
    [...pending, ...(showDone ? finished : [])]
      .slice(0, DEFAULT_ROWS)
      .map((row) => row.id),
  );
  const shown = expanded
    ? visible
    : visible.filter((row) => chosen.has(row.id));
  const hidden = visible.length - shown.length;

  async function toggle(row: Row, next: boolean) {
    setLocal((current) => ({ ...current, [row.id]: next }));
    const ok =
      row.kind === "gear"
        ? await toggleGearItem(tripId, row.id, next)
        : await togglePrepItem(tripId, row.id, next);
    if (!ok) setLocal((current) => ({ ...current, [row.id]: !next }));
  }

  async function remove(row: Row) {
    setRemoved((current) => [...current, row.id]);
    const ok =
      row.kind === "gear"
        ? await removeGearItem(tripId, row.id)
        : await removePrepItem(tripId, row.id);
    if (!ok) setRemoved((current) => current.filter((id) => id !== row.id));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {/* Pencil: a plain heading with a teal glyph. The terracotta disc it
            had is the screen's call-to-action colour, and that is spent on
            "הוספת כרטיס". */}
        <div className="flex min-w-0 items-center gap-2">
          <Luggage className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="min-w-0 text-lg leading-6 font-semibold text-foreground">
            ציוד ורשימת הכנות
          </h2>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-primary-tint px-2.5 py-1 text-xs leading-4 font-semibold text-primary">
            {done} מתוך {total} מוכנים
          </span>
        )}
      </div>

      <div className="rounded-[18px] bg-surface p-4 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs leading-4 font-semibold text-foreground">
            מוכנות לטיסה
          </span>
          <span className="text-base leading-[22px] font-bold text-success-ink tabular-nums">
            {percent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="מוכנות לטיסה"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
        >
          <div
            // Green, as on the summary tile that opens this card: readiness
            // is progress toward done, and done is the success colour.
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {total === 0 ? (
          <p className="p-2 text-sm leading-5 text-muted-strong">
            הרשימה עוד ריקה — דרכון, מתאם, להזמין eSIM. כל מה שתוסיפו נשמר לכל
            חברי הטיול.
          </p>
        ) : shown.length === 0 ? (
          <p className="p-2 text-sm leading-5 text-muted-strong">
            הכול סומן. אפשר להציג את מה שבוצע בכפתור למטה.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {shown.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <SwipeAction
                  icon={<X className="h-4 w-4" aria-hidden="true" />}
                  onAction={() => void remove(row)}
                >
                  <ChecklistRow
                    row={row}
                    today={today}
                    onToggle={(next) => void toggle(row, next)}
                  />
                </SwipeAction>
              </li>
            ))}
          </ul>
        )}

        {(finished.length > 0 || visible.length > DEFAULT_ROWS) && (
          <div className="mt-1 flex items-center justify-between gap-2">
            {visible.length > DEFAULT_ROWS ? (
              <button
                type="button"
                onClick={() => setExpanded((was) => !was)}
                aria-expanded={expanded}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs leading-4 font-medium text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {expanded ? "הצג פחות" : `הצג עוד ${hidden}`}
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <span />
            )}
            {finished.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDone((was) => !was)}
                aria-pressed={showDone}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs leading-4 font-medium text-muted-strong transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showDone ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                {showDone
                  ? "הסתר את מה שבוצע"
                  : `הצג גם מה שבוצע (${finished.length})`}
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-control text-xs leading-4 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CirclePlus className="h-[18px] w-[18px]" aria-hidden="true" />
            הוספת פריט לרשימה
          </button>
          <span className="text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong">
            משותף לכל חברי הטיול
          </span>
        </div>
      </div>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="הוספה לרשימה"
      >
        {adding && (
          <AddForm
            tripId={tripId}
            gear={gear}
            suggestions={suggestions}
            onDone={() => setAdding(false)}
          />
        )}
      </Dialog>
    </section>
  );
}

function ChecklistRow({
  row,
  today,
  onToggle,
}: {
  row: Row;
  today: string;
  onToggle: (next: boolean) => void;
}) {
  const due = row.kind === "prep" ? row.item.due_date : null;
  const url = row.kind === "prep" ? row.item.url : null;
  const overdue = !row.done && due !== null && due <= today;
  const iconClass = cn(
    "h-[18px] w-[18px] shrink-0",
    row.done ? "text-success-strong" : "text-muted-strong",
  );

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2 transition-colors hover:bg-surface-2">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={row.done}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--success-strong)]"
        />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "min-w-0 text-sm leading-5 transition-all wrap-anywhere",
              row.done
                ? "text-muted-strong line-through"
                : "font-medium text-foreground",
            )}
          >
            {row.label}
          </span>
          {due && !row.done && (
            <span
              className={cn(
                "text-[10px] leading-[14px] font-semibold tracking-[0.02em]",
                overdue ? "text-cta-strong" : "text-muted-strong",
              )}
            >
              עד {formatDue(due)}
            </span>
          )}
        </span>
      </label>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`פתיחת הקישור של ${row.label}`}
          className="shrink-0 rounded-control text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      ) : row.kind === "gear" ? (
        <DomainIcon
          name={GEAR_CATEGORIES[row.item.category].icon}
          className={iconClass}
        />
      ) : (
        <BellRing className={iconClass} aria-hidden="true" />
      )}
    </div>
  );
}

// ---- the add modal ----------------------------------------------------------

type Mode = "gear" | "prep";

function AddForm({
  tripId,
  gear,
  suggestions,
  onDone,
}: {
  tripId: string;
  gear: GearItem[];
  suggestions: PrepSuggestion[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("gear");
  const [category, setCategory] = useState<GearCategory>("documents");
  const { showToast } = useToast();
  const [gearState, gearAction, gearPending] = useActionState<
    GearFormState,
    FormData
  >(addGearItem, undefined);
  const [prepState, prepAction, prepPending] = useActionState<
    PrepFormState,
    FormData
  >(addPrepItem, undefined);

  // Closed on a success edge — pending true → false with no error — rather
  // than on the state itself, so the initial `undefined` is not mistaken for a
  // completed save.
  const pending = gearPending || prepPending;
  const state = mode === "gear" ? gearState : prepState;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.message && !state?.errors) {
      showToast(mode === "gear" ? "נוסף לרשימת הציוד" : "התזכורת נוספה");
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, mode, showToast, onDone]);

  async function quickGear(label: string) {
    if (await addGearItems(tripId, category, [label])) {
      showToast(`״${label}״ נוסף`);
      onDone();
    } else {
      showToast("ההוספה נכשלה. נסו שוב.", "danger");
    }
  }

  async function quickPrep(suggestion: PrepSuggestion) {
    const ok = await addPrepSuggestions(tripId, [
      {
        kind: suggestion.kind,
        title: suggestion.title,
        dueDate: suggestion.dueDate,
      },
    ]);
    if (ok) {
      showToast("התזכורת נוספה");
      onDone();
    } else {
      showToast("ההוספה נכשלה. נסו שוב.", "danger");
    }
  }

  const starters = starterSuggestions(category, gear);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="radiogroup" aria-label="מה מוסיפים">
        <ChipRadio
          name="addMode"
          value="gear"
          checked={mode === "gear"}
          onChange={() => setMode("gear")}
          label="ציוד לארוז"
        />
        <ChipRadio
          name="addMode"
          value="prep"
          checked={mode === "prep"}
          onChange={() => setMode("prep")}
          label="תזכורת לפני היציאה"
        />
      </div>

      {mode === "gear" ? (
        <form action={gearAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="category" value={category} />
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">מה לארוז</span>
            <Input
              name="label"
              maxLength={120}
              required
              autoFocus
              placeholder="למשל מתאם שקעים"
            />
            {gearState?.errors?.label?.[0] && (
              <span role="alert" className="text-xs text-danger-ink">
                {gearState.errors.label[0]}
              </span>
            )}
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-muted">קטגוריה</legend>
            <div className="flex flex-wrap gap-2">
              {GEAR_CATEGORY_ORDER.map((key) => (
                <ChipRadio
                  key={key}
                  name="categoryChoice"
                  value={key}
                  checked={category === key}
                  onChange={() => setCategory(key)}
                  label={GEAR_CATEGORIES[key].label}
                />
              ))}
            </div>
          </fieldset>
          {starters.length > 0 && (
            <Quick
              title="בלחיצה אחת"
              items={starters.map((label) => ({
                key: label,
                label,
                onPress: () => void quickGear(label),
              }))}
            />
          )}
          {gearState?.message && <Banner tone="danger">{gearState.message}</Banner>}
          <div>
            <Button type="submit" loading={gearPending}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              הוספה
            </Button>
          </div>
        </form>
      ) : (
        <form action={prepAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="tripId" value={tripId} />
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-muted">מה לזכור</span>
            <Input
              name="title"
              maxLength={160}
              required
              autoFocus
              placeholder="למשל להתקין eSIM"
            />
            {prepState?.errors?.title?.[0] && (
              <span role="alert" className="text-xs text-danger-ink">
                {prepState.errors.title[0]}
              </span>
            )}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-muted">עד תאריך (לא חובה)</span>
              <Input type="date" name="dueDate" dir="ltr" />
              {prepState?.errors?.dueDate?.[0] && (
                <span role="alert" className="text-xs text-danger-ink">
                  {prepState.errors.dueDate[0]}
                </span>
              )}
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-muted">קישור (לא חובה)</span>
              <Input type="url" name="url" dir="ltr" placeholder="https://" />
              {prepState?.errors?.url?.[0] && (
                <span role="alert" className="text-xs text-danger-ink">
                  {prepState.errors.url[0]}
                </span>
              )}
            </label>
          </div>
          {suggestions.length > 0 && (
            <Quick
              title="הצעות מהטיול שלכם"
              items={suggestions.map((suggestion) => ({
                key: suggestion.kind,
                label: suggestion.title,
                onPress: () => void quickPrep(suggestion),
              }))}
            />
          )}
          {prepState?.message && <Banner tone="danger">{prepState.message}</Banner>}
          <div>
            <Button type="submit" loading={prepPending}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              הוספה
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Quick({
  title,
  items,
}: {
  title: string;
  items: { key: string; label: string; onPress: () => void }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted">{title}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onPress}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-high px-3 py-1 text-start text-xs leading-4 font-medium text-primary transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// YYYY-MM-DD → "12.09", split rather than parsed — a bare date parsed as a Date
// is UTC midnight and prints the day before west of Greenwich.
function formatDue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}` : value;
}
