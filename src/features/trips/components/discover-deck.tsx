"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  Info,
  Star,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button, Dialog, Input, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
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

// "גילוי" — the swipe deck, from design/stitch/…/discover_page, block for
// block: the destination pill with the search and filter buttons beside it,
// the category chips, a stack of three cards with the top one a photograph,
// the four round buttons, and the "saved to your route" pill.
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
  // For the preview harness: a dealt deck, so the scene needs no network.
  initialCards,
}: {
  tripId: string;
  destinations: DiscoverDestination[];
  initialKey: string | null;
  savedCount: number;
  // `city|name` of every place already in the trip — dealt cards skip them.
  savedKeys: string[];
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
  const [searching, setSearching] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [details, setDetails] = useState<DiscoverCard | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyKnown, setOnlyKnown] = useState(false);
  const filtered = onlyFree || onlyKnown || query.trim() !== "";

  // ---- dealing -------------------------------------------------------------

  const load = useCallback(async () => {
    if (!destination) return;
    setState("loading");
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripId,
          cities: destination.cities.slice(0, 4),
          category,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { cards?: DiscoverCard[] };
      setCards(json.cards ?? []);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [destination, category, tripId]);

  // Dealt on arrival and whenever the destination or the chip changes — keyed
  // on what the deck is *for*, not on the effect having run. A "first run"
  // flag was the first version, and development's double-invoked effects
  // spent it on the first pass and fetched on the second, throwing away the
  // preview's pre-dealt deck.
  const dealtFor = useRef(initialCards ? `${initialKey}|all` : null);
  useEffect(() => {
    const key = `${destKey}|${category}`;
    if (dealtFor.current === key) return;
    dealtFor.current = key;
    void load();
  }, [load, destKey, category]);

  const inTrip = useMemo(() => new Set(savedKeys), [savedKeys]);
  const deck = useMemo(() => {
    const decidedIds = new Set(decided.map((entry) => entry.card.id));
    const needle = query.trim().toLowerCase();
    const open = (cards ?? []).filter(
      (card) =>
        !decidedIds.has(card.id) &&
        !inTrip.has(`${card.city}|${card.name}`) &&
        (!onlyFree || card.fee === false) &&
        (!onlyKnown || card.languages >= MUST_SEE_LANGUAGES) &&
        (!needle ||
          card.name.toLowerCase().includes(needle) ||
          (card.localName ?? "").toLowerCase().includes(needle)),
    );
    // Bookmarked cards go behind everything else, in the order they were sent.
    const back = later.flatMap((id) => open.filter((card) => card.id === id));
    return [...open.filter((card) => !later.includes(card.id)), ...back];
  }, [cards, decided, later, inTrip, onlyFree, onlyKnown, query]);

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
      if (!top || leaving || picking || searching || filtering || details) return;
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
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-surface p-6 text-center shadow-card">
        <MapPin className="h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold">עוד אין יעדים לגלות בהם</h1>
        <p className="text-sm text-muted-strong">
          הוסיפו עיר לטיול, והגילוי יחלק כאן אטרקציות ממנה.
        </p>
        <Link
          href={`/trips/${tripId}/explore`}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          הוספת יעד
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col pt-1 select-none">
      <h1 className="sr-only">גילוי יעדים ואטרקציות</h1>

      {/* Destination pill, search, filter. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-w-0 items-center gap-1 rounded-full bg-surface px-4 py-1 text-start shadow-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-base" aria-hidden="true">
            {destination?.flag ?? "📍"}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-outline">
              יעד נוכחי
            </span>
            <span className="truncate text-base leading-none font-semibold text-foreground">
              מגלים את {destination?.label ?? "…"}
            </span>
          </span>
          <ChevronDown className="h-[18px] w-[18px] shrink-0 text-outline" aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <RoundButton label="חיפוש מהיר" onClick={() => setSearching(true)}>
            <Search className="h-5 w-5" aria-hidden="true" />
          </RoundButton>
          <RoundButton label="סינון מתקדם" onClick={() => setFiltering(true)}>
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            {filtered && (
              <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-cta-bright" />
            )}
          </RoundButton>
        </div>
      </div>

      {/* Category chips. */}
      <div
        className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="קטגוריות"
      >
        {DISCOVER_CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            aria-pressed={category === key}
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full px-4 py-1.5 text-xs leading-4 font-medium shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              category === key
                ? "bg-primary text-white"
                : "bg-surface text-muted-strong active:bg-surface-sunken",
            )}
          >
            <span>{DISCOVER_CATEGORIES[key].label}</span>
            <span aria-hidden="true">{DISCOVER_CATEGORIES[key].emoji}</span>
          </button>
        ))}
      </div>

      {/* The stack. */}
      <div className="relative mt-1 flex h-[470px] w-full items-center justify-center">
        {top && (
          <>
            <div className="pointer-events-none absolute h-[420px] w-[86%] translate-y-7 scale-90 rounded-3xl bg-surface-high opacity-40 shadow-sm" />
            <div className="pointer-events-none absolute flex h-[440px] w-[93%] translate-y-3.5 scale-95 flex-col justify-end overflow-hidden rounded-3xl bg-surface p-4 opacity-85 shadow-md">
              <div className="absolute inset-0 h-1/2 w-full bg-gradient-to-t from-inverse-surface/80 to-transparent" />
              {next && (
                <div className="relative z-10 flex flex-col gap-1">
                  <span className="inline-block self-start rounded-full bg-surface-variant/80 px-2 py-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-foreground">
                    {next.kindLabel}
                  </span>
                  <h3 className="text-lg leading-6 font-semibold text-white">
                    {next.name}
                    {next.localName && ` (${next.localName})`}
                  </h3>
                </div>
              )}
            </div>
          </>
        )}

        {state === "loading" ? (
          <DeckMessage>
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-tint border-t-primary" />
            <span>מחלקים את הקלפים…</span>
            <span className="text-xs text-muted">
              בפעם הראשונה בכל עיר זה לוקח עד חצי דקה
            </span>
          </DeckMessage>
        ) : state === "error" ? (
          <DeckMessage>
            <span>השרת של OpenStreetMap עמוס כרגע.</span>
            <Button variant="brand" size="sm" onClick={() => void load()}>
              נסו שוב
            </Button>
          </DeckMessage>
        ) : !top ? (
          <DeckMessage>
            <span className="text-3xl" aria-hidden="true">🎉</span>
            <span className="font-semibold text-foreground">
              {cards && cards.length > 0 ? "עברתם על כל הקלפים" : "לא נמצאו כאן מקומות"}
            </span>
            <span>
              {filtered
                ? "נסו לנקות את הסינון או את החיפוש."
                : "נסו קטגוריה אחרת או יעד אחר."}
            </span>
          </DeckMessage>
        ) : (
          <div
            key={top.id}
            className={cn(
              "absolute inset-0 flex h-full w-full touch-pan-y flex-col overflow-hidden rounded-3xl bg-surface shadow-xl",
              dragging ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{
              transform: `translate(${offset}px, ${Math.abs(offset) * 0.1}px) rotate(${offset * 0.06}deg)`,
              transition: dragging
                ? "none"
                : "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="relative h-full w-full bg-surface-high bg-cover bg-center"
              style={top.image ? { backgroundImage: `url("${top.image}")` } : undefined}
              role="img"
              aria-label={top.name}
            >
              <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-between">
                {top.languages >= MUST_SEE_LANGUAGES ? (
                  <span className="flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-primary shadow-sm backdrop-blur-md">
                    <BadgeCheck className="h-[15px] w-[15px] text-success-strong" aria-hidden="true" />
                    אתר חובה ברשימה
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setLater((current) => [...current.filter((id) => id !== top.id), top.id]);
                    showToast("נחזור אליו בסוף החפיסה");
                  }}
                  aria-label="לחזור אליו אחר כך"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-foreground shadow-sm backdrop-blur-md transition-transform active:scale-90"
                >
                  <Bookmark className="h-[19px] w-[19px]" aria-hidden="true" />
                </button>
              </div>

              <div
                className="pointer-events-none absolute top-14 right-6 z-30 rotate-12 rounded-xl bg-success/95 px-4 py-1 text-lg leading-6 font-bold text-white shadow-lg"
                style={{ opacity: likeOpacity }}
                aria-hidden="true"
              >
                שמור למסלול! ✨
              </div>
              <div
                className="pointer-events-none absolute top-14 left-6 z-30 -rotate-12 rounded-xl bg-cta-bright/95 px-4 py-1 text-lg leading-6 font-bold text-cta-deep shadow-lg"
                style={{ opacity: passOpacity }}
                aria-hidden="true"
              >
                דלג להבא ✕
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface via-inverse-surface/40 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 p-4 text-inverse-foreground">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-primary/80 px-2 py-0.5 text-[10px] leading-[14px] font-medium tracking-[0.02em] text-white backdrop-blur-sm">
                    {top.kindLabel}
                  </span>
                  {top.languages >= POPULAR_LANGUAGES && (
                    <span className="flex items-center gap-0.5 rounded-full bg-surface-variant/30 px-2 py-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-white backdrop-blur-sm">
                      <Flame className="h-[13px] w-[13px] text-cta-bright" aria-hidden="true" />
                      פופולרי במיוחד
                    </span>
                  )}
                </div>

                <h2 className="text-2xl leading-tight font-bold text-inverse-foreground">
                  {top.name}
                  {top.localName && (
                    <span className="block text-base leading-[22px] font-normal opacity-85">
                      {top.localName}
                    </span>
                  )}
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 pt-0.5 text-xs leading-[18px] text-surface-variant">
                  {/* The export's rating slot. Google's stars are only served
                      by the paid Places API, so the slot is the way to them:
                      the place's own page on Google Maps. See googleMapsUrl.
                      stopPropagation, or pressing it starts a drag. */}
                  <a
                    href={googleMapsUrl(top)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onPointerDown={(event) => event.stopPropagation()}
                    className="flex items-center gap-1 rounded-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Star className="h-4 w-4 fill-current text-cta-bright" aria-hidden="true" />
                    <span className="font-bold text-inverse-foreground">ביקורות בגוגל</span>
                  </a>
                  {feeLabel(top.fee) && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        <Banknote className="h-4 w-4 text-success-bright" aria-hidden="true" />
                        {feeLabel(top.fee)}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {visitLabel(top.visit)}
                  </span>
                </div>

                {top.summary && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-surface-variant">
                    {top.summary}
                  </p>
                )}

                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setDetails(top)}
                  className="mt-0.5 flex items-center justify-between rounded-xl bg-surface/15 px-4 py-1 text-inverse-foreground backdrop-blur-md transition-colors hover:bg-surface/25"
                >
                  <span className="flex items-center gap-1.5 text-xs leading-4 font-medium">
                    <Info className="h-4 w-4 text-primary-tint" aria-hidden="true" />
                    הקש למפה, שעות פעילות וטיפים
                  </span>
                  <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The four buttons. */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => void undo()}
          disabled={decided.length === 0}
          title="ביטול סווייפ אחרון"
          aria-label="ביטול סווייפ אחרון"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-outline shadow-md transition-transform active:scale-90 disabled:opacity-40"
        >
          <RotateCcw className="h-[22px] w-[22px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => top && void decide(top, false)}
          disabled={!top || Boolean(leaving)}
          title="דלג"
          aria-label="דלג"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger shadow-lg transition-all hover:bg-danger-tint/20 active:scale-90 disabled:opacity-40"
        >
          <X className="h-[30px] w-[30px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => top && void decide(top, true)}
          disabled={!top || Boolean(leaving)}
          title="שמור למסלול"
          aria-label="שמור למסלול"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-success-strong to-success text-white shadow-xl shadow-success-strong/20 transition-all active:scale-90 disabled:opacity-40"
        >
          <Heart className="h-[34px] w-[34px] fill-current" aria-hidden="true" />
        </button>
        {top ? (
          <Link
            href={`/trips/${tripId}/ai?q=${encodeURIComponent(`ספר לי על ${top.name} ב${top.city} — מתי הכי כדאי להגיע, כמה זמן לתכנן ואיזה טיפ שכדאי לדעת?`)}`}
            title="תובנת AI מיוחדת"
            aria-label="לשאול את עוזר ה-AI על המקום"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-md transition-transform active:scale-90"
          >
            <Sparkles className="h-[22px] w-[22px]" aria-hidden="true" />
          </Link>
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary opacity-40 shadow-md">
            <Sparkles className="h-[22px] w-[22px]" aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Saved so far. */}
      <div className="mt-4 flex w-full justify-center">
        <Link
          href={`/trips/${tripId}/explore`}
          className="inline-flex items-center gap-2 rounded-full bg-surface-sunken px-4 py-1 shadow-sm transition-colors hover:bg-surface-high"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] leading-[14px] font-bold text-white">
            {saved}
          </span>
          <span className="text-xs leading-4 font-medium text-foreground">
            {saved === 1 ? "מקום נשמר למסלול שלך" : "מקומות נשמרו למסלול שלך"}
          </span>
          <ArrowLeft className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
        </Link>
      </div>

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
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                  entry.key === destKey ? "bg-primary-tint" : "hover:bg-surface-2",
                )}
              >
                <span className="text-xl" aria-hidden="true">{entry.flag}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{entry.label}</span>
                  <span className="truncate text-xs text-muted-strong">
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

      <Dialog open={searching} onClose={() => setSearching(false)} title="חיפוש מהיר">
        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="שם של מקום, למשל פנתיאון"
          />
          <p className="text-xs text-muted-strong">
            מסנן את הקלפים שבחפיסה לפי השם.
          </p>
          <div className="flex justify-end gap-2">
            {query && (
              <Button variant="outline" onClick={() => setQuery("")}>
                ניקוי
              </Button>
            )}
            <Button variant="brand" onClick={() => setSearching(false)}>
              הצגה
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={filtering} onClose={() => setFiltering(false)} title="סינון מתקדם">
        <div className="flex flex-col gap-3">
          <Toggle checked={onlyFree} onChange={setOnlyFree} label="רק כניסה חופשית" hint="לפי תג הכניסה ב-OpenStreetMap" />
          <Toggle checked={onlyKnown} onChange={setOnlyKnown} label="רק אתרי חובה" hint={`מקומות שיש עליהם ערך בוויקיפדיה ב-${MUST_SEE_LANGUAGES} שפות ומעלה`} />
          <div className="flex justify-end gap-2">
            {(onlyFree || onlyKnown) && (
              <Button
                variant="outline"
                onClick={() => {
                  setOnlyFree(false);
                  setOnlyKnown(false);
                }}
              >
                ניקוי
              </Button>
            )}
            <Button variant="brand" onClick={() => setFiltering(false)}>
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
          <div className="flex flex-col gap-3">
            {details.image && (
              // eslint-disable-next-line @next/next/no-img-element -- a Commons redirect, not an optimisable asset
              <img
                src={details.image}
                alt=""
                className="h-44 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-strong">
              <span className="rounded-full bg-primary-tint px-2 py-0.5 font-semibold text-primary">
                {details.kindLabel}
              </span>
              {details.localName && <span dir="auto">{details.localName}</span>}
              <span>· {details.city}</span>
            </div>
            {details.summary && (
              <p className="text-sm leading-6 text-foreground">{details.summary}</p>
            )}
            <dl className="flex flex-col gap-1 text-sm">
              <Fact label="שעות פעילות">
                {details.openingHours ? (
                  <span dir="ltr">{details.openingHours}</span>
                ) : (
                  "לא ידוע — כדאי לבדוק לפני שיוצאים"
                )}
              </Fact>
              <Fact label="זמן ביקור">{visitLabel(details.visit)}</Fact>
              {feeLabel(details.fee) && <Fact label="כניסה">{feeLabel(details.fee)}</Fact>}
            </dl>
            <div className="flex flex-wrap gap-2">
              <a
                href={googleMapsUrl(details)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-surface-high px-3 py-1.5 text-xs font-medium text-primary"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                גוגל מפות — דירוג וביקורות
              </a>
              {details.wikiUrl && (
                <a
                  href={details.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-surface-high px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  בוויקיפדיה
                </a>
              )}
              {details.website && (
                <a
                  href={details.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-surface-high px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  אתר המקום
                </a>
              )}
            </div>
            <p className="text-[11px] text-muted">
              מידע ותמונה: OpenStreetMap, ויקיפדיה ו-Wikimedia Commons. הדירוג והביקורות — בגוגל מפות.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted-strong shadow-sm transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function DeckMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-surface p-6 text-center text-sm text-muted-strong shadow-xl">
      {children}
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
      />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-strong">{hint}</span>
      </span>
    </label>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-strong">{label}:</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  );
}
