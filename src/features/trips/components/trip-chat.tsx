"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, RotateCcw, Route, Send, Sparkles, Wand2 } from "lucide-react";
import { Banner, Button, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/cn";
import { applyPlan, resetChat } from "../application/chat-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { PlanPreview } from "./plan-preview";
import type { TripChatMessage } from "../domain/chat";
import { planTotals } from "../domain/trip-plan";
import type { AiTripPlan, RefinePlanRequest } from "../domain/trip-plan";

type Turn = {
  id: string;
  role: "user" | "model";
  content: string;
  // When it was said, for the time under the bubble.
  at?: string;
};

function clock(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// The browser's own speech recognition — free, on the device. Some browsers
// have none, and then the microphone is not drawn.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Quick prompts, in the chip row over the composer. Each one sends, exactly
// as typing it would — the traveller pressing it is the request.
const OPENERS = [
  "אוכל מקומי מעולה",
  "מקומות סודיים בלי תורים",
  "התאמה ליום גשום",
  "עזור לי לחלק את הימים בין הערים",
];

// The "עוזר AI" tab, drawn to the Pencil export (ai-mobile): a head row with
// a teal badge and a clear button, a full-width switch between the
// conversation and the plan, the traveller's teal bubbles on the left and the
// assistant's white ones on the right, and a composer with the quick prompts
// and the plan press in a chip row over a pill input with a microphone and a
// round send button.
export function TripChat({
  tripId,
  initialMessages,
  cities = [],
  initialDraft = "",
}: {
  tripId: string;
  initialMessages: TripChatMessage[];
  // The trip's cities, for the line under the concierge's name.
  cities?: string[];
  // A question typed in for the traveller and left unsent — the ✨ on a
  // "גילוי" card lands here with one about that place. Unsent on purpose:
  // every send is a model call, and the traveller decides when to spend one.
  initialDraft?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      at: message.created_at,
    })),
  );
  const [draft, setDraft] = useState(initialDraft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiTripPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  // Which half of the screen is showing. "chat" is the conversation; "plan" is
  // what the conversation would add to the trip.
  const [view, setView] = useState<"chat" | "plan">("chat");
  const switchSentinel = useRef<HTMLDivElement>(null);
  const [switchStuck, setSwitchStuck] = useState(false);

  // Stuck = the spot the switcher sits in has scrolled up behind the header
  // (4.5rem: the 4rem bar and the gap the switcher floats at).
  useEffect(() => {
    const el = switchSentinel.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setSwitchStuck(el.getBoundingClientRect().top < 72);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  // Which tuning request is in flight, by its own text, so the chip that was
  // pressed is the one that says so.
  const [tweaking, setTweaking] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const [canListen, setCanListen] = useState(false);

  // Known only in the browser, so decided after mount — the server render
  // and the first client render must agree, and both say "no microphone".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanListen(recognitionCtor() !== null);
  }, []);

  // Keep the newest turn in view — a chat that leaves you scrolled to the top
  // after a reply makes you hunt for the answer you just asked for.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, sending, plan]);

  function toggleListening() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const next = new Ctor();
    next.lang = "he-IL";
    next.interimResults = false;
    next.onresult = (event) => {
      const heard = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (heard) setDraft((current) => (current ? `${current} ${heard}` : heard));
    };
    next.onend = () => setListening(false);
    recognition.current = next;
    setListening(true);
    next.start();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    setDraft("");
    // Show the question immediately; the id is local until the page reloads
    // and picks up the saved rows.
    const pendingId = `pending-${turns.length}`;
    setTurns((current) => [
      ...current,
      { id: pendingId, role: "user", content: message, at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, message }),
      });

      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "השליחה נכשלה. נסו שוב."));
        // The optimistic bubble was never saved, so leaving it would show a
        // message that looks sent and vanishes on reload. Removing it and
        // giving the text back makes a failure a retry rather than a retype.
        setTurns((current) => current.filter((turn) => turn.id !== pendingId));
        setDraft(message);
        return;
      }

      const data: { reply: string } = await res.json();
      setTurns((current) => [
        ...current,
        {
          id: `${pendingId}-reply`,
          role: "model",
          content: data.reply,
          at: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
      setTurns((current) => current.filter((turn) => turn.id !== pendingId));
      setDraft(message);
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    if (!(await resetChat(tripId))) return;
    setTurns([]);
    setError(null);
    setPlan(null);
  }

  async function buildPlan() {
    setPlanning(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/ai/plan-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (res.status === 400) {
        setError("צריך קודם לנהל שיחה שממנה אפשר לבנות מסלול.");
        return;
      }
      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "בניית המסלול נכשלה. נסו שוב."));
        return;
      }
      setPlan((await res.json()) as AiTripPlan);
      // The answer lives on the other tab, so go there rather than leaving a
      // built plan behind a switch nobody pressed.
      setView("plan");
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setPlanning(false);
    }
  }

  // The same plan, changed. Replaces what is on screen rather than adding a
  // second card: there is one proposal, and the point of a tweak is that it is
  // now the proposal.
  async function tweakPlan(instruction: string) {
    if (!plan) return;
    setTweaking(instruction);
    setError(null);
    try {
      // Typed as the route's own request type rather than built loose and
      // stringified. `fetch` does not check a body, so a field renamed on the
      // schema would otherwise fail at runtime as a 400 with nothing pointing
      // at the cause; this way it fails in the type-check, in this file.
      const body: RefinePlanRequest = { tripId, plan, instruction };
      const res = await fetch("/api/ai/refine-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(
          await aiErrorFromResponse(res, "העדכון נכשל. נסו שוב."),
        );
        return;
      }
      setPlan((await res.json()) as AiTripPlan);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setTweaking(null);
    }
  }

  async function confirmPlan() {
    if (!plan) return;
    setApplying(true);
    const ok = await applyPlan(tripId, plan);
    setApplying(false);

    if (!ok) {
      setError("ההוספה נכשלה. נסו שוב.");
      return;
    }
    setPlan(null);
    setApplied(true);
  }


  const where = cities.slice(0, 2).join(" ו");
  const firstAt = clock(turns[0]?.at);
  // Stitch put the plan-from-chat press under the thread; Pencil moves it
  // into the composer's chip row, beside the quick prompts, so it sits where
  // the thumb already is. Same press, same rule: only once there is a
  // conversation to build from and no plan already on the table.
  const canBuild = turns.length > 0 && !plan;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      {/* Pencil's head row: a solid teal badge, who this is, and a quiet
          round button to start over. The gradient banner it replaces was a
          second lit surface on a screen whose job is the conversation. */}
      <section aria-label="העוזר החכם" className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-soft"
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-lg leading-6 font-semibold text-foreground">
            {where ? `החבר המקומי שלך ב${where}` : "המתכנן האישי של הטיול"}
          </h1>
          <p className="truncate text-xs text-muted">
            שואלים, מקבלים הצעות, בונים מסלול
          </p>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => void reset()}
            aria-label="ניקוי שיחה"
            title="ניקוי שיחה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </button>
        )}
      </section>

      {/* Two halves of one assistant.
          Reported as "why does the AI tab's output not look like the design —
          is it just a chat for us?", and it was: the design's answer is a day
          plan card with stops and a call to add it, while ours was a thread
          with that card reachable only from a small button below the last
          message. The card existed (PlanPreview draws exactly what the export
          draws); it was filed where nobody would find it.

          A switcher rather than one long scroll, because these answer different
          questions: "talk it through" and "what would this add to my trip". The
          count on the second tab is the point of it — it says there is
          something to look at without opening it. */}
      {/* Floats under the header once the page scrolls past it — a long
          conversation otherwise leaves the way to the plan a scroll back up
          (asked for 2026-09-24). The sentinel is what tells it has stuck: a
          sticky element cannot see that for itself. */}
      <div ref={switchSentinel} aria-hidden="true" className="-mb-4 h-0" />
      <div
        className={cn(
          "sticky top-[calc(4.5rem+env(safe-area-inset-top))] z-20 flex",
          switchStuck ? "justify-center" : "justify-start",
        )}
      >
        <SegmentedControl
          aria-label="תצוגת העוזר"
          value={view}
          onChange={(next: string) => setView(next === "plan" ? "plan" : "chat")}
          className={cn(
            // Pencil draws this one full width with the selected half as a
            // white pill on the grey track, not the ink fill the shared
            // control uses for filters. Restyled from here through child
            // selectors, because the control has no variant for it yet.
            "w-full self-stretch bg-surface-sunken transition-shadow duration-settle",
            "[&>button]:min-h-10 [&>button]:flex-1",
            "[&>button[aria-pressed=true]]:bg-surface [&>button[aria-pressed=true]]:text-foreground [&>button[aria-pressed=true]]:shadow-card",
            switchStuck && "shadow-lift",
          )}
          items={[
            { id: "chat", label: "שיחה חופשית" },
            {
              id: "plan",
              label: "מסלול מוצע",
              // The count is the point of the tab: it says there is something
              // to look at without opening it.
              count: plan ? planTotals(plan).items : undefined,
            },
          ]}
        />
      </div>

      {/* What actually happened, and what is left.
          This said "the destinations and items now appear in the route and on
          the map", and half of that was untrue: applying a plan writes the
          trip's destinations, which the planning tab and the map read — the
          schedule is built rows, and it does not change until it is rebuilt.
          Reported as "I added from the AI's suggestion and nothing was updated
          in the route", which is precisely what the sentence promised would
          not happen. Now it says where they went and offers the press that
          finishes the job. */}
      {applied && (
        <Banner tone="success">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0">
              נוסף לטיול — היעדים והפריטים מופיעים ב״תכנון״ ועל המפה. כדי שייכנסו
              גם ללו״ז, בנו אותו מחדש.
            </span>
            <Link
              href={`/trips/${tripId}/days`}
              className="shrink-0 font-semibold text-primary-ink underline"
            >
              למסלול
            </Link>
          </span>
        </Banner>
      )}

      {view === "plan" && (
        <div className="flex flex-1 flex-col gap-4">
          {/* A failed tweak says so beside the card it failed to change. The
              chat's own banner is on the other half and would be unread here. */}
          {plan && error && <Banner tone="danger">{error}</Banner>}
          {plan ? (
            <PlanPreview
              plan={plan}
              applying={applying}
              onApply={() => void confirmPlan()}
              onDismiss={() => setPlan(null)}
              onTweak={(instruction) => void tweakPlan(instruction)}
              tweaking={tweaking}
            />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-[20px] bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-tint text-primary"
                >
                  <Route className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold leading-6">
                  מסלול מהשיחה
                </h2>
              </div>
              <p className="max-w-measure text-sm text-muted">
                {turns.length === 0
                  ? "ספרו לעוזר מה בא לכם, ואז אפשר להפוך את השיחה למסלול מוצע — יעדים ופריטים שאפשר להוסיף לטיול בלחיצה."
                  : "אפשר להפוך את השיחה למסלול מוצע. שום דבר לא נכנס לטיול עד שתאשרו."}
              </p>
              <Button
                type="button"
                onClick={() => void buildPlan()}
                loading={planning}
                disabled={turns.length === 0 || sending}
                className="rounded-full"
              >
                <Route className="h-4 w-4" aria-hidden="true" />
                בנו מסלול מהשיחה
              </Button>
              {error && <Banner tone="danger">{error}</Banner>}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "flex-1 flex-col gap-3",
          view === "chat" ? "flex" : "hidden",
        )}
        aria-live="polite"
      >
        {turns.length > 0 && (
          <div className="flex justify-center">
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[0.6875rem] leading-4 font-medium text-muted">
              {firstAt ? `היום, ${firstAt}` : "היום"}
              {where && ` · תכנון הטיול ב${where}`}
            </span>
          </div>
        )}

        {turns.length === 0 && (
          <div className="max-w-[88%] self-start rounded-[18px] rounded-es-md bg-surface px-4 py-3 text-sm leading-relaxed text-foreground shadow-card">
            ספרו מה אתם מחפשים, ונחדד יחד את המסלול. אני מכיר את היעדים
            והפריטים שכבר בחרתם.
          </div>
        )}

        {/* Pencil's sides: the traveller on the left in teal, the assistant
            on the right in white — in RTL that is end and start. The cut
            corner points at the edge each one speaks from. */}
        {turns.map((turn) =>
          turn.role === "user" ? (
            <div
              key={turn.id}
              className="flex max-w-[85%] flex-col items-end self-end"
            >
              <div className="whitespace-pre-wrap rounded-[18px] rounded-ee-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                {turn.content}
              </div>
              {clock(turn.at) && (
                <span
                  className="mx-1 mt-1 text-[0.6875rem] leading-4 text-outline"
                  suppressHydrationWarning
                >
                  {clock(turn.at)} · נמסר
                </span>
              )}
            </div>
          ) : (
            <div
              key={turn.id}
              className="max-w-[92%] self-start whitespace-pre-wrap rounded-[18px] rounded-es-md bg-surface px-4 py-3 text-sm leading-relaxed text-foreground shadow-card"
            >
              {turn.content}
            </div>
          ),
        )}

        {sending && (
          <span
            className="flex gap-1 self-start rounded-full bg-surface px-3.5 py-2.5 shadow-card"
            role="status"
            aria-label="העוזר כותב"
          >
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-outline"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </span>
        )}

        {error && view === "chat" && <Banner tone="danger">{error}</Banner>}
        <div ref={endRef} />
      </div>

      {/* Sticky, and above the tab bar on a phone. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-2 bg-background/90 px-4 pb-2 pt-2 backdrop-blur-md md:-mx-6 md:px-6 lg:bottom-0"
      >
        {/* The plan press in teal tint — the one chip that does something
            other than ask — then the quick prompts. Pencil draws the plan chip
            last, but its prompts are two words each; ours are sentences, and
            at the end of the row the chip scrolled out of sight on a phone. So
            it leads. Turning the conversation into a plan asks the model
            again, so it is its own press. Each prompt sends, exactly as typing
            it would: the traveller pressing it is the request. */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {canBuild && (
            <button
              type="button"
              onClick={() => void buildPlan()}
              disabled={planning || sending}
              className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-tint px-3.5 text-xs font-semibold text-primary-ink transition-colors hover:bg-primary-soft active:scale-95 disabled:opacity-60"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              {planning ? "בונה מסלול…" : "בנה מסלול"}
            </button>
          )}
          {OPENERS.map((opener) => (
            <button
              key={opener}
              type="button"
              disabled={sending}
              onClick={() => void send(opener)}
              className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-foreground transition-colors hover:border-border-strong active:scale-95 disabled:opacity-60"
            >
              {opener}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-surface py-1.5 pe-1.5 ps-4 shadow-soft focus-within:border-border-strong">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={where ? `שאלו כל דבר על ${where}...` : "שאלו את העוזר כל דבר על הטיול..."}
            maxLength={2000}
            aria-label="הודעה לעוזר"
            className="min-w-0 flex-1 bg-transparent py-1 text-sm text-foreground placeholder:font-normal placeholder:text-placeholder focus:outline-none pointer-coarse:text-base"
          />
          {canListen && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "הפסקת הקלטה" : "הקלטה קולית"}
              aria-pressed={listening}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                listening
                  ? "bg-cta text-cta-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Mic className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="שלח שאלה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-50"
          >
            {/* Mirrored: lucide's plane points right, and in RTL "send"
                travels to the left. */}
            <Send className="h-[1.125rem] w-[1.125rem] -scale-x-100" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
