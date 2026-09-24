"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Info,
  CloudOff,
  DoorOpen,
  ExternalLink,
  Gem,
  Globe,
  Heart,
  Hourglass,
  Landmark,
  LoaderCircle,
  MapPin,
  Plus,
  RotateCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Trees,
  Undo2,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, Dialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { normaliseName } from "@/lib/text";
import {
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_ORDER,
  MUST_SEE_LANGUAGES,
  POPULAR_LANGUAGES,
  feeLabel,
  googleMapsUrl,
  visitLabel,
  type DiscoverCard,
  type DiscoverCategory,
} from "../domain/discover";
import { addDiscoveredCard } from "../application/place-actions";
import { setSelected } from "../application/guide-actions";

// "גילוי" — the swipe deck, from design/pencil/mytrip.pen (phase PN): a city
// pill and one filter button, the category chips, one card in focus with two
// edges behind it, the four buttons with their labels, and the saved counter.
// A card with no photograph is its category's colour and icon.
//
// Right is yes and left is no, whatever the reading direction — that is what
// the export does ("dragging rightwards … means SAVE") and what every swipe
// app has taught the hand. A yes saves the place to the trip, the same row a
// place found on the planning screen becomes, so it is on the map and in the
// next schedule build.

// One destination the deck can be dealt from: a city, or a country with all
// of the trip's cities in it.
export type DiscoverDestination = {
  key: string;
  // "רומא" / "איטליה" — what the pill says after "מגלים את".
  label: string;
  cities: string[];
  flag: string;
  kind: "city" | "country";
};

type Decision = { card: DiscoverCard; saved: boolean };

// How far a drag has to travel before letting go counts as a choice. The
// export's own number.
const THRESHOLD = 90;
// Where a card flies to when it goes.
const FLY = 450;

export function DiscoverDeck({
  tripId,
  destinations,
  initialKey,
  savedCount: initialSaved,
  savedKeys,
  scheduledNames = [],
  // For the preview harness: a dealt deck, so the scene needs no network.
  initialCards,
}: {
  tripId: string;
  destinations: DiscoverDestination[];
  initialKey: string | null;
  savedCount: number;
  // `city|name` of every place already in the trip — dealt cards skip them.
  savedKeys: string[];
  // Every title already on the schedule, normalised (normaliseName). A place
  // that is on some day already is not dealt again, whatever list put it there
  // — asked for directly: "the places shown must not already be in the
  // schedule".
  scheduledNames?: string[];
  initialCards?: DiscoverCard[];
}) {
  const { showToast } = useToast();
  const [destKey, setDestKey] = useState(initialKey);
  const destination = destinations.find((entry) => entry.key === destKey) ?? null;
  const [category, setCategory] = useState<DiscoverCategory>("all");

  const [cards, setCards] = useState<DiscoverCard[] | null>(initialCards ?? null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  // What has been decided this session, newest last — the undo stack, and the
  // set of cards not to deal again.
  const [decided, setDecided] = useState<Decision[]>([]);
  // Bookmarked: "not now, show me again" — the card goes to the back.
  const [later, setLater] = useState<string[]>([]);
  const [saved, setSaved] = useState(initialSaved);

  const [picking, setPicking] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [details, setDetails] = useState<DiscoverCard | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyKnown, setOnlyKnown] = useState(false);
  const filtered = onlyFree || onlyKnown || query.trim() !== "";

  // ---- dealing -------------------------------------------------------------

  // Which deal is current. A chip pressed while a deck is still filling in
  // must stop the old deck's follow-ups from landing on the new one.
  const generation = useRef(0);
  // True while the server is still dealing the full deck behind a quick one.
  const [filling, setFilling] = useState(false);
  // The last deal ended without the full deck (see the end of load).
  const [incomplete, setIncomplete] = useState(false);

  const load = useCallback(async () => {
    if (!destination) return;
    const mine = ++generation.current;
    setState("loading");
    setFilling(false);
    setIncomplete(false);

    const ask = async () =>
      fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripId,
          cities: destination.cities.slice(0, 4),
          // The deck is every chip's cards at once; the chips filter it here.
          category: "all",
        }),
      });

    // Once more on its own before saying anything: a 503 here is the map
    // server being busy, and the next try a moment later usually lands on the
    // one that is not (see OVERPASS_ENDPOINTS). A person pressing "נסו שוב"
    // for what the code could have retried is a failure shown for nothing.
    let first: { cards?: DiscoverCard[]; partial?: boolean } | null = null;
    for (let attempt = 0; attempt < 2 && !first; attempt++) {
      try {
        const res = await ask();
        if (res.status === 503 && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          continue;
        }
        if (!res.ok) break;
        first = await res.json();
      } catch {
        break;
      }
    }
    if (mine !== generation.current) return;
    if (!first) {
      setState("error");
      return;
    }
    setCards(first.cards ?? []);
    setState("idle");

    // A city's first deal: the server answered with what it had in eight
    // seconds (the quick deck under "הכל", nothing under the other chips) and
    // is still dealing the rest. Ask again every few seconds and put what has
    // arrived at the back of the pile, so the card in hand never changes under
    // the thumb. Stops when the answer is whole, or after about a minute.
    let partial = first.partial === true;
    setFilling(partial);
    for (let round = 0; partial && round < 10; round++) {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      if (mine !== generation.current) return;
      try {
        const res = await ask();
        if (!res.ok) continue;
        const more = (await res.json()) as { cards?: DiscoverCard[]; partial?: boolean };
        if (mine !== generation.current) return;
        partial = more.partial === true;
        setCards((current) => {
          const known = new Set((current ?? []).map((card) => card.wikidata));
          return [
            ...(current ?? []),
            ...(more.cards ?? []).filter((card) => !known.has(card.wikidata)),
          ];
        });
      } catch {
        // The next round asks again.
      }
    }
    if (mine === generation.current) {
      setFilling(false);
      // Still partial after a minute: the full deal did not make it this time.
      // Said so, with a way to ask again, rather than a spinner that never
      // stops or a "nothing here" that is not true.
      setIncomplete(partial);
    }
  }, [destination, tripId]);

  // Dealt on arrival and whenever the destination changes — not the chip: a
  // chip is a filter over the deck in hand, so pressing one is instant. Keyed
  // on what the deck is *for*, not on the effect having run. A "first run"
  // flag was the first version, and development's double-invoked effects
  // spent it on the first pass and fetched on the second, throwing away the
  // preview's pre-dealt deck.
  const dealtFor = useRef(initialCards ? initialKey : null);
  useEffect(() => {
    const key = destKey;
    if (dealtFor.current === key) return;
    dealtFor.current = key;
    void load();
  }, [load, destKey]);

  const inTrip = useMemo(() => new Set(savedKeys), [savedKeys]);
  const onSchedule = useMemo(() => new Set(scheduledNames), [scheduledNames]);
  const deck = useMemo(() => {
    const decidedIds = new Set(decided.map((entry) => entry.card.id));
    const needle = query.trim().toLowerCase();
    const open = (cards ?? []).filter(
      (card) =>
        !decidedIds.has(card.id) &&
        !inTrip.has(`${card.city}|${card.name}`) &&
        !onSchedule.has(normaliseName(card.name)) &&
        !(card.localName && onSchedule.has(normaliseName(card.localName))) &&
        (category === "all" || card.category === category) &&
        (!onlyFree || card.fee === false) &&
        (!onlyKnown || card.languages >= MUST_SEE_LANGUAGES) &&
        (!needle ||
          card.name.toLowerCase().includes(needle) ||
          (card.localName ?? "").toLowerCase().includes(needle)),
    );
    // One card per name: two OSM objects for one place (a church and its
    // square, a node and a way) can carry two Wikidata ids and the same name.
    const seenNames = new Set<string>();
    const unique = open.filter((card) => {
      const key = normaliseName(card.name);
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
    // "פינות נסתרות" is the places fewer people have heard of: least known
    // first, the one chip dealt the other way round.
    if (category === "hidden") unique.sort((a, b) => a.languages - b.languages);
    // Bookmarked cards go behind everything else, in the order they were sent.
    const back = later.flatMap((id) => unique.filter((card) => card.id === id));
    return [...unique.filter((card) => !later.includes(card.id)), ...back];
  }, [cards, decided, later, inTrip, onSchedule, onlyFree, onlyKnown, query, category]);

  const top = deck[0] ?? null;
  const next = deck[1] ?? null;

  // ---- deciding ------------------------------------------------------------

  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"save" | "pass" | null>(null);
  const start = useRef<{ x: number; id: number } | null>(null);

  async function decide(card: DiscoverCard, save: boolean) {
    setLeaving(save ? "save" : "pass");
    await new Promise((resolve) => setTimeout(resolve, 350));
    setLeaving(null);
    setDrag(0);
    setDecided((current) => [...current, { card, saved: save }]);
    setLater((current) => current.filter((id) => id !== card.id));
    if (!save) return;

    setSaved((count) => count + 1);
    if (!(await addDiscoveredCard(tripId, card))) {
      setSaved((count) => count - 1);
      setDecided((current) => current.filter((entry) => entry.card.id !== card.id));
      showToast("השמירה נכשלה. נסו שוב.", "danger");
    }
  }

  async function undo() {
    const last = decided.at(-1);
    if (!last) return;
    setDecided((current) => current.slice(0, -1));
    if (!last.saved) return;
    setSaved((count) => count - 1);
    await setSelected(
      tripId,
      last.card.city,
      last.card.placeCategory,
      last.card.name,
      false,
    );
    showToast(`״${last.card.name}״ הוסר מהמסלול`);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!top || leaving) return;
    start.current = { x: event.clientX, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function onPointerMove(event: React.PointerEvent) {
    if (!start.current || start.current.id !== event.pointerId) return;
    setDrag(event.clientX - start.current.x);
  }
  function onPointerUp() {
    if (!start.current || !top) return;
    start.current = null;
    setDragging(false);
    if (drag > THRESHOLD) void decide(top, true);
    else if (drag < -THRESHOLD) void decide(top, false);
    else setDrag(0);
  }

  // Keyboard: ← passes, → saves — the arrows point where the card goes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!top || leaving || picking || filtering || details) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select")) {
        return;
      }
      if (event.key === "ArrowRight") void decide(top, true);
      if (event.key === "ArrowLeft") void decide(top, false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const offset = leaving === "save" ? FLY : leaving === "pass" ? -FLY : drag;
  const likeOpacity = leaving === "save" ? 1 : Math.min(Math.max(drag - 25, 0) / 75, 1);
  const passOpacity = leaving === "pass" ? 1 : Math.min(Math.max(-drag - 25, 0) / 75, 1);

  // ---- render --------------------------------------------------------------

  if (destinations.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 pt-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint">
          <MapPin className="h-9 w-9 text-primary" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">עוד אין יעדים לגלות בהם</h1>
        <p className="text-sm text-muted">הוסיפו עיר לטיול, והגילוי יחלק כאן מקומות ממנה.</p>
        <Link
          href={`/trips/${tripId}/explore`}
          className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-cta px-6 text-sm font-semibold text-cta-foreground"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          הוספת יעד
        </Link>
      </div>
    );
  }

  const others = destinations.filter((entry) => entry.key !== destKey);
  const savedHere = decided.filter((entry) => entry.saved).length;
  const skippedHere = decided.length - savedHere;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col pt-1 select-none">
      <h1 className="sr-only">גילוי מקומות</h1>

      {/* Where, and the one filter button. The quick search lives inside the
          filter sheet: two round buttons side by side read as a toolbar, and
          the design asks for less chrome above the card, not more. */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 text-start transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MapPin className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-base font-semibold text-foreground">
            {destination?.label ?? "…"}
          </span>
          {destination?.kind === "country" && (
            <span className="truncate text-[13px] text-outline">
              {destination.cities.length} ערים
            </span>
          )}
          <ChevronDown className="ms-auto h-4 w-4 shrink-0 text-outline" aria-hidden="true" />
        </button>
        {/* Saved so far — a small chip beside the filter, so the card can
            have the height. Also the way to the list. */}
        <Link
          href={`/trips/${tripId}/explore`}
          aria-label={saved === 1 ? "מקום אחד נשמר לטיול — לרשימה" : `${saved} מקומות נשמרו לטיול — לרשימה`}
          title="נשמרו לטיול"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary-tint px-3.5 text-sm font-bold text-primary transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden="true" />
          {saved}
        </Link>
        <button
          type="button"
          onClick={() => setFiltering(true)}
          aria-label="חיפוש וסינון"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          {filtered && (
            <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-cta" />
          )}
        </button>
      </div>

      {/* Category chips — one line that scrolls, never wraps. */}
      <div
        className="-mx-4 mt-3.5 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="קטגוריות"
      >
        {DISCOVER_CATEGORY_ORDER.map((key) => {
          const Icon = CATEGORY_ICON[key];
          const on = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              aria-pressed={on}
              className={cn(
                "flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "bg-foreground text-background"
                  : "border border-border bg-surface text-muted",
              )}
            >
              <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
              {DISCOVER_CATEGORIES[key].label}
            </button>
          );
        })}
      </div>

      {/* The stack, Tinder's way: the next card itself waits behind the one in
          hand, a little smaller, and grows into place as the top one is dragged
          off — so the hand always sees there is more, and what it is. */}
      <div className="relative mt-3 h-[clamp(360px,calc(100dvh-432px),600px)] w-full">
        {top && next && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `scale(${0.94 + 0.06 * Math.min(Math.abs(offset) / FLY, 1)})`,
              transition: dragging ? "none" : "transform 0.35s ease-out",
            }}
          >
            <PlaceFace card={next} />
          </div>
        )}

        {state === "loading" || (!top && filling && category === "all") ? (
          <SkeletonCard label={`מחפשים מקומות ב${destination?.label ?? ""}…`} />
        ) : !top && (filling || incomplete) ? (
          // A chip the full deck has not reached yet. Not a spinner with no
          // end: what is happening, and the way back to what is ready.
          <DeckMessage
            tone="bg-primary-tint text-primary"
            icon={
              filling ? (
                <LoaderCircle className="h-9 w-9 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-9 w-9" aria-hidden="true" />
              )
            }
            title={
              filling
                ? `עוד אוספים ${DISCOVER_CATEGORIES[category].label} ב${destination?.label ?? ""}`
                : "החפיסה המלאה עוד לא הגיעה"
            }
            text={
              filling
                ? "זה לוקח עד דקה בפעם הראשונה בעיר. בינתיים יש כרטיסים בקטגוריות אחרות."
                : "השרת של המפות איטי כרגע. אפשר לנסות שוב, או לחזור לכל המקומות."
            }
          >
            <div className="flex w-full flex-col gap-2.5">
              {!filling && (
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background"
                >
                  לנסות שוב
                  <RotateCw className="h-[17px] w-[17px]" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCategory("all")}
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-foreground"
              >
                לכל המקומות
              </button>
            </div>
          </DeckMessage>
        ) : state === "error" ? (
          <DeckMessage
            tone="bg-callout-tint text-callout-ink"
            icon={<CloudOff className="h-9 w-9" aria-hidden="true" />}
            title="שרת המפות עמוס כרגע"
            text="זה לא אצלכם. בדרך כלל זה עובר תוך דקה, ומה ששמרתם לא נמחק."
          >
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background"
            >
              לנסות שוב
              <RotateCw className="h-[17px] w-[17px]" aria-hidden="true" />
            </button>
          </DeckMessage>
        ) : !top ? (
          (cards ?? []).some((card) => category === "all" || card.category === category) && !filtered ? (
            <DeckMessage
              tone="bg-success-tint text-success"
              icon={<Check className="h-9 w-9" aria-hidden="true" />}
              title={`עברתם על כל המקומות ב${destination?.label ?? ""}`}
              text={
                decided.length > 0
                  ? `${savedHere} נשמרו · ${skippedHere} דילגתם`
                  : "נסו קטגוריה אחרת."
              }
            >
              <div className="flex w-full flex-col gap-2.5">
                <Link
                  href={`/trips/${tripId}/days`}
                  className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-cta text-base font-semibold text-cta-foreground"
                >
                  שיבוץ המקומות לימים
                  <CalendarDays className="h-[19px] w-[19px]" aria-hidden="true" />
                </Link>
                {others[0] && (
                  <button
                    type="button"
                    onClick={() => setDestKey(others[0].key)}
                    className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-surface text-sm font-medium text-foreground"
                  >
                    מעבר ל{others[0].label}
                    <ArrowLeft className="h-4 w-4 text-muted" aria-hidden="true" />
                  </button>
                )}
              </div>
            </DeckMessage>
          ) : (
            <DeckMessage
              tone="bg-surface-sunken text-muted"
              icon={<Search className="h-9 w-9" aria-hidden="true" />}
              title={category === "all" ? "לא נמצאו כאן מקומות" : `אין כאן מקומות ב״${DISCOVER_CATEGORIES[category].label}״`}
              text={filtered ? "נסו לנקות את הסינון או את החיפוש." : "נסו קטגוריה אחרת או יעד אחר."}
            />
          )
        ) : (
          <PlaceCard
            key={top.id}
            card={top}
            offset={offset}
            dragging={dragging}
            likeOpacity={likeOpacity}
            passOpacity={passOpacity}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onLater={() => {
              setLater((current) => [...current.filter((id) => id !== top.id), top.id]);
              showToast("נחזור אליו בסוף החפיסה");
            }}
            onDetails={() => setDetails(top)}
          />
        )}
      </div>

      {/* The four buttons, each on the side its gesture goes: skip left, save
          right. Save is the biggest because it is the one that does something. */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <ActionButton label="ביטול" size="sm" onClick={() => void undo()} disabled={decided.length === 0}>
          <Undo2 className="h-5 w-5 text-cta-bright" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          label="דלג"
          size="md"
          onClick={() => top && void decide(top, false)}
          disabled={!top || Boolean(leaving)}
        >
          <X className="h-8 w-8 text-danger" strokeWidth={2.5} aria-hidden="true" />
        </ActionButton>
        <ActionButton
          label="שמור"
          size="lg"
          onClick={() => top && void decide(top, true)}
          disabled={!top || Boolean(leaving)}
          filled
        >
          <Heart className="h-[34px] w-[34px] fill-current text-success" aria-hidden="true" />
        </ActionButton>
        {top ? (
          <ActionButton
            label="שאל AI"
            size="sm"
            href={`/trips/${tripId}/ai?q=${encodeURIComponent(`ספר לי על ${top.name} ב${top.city} — מתי הכי כדאי להגיע, כמה זמן לתכנן ואיזה טיפ שכדאי לדעת?`)}`}
          >
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          </ActionButton>
        ) : (
          <ActionButton label="שאל AI" size="sm" disabled>
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          </ActionButton>
        )}
      </div>

      <p className="mt-3 hidden items-center justify-center gap-4 text-xs text-outline lg:flex" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <Kbd>→</Kbd> שמור
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>←</Kbd> דלג
        </span>
      </p>

      {/* ---- dialogs ---- */}

      <Dialog open={picking} onClose={() => setPicking(false)} title="איפה מגלים?">
        <ul className="flex flex-col gap-1">
          {destinations.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => {
                  setDestKey(entry.key);
                  setPicking(false);
                }}
                aria-pressed={entry.key === destKey}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition-colors",
                  entry.key === destKey ? "bg-primary-tint" : "hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    entry.key === destKey ? "bg-surface text-primary" : "bg-surface-2 text-muted",
                  )}
                >
                  {entry.kind === "country" ? (
                    <Globe className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{entry.label}</span>
                  <span className="truncate text-xs text-muted">
                    {entry.kind === "country"
                      ? `כל המדינה — ${entry.cities.join(", ")}`
                      : "עיר בטיול"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={filtering} onClose={() => setFiltering(false)} title="חיפוש וסינון">
        <div className="flex flex-col gap-3">
          <label className="flex h-12 items-center gap-2.5 rounded-full border border-border bg-surface px-4 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="שם של מקום, למשל פנתיאון"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
            />
          </label>
          <Toggle checked={onlyFree} onChange={setOnlyFree} label="רק כניסה חופשית" hint="לפי תג הכניסה ב-OpenStreetMap" />
          <Toggle checked={onlyKnown} onChange={setOnlyKnown} label="רק אתרי חובה" hint={`מקומות שיש עליהם ערך בוויקיפדיה ב-${MUST_SEE_LANGUAGES} שפות ומעלה`} />
          <div className="flex gap-2 pt-1">
            {filtered && (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setOnlyFree(false);
                  setOnlyKnown(false);
                }}
              >
                ניקוי
              </Button>
            )}
            <Button variant="brand" className="flex-1" onClick={() => setFiltering(false)}>
              הצגה
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={details !== null}
        onClose={() => setDetails(null)}
        title={details?.name ?? ""}
      >
        {details && (
          <DetailsBody
            card={details}
            onSkip={() => {
              setDetails(null);
              if (top && details.id === top.id) void decide(top, false);
            }}
            onSave={() => {
              setDetails(null);
              if (top && details.id === top.id) void decide(top, true);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// ---- pieces ----------------------------------------------------------------

const CATEGORY_ICON: Record<DiscoverCategory, LucideIcon> = {
  all: Sparkles,
  mustsee: Landmark,
  food: Utensils,
  nature: Trees,
  shopping: ShoppingBag,
  hidden: Gem,
};

// The card's colour when there is no photograph — and there usually is none
// for a café or a fountain. Static class names, so Tailwind sees them.
const CATEGORY_TONE: Record<DiscoverCategory, { field: string; ink: string; tag: string }> = {
  all: { field: "bg-surface-sunken", ink: "text-muted", tag: "bg-foreground" },
  mustsee: { field: "bg-cat-mustsee-tint", ink: "text-cat-mustsee-ink", tag: "bg-cat-mustsee-ink" },
  food: { field: "bg-cat-food-tint", ink: "text-cat-food-ink", tag: "bg-cat-food-ink" },
  nature: { field: "bg-cat-nature-tint", ink: "text-cat-nature-ink", tag: "bg-cat-nature-ink" },
  shopping: { field: "bg-cat-shopping-tint", ink: "text-cat-shopping-ink", tag: "bg-cat-shopping-ink" },
  hidden: { field: "bg-cat-hidden-tint", ink: "text-cat-hidden-ink", tag: "bg-cat-hidden-ink" },
};

function PlaceCard({
  card,
  offset,
  dragging,
  likeOpacity,
  passOpacity,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLater,
  onDetails,
}: {
  card: DiscoverCard;
  offset: number;
  dragging: boolean;
  likeOpacity: number;
  passOpacity: number;
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: () => void;
  onLater: () => void;
  onDetails: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 touch-pan-y",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{
        transform: `translate(${offset}px, ${Math.abs(offset) * 0.06}px) rotate(${offset * 0.05}deg)`,
        transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PlaceFace
        card={card}
        onLater={onLater}
        onDetails={onDetails}
        likeOpacity={likeOpacity}
        passOpacity={passOpacity}
      />
    </div>
  );
}

// The card's face — the one in hand, and the next one waiting behind it.
//
// Tinder's card: the picture is the whole card, edge to edge, and the words sit
// on it at the bottom over a dark fade. A place with no Commons photograph gets
// its category's deep colour and a big glyph instead of a grey box, so a café
// or a fountain is still a card worth looking at.
function PlaceFace({
  card,
  onLater,
  onDetails,
  likeOpacity = 0,
  passOpacity = 0,
}: {
  card: DiscoverCard;
  onLater?: () => void;
  onDetails?: () => void;
  likeOpacity?: number;
  passOpacity?: number;
}) {
  const Icon = CATEGORY_ICON[card.category];
  const tone = CATEGORY_TONE[card.category];
  const fee = feeLabel(card.fee);
  const interactive = Boolean(onDetails);
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[24px] bg-cover bg-center shadow-lift",
        !card.image && tone.tag,
      )}
      style={card.image ? { backgroundImage: `url("${card.image}")` } : undefined}
      role="img"
      aria-label={card.name}
    >
      {!card.image && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/25" />
          <Icon
            className="absolute top-[22%] left-1/2 h-28 w-28 -translate-x-1/2 text-white/85"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </>
      )}

      {/* The fade the words stand on. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

      {/* Top: what kind of place, and "later". */}
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {card.languages >= MUST_SEE_LANGUAGES && (
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-bold text-foreground backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 fill-cta text-cta" aria-hidden="true" />
              אתר חובה
            </span>
          )}
          {card.languages >= POPULAR_LANGUAGES && (
            <span className="rounded-full bg-black/35 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              פופולרי
            </span>
          )}
        </div>
        {onLater && (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onLater}
            aria-label="לחזור אליו אחר כך"
            title="לחזור אליו אחר כך"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-transform active:scale-90"
          >
            <Bookmark className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Stamps — the gesture explaining itself as the card moves. */}
      <Stamp className="top-16 left-6 -rotate-[14deg] border-success text-success" opacity={likeOpacity}>
        שמור
      </Stamp>
      <Stamp className="top-16 right-6 rotate-[14deg] border-danger text-danger" opacity={passOpacity}>
        דלג
      </Stamp>

      {/* Bottom: the name large, then the one line that says why, then facts. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 text-white">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[30px] leading-[1.1] font-bold [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
              {card.name}
            </h2>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-white/80">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="shrink-0">{card.kindLabel}</span>
              {card.localName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span dir="auto" className="truncate">{card.localName}</span>
                </>
              )}
            </p>
          </div>
          {interactive && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onDetails}
              aria-label="פרטים מלאים"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <Info className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {card.summary && (
          <p className="line-clamp-2 text-sm leading-[1.45] text-white/85">{card.summary}</p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Fact icon={Hourglass}>{visitLabel(card.visit)}</Fact>
          {fee && <Fact icon={Ticket}>{fee}</Fact>}
          {interactive && (
            // The rating slot: Google's stars are only served by the paid Places
            // API, so the chip is the way to them (see googleMapsUrl).
            <a
              href={googleMapsUrl(card)}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25"
            >
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              ביקורות בגוגל
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stamp({
  className,
  opacity,
  children,
}: {
  className: string;
  opacity: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 rounded-xl border-4 bg-white/90 px-4 py-1.5 text-[30px] leading-none font-extrabold tracking-wide",
        className,
      )}
      style={{ opacity }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

const ACTION_SIZE = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-[72px] w-[72px]",
} as const;

// Tinder's row: round white buttons, the colour in the glyph, no words under
// them — the label is for the screen reader and the tooltip.
function ActionButton({
  label,
  size,
  onClick,
  href,
  disabled,
  children,
}: {
  label: string;
  size: keyof typeof ACTION_SIZE;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}) {
  const disc = cn(
    "flex items-center justify-center rounded-full bg-surface shadow-lift transition-transform hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ACTION_SIZE[size],
    disabled && "pointer-events-none opacity-40",
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={disc} aria-label={label} title={label}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={disc} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border border-border bg-surface px-1.5 font-sans text-[11px] font-semibold text-muted">
      {children}
    </kbd>
  );
}

function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="absolute inset-x-0 top-0 bottom-3 flex flex-col overflow-hidden rounded-[28px] bg-surface shadow-lift">
      <div className="h-[172px] animate-pulse bg-surface-sunken" />
      <div className="flex flex-col items-end gap-3 p-5">
        <div className="h-[22px] w-44 animate-pulse rounded-md bg-surface-sunken" />
        <div className="h-3 w-28 animate-pulse rounded-md bg-surface-sunken" />
        <div className="h-3 w-full animate-pulse rounded-md bg-surface-sunken" />
        <div className="h-3 w-4/5 animate-pulse rounded-md bg-surface-sunken" />
      </div>
      <div className="mt-auto flex items-center justify-center gap-2 pb-8 text-[13px] font-medium text-outline">
        <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

function DeckMessage({
  tone,
  icon,
  title,
  text,
  children,
}: {
  tone: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <span className={cn("flex h-20 w-20 items-center justify-center rounded-full", tone)}>{icon}</span>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm leading-[1.5] text-muted">{text}</p>
      {children && <div className="mt-3 flex w-full justify-center">{children}</div>}
    </div>
  );
}

function DetailsBody({
  card,
  onSkip,
  onSave,
}: {
  card: DiscoverCard;
  onSkip: () => void;
  onSave: () => void;
}) {
  const Icon = CATEGORY_ICON[card.category];
  const tone = CATEGORY_TONE[card.category];
  const fee = feeLabel(card.fee);
  return (
    <div className="flex flex-col gap-4">
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Commons redirect, not an optimisable asset
        <img src={card.image} alt="" className="h-44 w-full rounded-2xl object-cover" />
      ) : null}
      <div className="flex items-center gap-3">
        <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]", tone.field)}>
          <Icon className={cn("h-[26px] w-[26px]", tone.ink)} aria-hidden="true" />
        </span>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] text-outline">
          <span>{card.kindLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{card.city}</span>
          {card.localName && (
            <>
              <span aria-hidden="true">·</span>
              <span dir="auto">{card.localName}</span>
            </>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2.5">
        <DetailTile icon={Ticket} label="כניסה">{fee ?? "לא ידוע"}</DetailTile>
        <DetailTile icon={DoorOpen} label="שעות פעילות">
          {card.openingHours ? <span dir="ltr">{card.openingHours}</span> : "כדאי לבדוק"}
        </DetailTile>
        <DetailTile icon={Hourglass} label="זמן ביקור מומלץ">{visitLabel(card.visit)}</DetailTile>
        <DetailTile icon={Star} label="דירוג וביקורות">
          <a
            href={googleMapsUrl(card)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            בגוגל מפות
          </a>
        </DetailTile>
      </dl>

      {card.summary && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-semibold">על המקום</h3>
          <p className="text-sm leading-[1.55] text-muted">{card.summary}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {card.wikiUrl && (
          <a
            href={card.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium"
          >
            <ExternalLink className="h-[15px] w-[15px]" aria-hidden="true" />
            בוויקיפדיה
          </a>
        )}
        {card.website && (
          <a
            href={card.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium"
          >
            <ExternalLink className="h-[15px] w-[15px]" aria-hidden="true" />
            אתר המקום
          </a>
        )}
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex h-[52px] w-28 items-center justify-center gap-1.5 rounded-full border border-border text-[15px] font-medium text-muted"
        >
          דלג
          <X className="h-[18px] w-[18px] text-danger" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-success text-base font-semibold text-white"
        >
          שמירה לטיול
          <Heart className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[11px] text-outline">
        מידע ותמונה: OpenStreetMap, ויקיפדיה ו-Wikimedia Commons. הדירוג והביקורות — בגוגל מפות.
      </p>
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-3.5">
      <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
      <dd className="text-[15px] font-semibold wrap-anywhere">{children}</dd>
      <dt className="text-xs text-outline">{label}</dt>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
      />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
