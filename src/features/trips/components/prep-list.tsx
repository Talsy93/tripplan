"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  Link2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Banner,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  SectionHeading,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { prepProgress } from "../domain/prep";
import type { PrepFormState, PrepItem, PrepSuggestion } from "../domain/prep";
import {
  addPrepItem,
  addPrepSuggestions,
  removePrepItem,
  setPrepItemUrl,
  togglePrepItem,
} from "../application/prep-actions";

// The to-do list before departure: what the traveller wrote, what they took
// from the suggestions, ticked off one by one. Each row can carry a link to
// the document it is about — the e-ticket, the policy, the confirmation — so
// the list is also where those live on the day.
export function PrepList({
  tripId,
  items,
  suggestions,
  today,
}: {
  tripId: string;
  items: PrepItem[];
  suggestions: PrepSuggestion[];
  today: string;
}) {
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [removed, setRemoved] = useState<string[]>([]);
  const [adding, startAdding] = useTransition();
  // Suggestions accepted but not yet back from the server, shown at once as
  // provisional rows. Reconciled by `kind`: the moment the real row arrives
  // in `items`, the provisional one is dropped.
  const [optimistic, setOptimistic] = useState<PrepItem[]>([]);
  const { showToast } = useToast();

  const knownKinds = new Set<string>(
    items.flatMap((item) => (item.kind ? [item.kind] : [])),
  );
  const provisional = optimistic.filter(
    (item) => item.kind === null || !knownKinds.has(item.kind),
  );
  const acceptedKinds = new Set<string>(
    provisional.flatMap((item) => (item.kind ? [item.kind] : [])),
  );
  const offered = suggestions.filter(
    (suggestion) => !acceptedKinds.has(suggestion.kind),
  );

  const visible = [...items, ...provisional]
    .filter((item) => !removed.includes(item.id))
    .map((item) => {
      const override = pending.get(item.id);
      return override === undefined ? item : { ...item, done: override };
    });
  const progress = prepProgress(visible);
  const open = visible.filter((item) => !item.done);
  const done = visible.filter((item) => item.done);

  async function toggle(item: PrepItem, next: boolean) {
    setPending((current) => new Map(current).set(item.id, next));
    const ok = await togglePrepItem(tripId, item.id, next);
    if (!ok) showToast("העדכון נכשל. נסו שוב.", "danger");
    setPending((current) => {
      const map = new Map(current);
      map.delete(item.id);
      return map;
    });
  }

  async function remove(item: PrepItem) {
    setRemoved((current) => [...current, item.id]);
    if (!(await removePrepItem(tripId, item.id))) {
      setRemoved((current) => current.filter((id) => id !== item.id));
      showToast("ההסרה נכשלה. נסו שוב.", "danger");
    }
  }

  function accept(list: PrepSuggestion[]) {
    const now = new Date().toISOString();
    setOptimistic((current) => [
      ...current,
      ...list.map((suggestion) => ({
        id: `pending-${suggestion.kind}`,
        trip_id: tripId,
        title: suggestion.title,
        done: false,
        due_date: suggestion.dueDate,
        url: null,
        kind: suggestion.kind,
        created_at: now,
      })),
    ]);
    startAdding(async () => {
      const ok = await addPrepSuggestions(
        tripId,
        list.map(({ kind, title, dueDate }) => ({ kind, title, dueDate })),
      );
      if (!ok) {
        const kinds = new Set(list.map((suggestion) => suggestion.kind));
        setOptimistic((current) =>
          current.filter((item) => item.kind === null || !kinds.has(item.kind)),
        );
        showToast("ההוספה נכשלה. נסו שוב.", "danger");
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        level="section"
        actions={
          progress.total > 0 ? (
            <span className="text-caption tabular-nums text-muted">
              {progress.done} מתוך {progress.total}
            </span>
          ) : undefined
        }
      >
        רשימת ההכנות
      </SectionHeading>

      {progress.total > 0 && (
        <div
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-settle ease-snap",
              progress.percent === 100 ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {/* Behind a button, per the standing rule that adding anything is a
          modal. The extra fields inside no longer need the <details> either —
          a dialog has room to ask all three at once, which is what the
          disclosure existed to avoid on the page. */}
      <AddPrepButton tripId={tripId} />

      {offered.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-dashed border-border-strong p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-caption font-bold text-muted">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              כדאי לזכור
            </span>
            <button
              type="button"
              onClick={() => accept(offered)}
              disabled={adding}
              className="text-caption font-semibold text-primary-ink hover:underline disabled:opacity-60"
            >
              הוסיפו את כולם
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {offered.map((suggestion) => (
              <button
                key={suggestion.kind}
                type="button"
                onClick={() => accept([suggestion])}
                disabled={adding}
                className="inline-flex max-w-full items-center gap-1 rounded-control border border-border-strong bg-surface px-2.5 py-1 text-start text-caption font-semibold transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{suggestion.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 && offered.length === 0 && (
        <Card className="text-sm text-muted">הכול סומן. נסיעה טובה.</Card>
      )}

      {open.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border">
            {open.map((item) => (
              <PrepRow
                key={item.id}
                tripId={tripId}
                item={item}
                today={today}
                onToggle={(next) => void toggle(item, next)}
                onRemove={() => void remove(item)}
              />
            ))}
          </ul>
        </Card>
      )}

      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-caption font-semibold text-muted hover:text-foreground">
            הושלמו · {done.length}
          </summary>
          <Card padding="none" className="mt-2 overflow-hidden">
            <ul className="divide-y divide-border">
              {done.map((item) => (
                <PrepRow
                  key={item.id}
                  tripId={tripId}
                  item={item}
                  today={today}
                  onToggle={(next) => void toggle(item, next)}
                  onRemove={() => void remove(item)}
                />
              ))}
            </ul>
          </Card>
        </details>
      )}
    </section>
  );
}

function PrepRow({
  tripId,
  item,
  today,
  onToggle,
  onRemove,
}: {
  tripId: string;
  item: PrepItem;
  today: string;
  onToggle: (next: boolean) => void;
  onRemove: () => void;
}) {
  const provisional = item.id.startsWith("pending-");
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState(item.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const overdue = !item.done && item.due_date !== null && item.due_date < today;
  const dueSoon =
    !item.done && item.due_date !== null && !overdue && item.due_date <= shift(today, 3);

  function saveUrl() {
    startSaving(async () => {
      const result = await setPrepItemUrl(tripId, item.id, url);
      if (result.ok) {
        setLinking(false);
        setError(null);
      } else {
        setError(result.message ?? "השמירה נכשלה.");
      }
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-3 py-2.5",
        item.done && "opacity-60",
        provisional && "animate-pulse",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggle(!item.done)}
          disabled={provisional}
          aria-pressed={item.done}
          aria-label={item.done ? "סמנו כלא בוצע" : "סמנו כבוצע"}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.done
              ? "border-success bg-success text-white"
              : "border-border-strong bg-surface text-transparent hover:border-success hover:text-success",
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("text-sm font-semibold wrap-anywhere", item.done && "line-through")}>
            {item.title}
          </span>
          {item.due_date && (
            <span
              className={cn(
                "text-caption tabular-nums",
                overdue ? "font-bold text-danger-ink" : dueSoon ? "font-semibold text-callout-ink" : "text-muted",
              )}
            >
              {overdue ? "עבר · " : "עד "}
              {item.due_date.slice(8, 10)}.{item.due_date.slice(5, 7)}
            </span>
          )}
        </span>

        {item.url && !linking ? (
          <Link
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="פתיחת הקישור"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setLinking((current) => !current)}
          aria-label={item.url ? "עריכת הקישור" : "הוספת קישור למסמך"}
          aria-expanded={linking}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={provisional}
          aria-label="הסרה מהרשימה"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-danger-tint hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {linking && (
        <div className="flex flex-col gap-1.5 ps-10">
          <div className="flex gap-2">
            <Input
              dir="ltr"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://… (כרטיס, פוליסה, אישור)"
              className="min-w-0 flex-1 text-caption"
            />
            <Button type="button" size="sm" onClick={saveUrl} loading={saving}>
              שמירה
            </Button>
          </div>
          {error && <span className="text-caption text-danger-ink">{error}</span>}
        </div>
      )}
    </li>
  );
}

function AddPrepButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="self-start"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        הוספה לרשימה
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="מה עוד צריך לזכור?"
      >
        <PrepForm tripId={tripId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function PrepForm({
  tripId,
  onDone,
}: {
  tripId: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<PrepFormState, FormData>(
    addPrepItem,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful add (an empty state object). The form
  // is the external system here; no React state is touched.
  useEffect(() => {
    if (state && !state.errors && !state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tripId" value={tripId} />

      <Field label="מה לזכור" error={state?.errors?.title?.[0]}>
        <Input
          autoFocus
          name="title"
          placeholder="למשל: להזמין שולחן ל-Sushi Dai"
          maxLength={160}
          aria-invalid={Boolean(state?.errors?.title)}
        />
      </Field>

      {/* Both asked outright. On the page these were behind a <details>,
          because two more fields across the top of a list is two too many;
          a dialog has the room, and a deadline is the whole point of half
          these items. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="עד תאריך (לא חובה)" error={state?.errors?.dueDate?.[0]}>
          <Input type="date" name="dueDate" dir="ltr" />
        </Field>
        <Field label="קישור (לא חובה)" error={state?.errors?.url?.[0]}>
          <Input name="url" dir="ltr" inputMode="url" placeholder="https://" />
        </Field>
      </div>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={pending}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוספה
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          סיום
        </Button>
        <p className="text-caption text-muted">
          אפשר להוסיף כמה פריטים ברצף.
        </p>
      </div>
    </form>
  );
}

function shift(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
