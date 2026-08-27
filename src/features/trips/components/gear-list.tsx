"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  SectionHeading,
  Select,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  GEAR_CATEGORIES,
  GEAR_CATEGORY_ORDER,
  gearProgress,
  groupGear,
  starterSuggestions,
  type GearCategory,
  type GearFormState,
  type GearItem,
} from "../domain/gear";
import {
  addGearItem,
  addGearItems,
  removeGearItem,
  toggleGearItem,
  uncheckAllGear,
} from "../application/gear-actions";

// The packing list.
//
// One client component rather than a server list plus client rows: every
// interaction here is a tick, and a tick has to feel instant. The rows are held
// optimistically and reconciled against the props the Server Action revalidates
// into — see `pending` below for why that needs care on a checkbox specifically.
export function GearList({
  tripId,
  items,
}: {
  tripId: string;
  items: GearItem[];
}) {
  // Ids whose tick is in flight, with the value we optimistically applied.
  // A Map and not a Set: un-ticking is as much a pending state as ticking, and
  // the row has to render the value the user just chose either way.
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [removed, setRemoved] = useState<string[]>([]);
  const { showToast } = useToast();

  // The props are the source of truth. `pending` only overrides a row while its
  // write is in flight, so a revalidation that disagrees wins as soon as the
  // request settles rather than being permanently shadowed by local state.
  const visible = items
    .filter((item) => !removed.includes(item.id))
    .map((item) => {
      const override = pending.get(item.id);
      return override === undefined ? item : { ...item, packed: override };
    });

  const progress = gearProgress(visible);
  const groups = groupGear(visible);

  async function toggle(item: GearItem, next: boolean) {
    setPending((current) => new Map(current).set(item.id, next));

    const ok = await toggleGearItem(tripId, item.id, next);
    if (!ok) showToast("העדכון נכשל. נסו שוב.", "danger");

    // Cleared whether it worked or not: on success the revalidated props already
    // carry the new value, and on failure they carry the old one. Either way the
    // props are now the more accurate answer.
    setPending((current) => {
      const map = new Map(current);
      map.delete(item.id);
      return map;
    });
  }

  async function remove(item: GearItem) {
    setRemoved((current) => [...current, item.id]);
    if (!(await removeGearItem(tripId, item.id))) {
      setRemoved((current) => current.filter((id) => id !== item.id));
      showToast("ההסרה נכשלה. נסו שוב.", "danger");
    }
  }

  async function uncheckAll() {
    if (await uncheckAllGear(tripId)) {
      showToast("הכול סומן כלא ארוז");
    } else {
      showToast("הפעולה נכשלה. נסו שוב.", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <GearForm tripId={tripId} />

      {visible.length > 0 && (
        <>
          <ProgressBar
            packed={progress.packed}
            total={progress.total}
            percent={progress.percent}
            done={progress.done}
            onUncheckAll={() => void uncheckAll()}
          />

          {/* Groups side by side once there is room. A packing list is many
              short rows, so on a wide screen one column leaves most of the
              width empty and pushes "אחר" below the fold. */}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.category}
                padding="none"
                className="flex min-w-0 flex-col"
              >
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span aria-hidden="true">
                    {GEAR_CATEGORIES[group.category].emoji}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold">
                    {GEAR_CATEGORIES[group.category].label}
                  </h3>
                  <Badge
                    tone={
                      group.packed === group.items.length ? "success" : "neutral"
                    }
                  >
                    {group.packed}/{group.items.length}
                  </Badge>
                </div>

                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
                    >
                      {/* A real checkbox, wrapped in its own label. The whole
                          row being the hit target matters on a phone, and a
                          label with the input inside needs no `htmlFor`/id
                          pairing to stay correct as rows are added. */}
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
                        <input
                          type="checkbox"
                          checked={item.packed}
                          onChange={(event) =>
                            void toggle(item, event.currentTarget.checked)
                          }
                          className="h-4.5 w-4.5 shrink-0 accent-primary"
                        />
                        <span
                          className={cn(
                            // wrap-anywhere, not truncate: the user typed this
                            // and a long entry is theirs to read in full.
                            "min-w-0 text-sm wrap-anywhere",
                            item.packed && "text-muted line-through",
                          )}
                        >
                          {item.label}
                        </span>
                      </label>

                      <IconButton
                        label={`הסרת ${item.label}`}
                        variant="danger"
                        size="sm"
                        onClick={() => void remove(item)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>

                <StarterRow
                  tripId={tripId}
                  category={group.category}
                  items={group.items}
                />
              </Card>
            ))}
          </div>
        </>
      )}

      {visible.length === 0 && (
        <div className="flex flex-col gap-4">
          <SectionHeading
            level="sub"
            description="בחרו מהרשימות למטה, או הוסיפו כל דבר אחר בשדה שלמעלה."
          >
            התחלה מהירה
          </SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {GEAR_CATEGORY_ORDER.map((category) => (
              <Card key={category} className="flex min-w-0 flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span aria-hidden="true">
                    {GEAR_CATEGORIES[category].emoji}
                  </span>
                  {GEAR_CATEGORIES[category].label}
                </span>
                <StarterRow tripId={tripId} category={category} items={[]} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  packed,
  total,
  percent,
  done,
  onUncheckAll,
}: {
  packed: number;
  total: number;
  percent: number;
  done: boolean;
  onUncheckAll: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {done ? "הכול ארוז 🎉" : `${packed} מתוך ${total} ארוזים`}
        </span>
        {packed > 0 && (
          <Button variant="outline" size="sm" onClick={onUncheckAll}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            איפוס הסימונים
          </Button>
        )}
      </div>

      {/* A native progress element: it is announced as a progress bar without
          any aria wiring, and it is the correct semantics for "packed out of
          total". Styled through the pseudo-elements each engine exposes. */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="התקדמות האריזה"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            done ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </Card>
  );
}

// One-tap suggestions for a category, filtered against what is already there.
function StarterRow({
  tripId,
  category,
  items,
}: {
  tripId: string;
  category: GearCategory;
  items: GearItem[];
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const { showToast } = useToast();
  const suggestions = starterSuggestions(category, items);

  if (suggestions.length === 0) return null;

  async function add(label: string) {
    setAdding(label);
    if (!(await addGearItems(tripId, category, [label]))) {
      showToast("ההוספה נכשלה. נסו שוב.", "danger");
    }
    setAdding(null);
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
      {suggestions.map((label) => (
        <button
          key={label}
          type="button"
          disabled={adding === label}
          onClick={() => void add(label)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-caption text-muted transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function GearForm({ tripId }: { tripId: string }) {
  const [state, action, isPending] = useActionState<GearFormState, FormData>(
    addGearItem,
    undefined,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  // Kept across submissions on purpose: someone adding three shirts should not
  // have to reselect "ביגוד" each time.
  const [category, setCategory] = useState<GearCategory>("documents");

  // Same shape as CreateTripForm: the action returns {} on success, so the ref
  // is what distinguishes "succeeded" from "never submitted".
  useEffect(() => {
    if (isPending || !submitted.current) return;
    if (state && !state.errors && !state.message) {
      submitted.current = false;
      formRef.current?.reset();
      // Focus back to the field, because adding one item almost always means
      // adding the next one.
      formRef.current?.querySelector<HTMLInputElement>("[name=label]")?.focus();
    }
  }, [isPending, state]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => {
        submitted.current = true;
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="tripId" value={tripId} />

      <Field
        label="מה להוסיף"
        error={state?.errors?.label?.join(" ")}
        className="min-w-0 flex-1"
      >
        <Input
          name="label"
          placeholder="למשל: מתאם שקע ליפן"
          required
          maxLength={120}
          aria-invalid={state?.errors?.label ? true : undefined}
        />
      </Field>

      <Field label="קטגוריה" className="min-w-0 sm:w-44">
        <Select
          name="category"
          value={category}
          onChange={(event) =>
            setCategory(event.currentTarget.value as GearCategory)
          }
        >
          {GEAR_CATEGORY_ORDER.map((value) => (
            <option key={value} value={value}>
              {GEAR_CATEGORIES[value].emoji} {GEAR_CATEGORIES[value].label}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" loading={isPending} className="shrink-0">
        <Plus className="h-4 w-4" aria-hidden="true" />
        הוספה
      </Button>

      {state?.message && (
        <p className="text-caption text-danger-ink sm:hidden">{state.message}</p>
      )}
    </form>
  );
}
