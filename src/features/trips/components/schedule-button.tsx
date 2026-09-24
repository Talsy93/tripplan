"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  LoaderCircle,
  MousePointerClick,
  SkipForward,
  WandSparkles,
} from "lucide-react";
import { Banner, Button, Dialog, buttonClasses, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getSchedulingPlan,
  scheduleNewPlaces,
  schedulePlaceOnDay,
} from "../application/itinerary-actions";
import { daysForPlace, type SchedulingPlan } from "../domain/schedule-new";
import { formatShortDate } from "../domain/trip";
import { CategoryTile } from "./category-tile";

// The planning page's one orange action, "שיבוץ לימים".
//
// It used to do one thing — put every new place on the lightest day of its city
// and jump to מסלול. That is still the fast path, but it is a guess, and the
// owner asked for the other one too: choosing the day yourself. So the button
// opens a sheet that asks first ("איך לשבץ?") and offers both:
//
//   * **אוטומטי** — scheduleNewPlaces, unchanged: the same deterministic rule,
//     then מסלול to show the result.
//   * **ידני** — one place at a time. The place on top, its city's days as chips
//     under it (the lightest marked), a tap puts it there and moves on. "דלג"
//     moves on without placing it. "בחירה מהרשימה" opens the whole waiting list
//     so a specific place can be picked out of order.
//
// Manual stays on this page rather than going to מסלול after each tap: the
// point is to place several in a row, and the day view would take the list away
// after the first one. The page refreshes once, on "סיום".
type Mode = "choose" | "manual";

export function ScheduleButton({
  tripId,
  plan: initialPlan,
  className,
}: {
  tripId: string;
  plan: SchedulingPlan;
  className?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [plan, setPlan] = useState(initialPlan);
  const [autoPending, startAuto] = useTransition();

  // Re-seeded when the server sends a new plan (after a revalidation) — the
  // same render-time sync SelectedList uses, for the same reason.
  const [seenPlan, setSeenPlan] = useState(initialPlan);
  if (initialPlan !== seenPlan) {
    setSeenPlan(initialPlan);
    setPlan(initialPlan);
  }

  function openSheet() {
    setMode("choose");
    setOpen(true);
    // Fresh on open: a place scheduled from מסלול since this page rendered
    // should not be offered again. The sheet draws the page's copy meanwhile.
    getSchedulingPlan(tripId)
      .then((fresh) => {
        if (fresh) setPlan(fresh);
      })
      // Offline or signed out: the page's copy is still a correct answer.
      .catch(() => {});
  }

  function close(placed: number) {
    setOpen(false);
    if (placed > 0) {
      showToast(placed === 1 ? "מקום אחד שובץ" : `${placed} מקומות שובצו`);
      router.refresh();
    }
  }

  function scheduleAuto() {
    startAuto(async () => {
      const result = await scheduleNewPlaces(tripId);
      if (result.needsBuild) {
        showToast("עוד אין לו״ז — בונים אותו במסלול");
      } else if (result.placed > 0) {
        showToast(
          (result.placed === 1 ? "מקום אחד שובץ" : `${result.placed} מקומות שובצו`) +
            (result.unplaced > 0 ? ` · ${result.unplaced} בלי יום בעיר שלהם` : ""),
        );
      } else if (result.unplaced > 0) {
        showToast(`${result.unplaced} מקומות בעיר שאין לה עוד ימים בלו״ז`, "danger");
        return;
      } else if (!result.ok) {
        showToast("השיבוץ נכשל. נסו שוב.", "danger");
        return;
      } else {
        showToast("הכול כבר משובץ");
      }
      setOpen(false);
      router.push(`/trips/${tripId}/days`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(buttonClasses("primary", "md", "shrink-0 rounded-full px-5"), className)}
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        שיבוץ לימים
      </button>

      <Dialog
        open={open}
        onClose={() => close(0)}
        title={mode === "choose" ? "איך לשבץ?" : "שיבוץ ידני"}
      >
        {mode === "choose" ? (
          <ChooseMode
            tripId={tripId}
            plan={plan}
            autoPending={autoPending}
            onAuto={scheduleAuto}
            onManual={() => setMode("manual")}
          />
        ) : (
          <ManualMode
            tripId={tripId}
            plan={plan}
            onBack={() => setMode("choose")}
            onFinish={close}
          />
        )}
      </Dialog>
    </>
  );
}

function ChooseMode({
  tripId,
  plan,
  autoPending,
  onAuto,
  onManual,
}: {
  tripId: string;
  plan: SchedulingPlan;
  autoPending: boolean;
  onAuto: () => void;
  onManual: () => void;
}) {
  const count = plan.pending.length;

  if (count === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-muted">
          כל המקומות שבחרתם כבר נמצאים באחד הימים.
        </p>
        <Link
          href={`/trips/${tripId}/days`}
          className={buttonClasses("soft", "md", "self-start rounded-full")}
        >
          לראות את המסלול
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9375rem] text-muted">
        {count === 1 ? "מקום אחד ממתין לשיבוץ." : `${count} מקומות ממתינים לשיבוץ.`}
      </p>
      <OptionCard
        icon={<WandSparkles className="h-6 w-6" aria-hidden="true" />}
        title="אוטומטי"
        body="נחלק את המקומות החדשים לימים הקלים בעיר שלהם, ונראה לכם את התוצאה במסלול."
        onClick={onAuto}
        busy={autoPending}
      />
      <OptionCard
        icon={<MousePointerClick className="h-6 w-6" aria-hidden="true" />}
        title="ידני"
        body="אתם בוחרים יום לכל מקום — אחד אחרי השני, או מקום מסוים מהרשימה."
        onClick={onManual}
        disabled={autoPending}
      />
    </div>
  );
}

// One of the two answers, as a whole-card button: an icon on a tinted tile,
// the name, one line of what it will do, and a chevron that says "go".
function OptionCard({
  icon,
  title,
  body,
  onClick,
  busy = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className="flex min-h-20 w-full items-center gap-3.5 rounded-[20px] border border-border bg-surface p-4 text-start transition-[background-color,transform] duration-press ease-snap hover:bg-surface-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-primary-tint text-primary">
        {busy ? <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-bold">{title}</span>
        <span className="text-caption text-muted">{body}</span>
      </span>
      {/* RTL: forward points left. */}
      <ChevronLeft className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

function ManualMode({
  tripId,
  plan: initialPlan,
  onBack,
  onFinish,
}: {
  tripId: string;
  plan: SchedulingPlan;
  onBack: () => void;
  onFinish: (placed: number) => void;
}) {
  const { showToast } = useToast();
  // The walk runs over the plan as it was when it started. Each tap
  // revalidates the page, and the server answers with a plan that no longer
  // lists the place just scheduled — following it would shift every index
  // under the finger and lose the progress. The counts stay right through
  // `added` below; the page itself refreshes on "סיום".
  const [plan] = useState(initialPlan);
  const [index, setIndex] = useState(0);
  // Name → the day it went to, for the list's check and the summary.
  const [placed, setPlaced] = useState<Map<string, number>>(new Map());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  // Entries added this session, per day — the chips' counts move as you go.
  const [added, setAdded] = useState<Map<number, number>>(new Map());
  const [showList, setShowList] = useState(false);
  const [saving, startSaving] = useTransition();

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      חזרה לבחירה
    </button>
  );

  // No schedule yet: nothing to choose from. The first build is the model's
  // whole-schedule job and lives on מסלול, so this says so and points there.
  if (!plan.hasItinerary || plan.days.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <Banner tone="callout">
          עוד אין ימים לשבץ אליהם. את הלו״ז הראשון בונים במסלול — אחרי זה
          אפשר לחזור לכאן ולשבץ מקום-מקום.
        </Banner>
        <Link
          href={`/trips/${tripId}/days`}
          className={buttonClasses("brand", "md", "self-start rounded-full")}
        >
          לבניית הלו״ז במסלול
        </Link>
      </div>
    );
  }

  const pending = plan.pending;
  const total = pending.length;
  const current = pending[index] as (typeof pending)[number] | undefined;
  const load = (day: { day: number; items: string[] }) =>
    day.items.length + (added.get(day.day) ?? 0);

  // The next place that is still waiting, after `from`; wraps once so a
  // skipped place comes round again only when everything after it is dealt
  // with. -1 when nothing is left.
  function nextOpen(from: number, done: Map<string, number>, skip: Set<string>) {
    for (let step = 1; step <= total; step += 1) {
      const candidate = (from + step) % total;
      const name = pending[candidate].name;
      if (!done.has(name) && !skip.has(name)) return candidate;
    }
    return -1;
  }

  function advance(done: Map<string, number>, skip: Set<string>) {
    const next = nextOpen(index, done, skip);
    setIndex(next === -1 ? total : next);
  }

  function place(dayNumber: number) {
    if (!current) return;
    startSaving(async () => {
      const result = await schedulePlaceOnDay(tripId, {
        name: current.name,
        city: current.city,
        dayNumber,
      });
      if (!result.ok) {
        showToast("השיבוץ נכשל. נסו שוב.", "danger");
        return;
      }
      const done = new Map(placed).set(current.name, dayNumber);
      const skip = new Set(skipped);
      skip.delete(current.name);
      setPlaced(done);
      setSkipped(skip);
      setAdded((prev) => new Map(prev).set(dayNumber, (prev.get(dayNumber) ?? 0) + 1));
      advance(done, skip);
    });
  }

  function skip() {
    if (!current) return;
    const next = new Set(skipped).add(current.name);
    setSkipped(next);
    advance(placed, next);
  }

  const finish = (
    <Button
      type="button"
      variant={current ? "outline" : "brand"}
      className="w-full rounded-full"
      onClick={() => onFinish(placed.size)}
    >
      סיום
      {placed.size > 0 && ` · ${placed.size} שובצו`}
    </Button>
  );

  const list = (
    <ul className="flex flex-col overflow-hidden rounded-[18px] border border-border">
      {pending.map((item, i) => {
        const dayNumber = placed.get(item.name);
        const isCurrent = i === index;
        return (
          <li key={item.name} className="border-b border-border last:border-b-0">
            <button
              type="button"
              disabled={dayNumber !== undefined}
              onClick={() => {
                setIndex(i);
                setShowList(false);
              }}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isCurrent ? "bg-primary-tint" : "hover:bg-surface-2",
                dayNumber !== undefined && "opacity-60",
              )}
            >
              <CategoryTile category={item.category} className="h-9 w-9 rounded-[12px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{item.name}</span>
                <span className="truncate text-caption text-muted">
                  {item.city}
                  {dayNumber !== undefined
                    ? ` · שובץ ליום ${dayNumber}`
                    : skipped.has(item.name)
                      ? " · דולג"
                      : ""}
                </span>
              </span>
              {dayNumber !== undefined && (
                <Check className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  // Every place dealt with (placed or skipped): the summary.
  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
            <Check className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="text-lg font-bold">
            {placed.size === 0
              ? "לא שובץ אף מקום"
              : placed.size === 1
                ? "מקום אחד שובץ"
                : `${placed.size} מקומות שובצו`}
          </p>
          {skipped.size > 0 && (
            <p className="text-caption text-muted">
              {skipped.size === 1 ? "מקום אחד דולג" : `${skipped.size} מקומות דולגו`} — אפשר
              לחזור אליהם מהרשימה
            </p>
          )}
        </div>
        {skipped.size > 0 && list}
        {finish}
      </div>
    );
  }

  const { days, ownCity, lightest } = daysForPlace(current.city, plan.days, load);

  return (
    <div className="flex flex-col gap-4">
      {back}

      {/* Progress: "3 מתוך 7" and a bar, counting places dealt with. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-caption">
          <span className="font-semibold tabular-nums">
            {index + 1} מתוך {total}
          </span>
          <span className="text-muted tabular-nums">
            {placed.size} שובצו{skipped.size > 0 && ` · ${skipped.size} דולגו`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((placed.size + skipped.size) / total) * 100}%` }}
          />
        </div>
      </div>

      {showList ? (
        <>
          <p className="text-sm font-bold">בחרו מקום לשבץ</p>
          {list}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowList(false)}
          >
            חזרה למקום הנוכחי
          </Button>
        </>
      ) : (
        <>
          {/* The place. */}
          <div className="flex min-w-0 items-center gap-3 rounded-[20px] bg-surface-sunken p-3.5">
            <CategoryTile category={current.category} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-bold wrap-anywhere">{current.name}</span>
              <span className="text-caption text-muted">{current.city || "בלי עיר"}</span>
            </span>
          </div>

          {/* Its days. */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">
              {ownCity ? `לאיזה יום ב${current.city}?` : "לאיזה יום?"}
            </p>
            {!ownCity && (
              <p className="text-caption text-muted">
                {current.city ? `ל${current.city} אין עדיין ימים בלו״ז — ` : ""}
                מוצגים כל הימים.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {days.map((day) => {
                const count = load(day);
                const isLightest = day.day === lightest;
                return (
                  <button
                    key={day.day}
                    type="button"
                    disabled={saving}
                    onClick={() => place(day.day)}
                    aria-label={`יום ${day.day}${day.date ? `, ${formatShortDate(day.date)}` : ""}, ${count === 0 ? "ריק" : `${count} פריטים`}${isLightest ? ", הכי פנוי" : ""}`}
                    className={cn(
                      "relative flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-[18px] border px-1.5 py-2 text-center transition-[background-color,transform] duration-press ease-snap active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                      isLightest
                        ? "border-primary bg-primary-tint text-primary-ink"
                        : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    <span className="text-sm font-bold tabular-nums">יום {day.day}</span>
                    {day.date && (
                      <span className="text-[0.6875rem] tabular-nums text-muted">
                        {formatShortDate(day.date)}
                      </span>
                    )}
                    <span className="text-[0.6875rem] font-medium">
                      {isLightest
                        ? "הכי פנוי"
                        : count === 0
                          ? "ריק"
                          : count === 1
                            ? "פריט אחד"
                            : `${count} פריטים`}
                    </span>
                    {!ownCity && day.city && (
                      <span className="max-w-full truncate text-[0.625rem] text-muted">
                        {day.city}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setShowList(true)}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              בחירה מהרשימה
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 rounded-full"
              onClick={skip}
              disabled={saving}
            >
              דלג
              <SkipForward className="h-4 w-4 -scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}

      {finish}
    </div>
  );
}
