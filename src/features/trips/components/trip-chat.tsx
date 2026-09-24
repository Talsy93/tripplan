"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Mic, Route, Sparkles, Trash2 } from "lucide-react";
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

// Stitch's quick prompts under the concierge's name. Each one sends, exactly
// as typing it would — the traveller pressing it is the request.
const OPENERS = [
  "אוכל מקומי מעולה",
  "מקומות סודיים בלי תורים",
  "התאמה ליום גשום",
  "עזור לי לחלק את הימים בין הערים",
];

function BotAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary shadow-sm"
    >
      <Bot className="h-[1.125rem] w-[1.125rem]" />
    </span>
  );
}

// The "עוזר AI" tab (v6), drawn as the Stitch design's chat screen: the
// concierge banner with quick prompts, the thread — a time pill, the
// traveller's bubbles in maritime on the start side, the assistant's on
// lavender beside a robot avatar — the plan card when one is built, and a
// floating pill composer with a microphone and a sparkle send button.
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

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <section
        aria-label="העוזר החכם"
        className="relative overflow-hidden rounded-card bg-gradient-to-l from-brand-2 via-primary to-primary-ink p-4 text-white shadow-sm"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/10 blur-xl"
        />
        <div className="relative z-10 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-md"
          >
            <Sparkles className="h-6 w-6" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1">
              <h1 className="text-lg leading-6 font-semibold tracking-tight">
                MyTrip AI Concierge
              </h1>
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-success-bright shadow-[0_0_8px_var(--success-bright)]"
              />
            </span>
            <p className="text-xs text-primary-tint opacity-95">
              {where ? `החבר המקומי שלך ב${where}` : "המתכנן האישי של הטיול"} •
              זמין 24/7
            </p>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => void reset()}
              aria-label="ניקוי שיחה"
              title="ניקוי שיחה"
              className="ms-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="relative z-10 mt-4 flex items-center gap-1 overflow-x-auto pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {OPENERS.map((opener) => (
            <button
              key={opener}
              type="button"
              disabled={sending}
              onClick={() => void send(opener)}
              className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95 disabled:opacity-60"
            >
              {opener}
            </button>
          ))}
        </div>
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
      <SegmentedControl
        aria-label="תצוגת העוזר"
        value={view}
        onChange={(next: string) => setView(next === "plan" ? "plan" : "chat")}
        items={[
          { id: "chat", label: "שיחה חופשית" },
          {
            id: "plan",
            label: "מסלול מוצע",
            // The count is the point of the tab: it says there is something to
            // look at without opening it.
            count: plan ? planTotals(plan).items : undefined,
          },
        ]}
      />

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
            <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
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
          "flex-1 flex-col gap-6",
          view === "chat" ? "flex" : "hidden",
        )}
        aria-live="polite"
      >
        {turns.length > 0 && (
          <div className="flex justify-center">
            <span className="rounded-full bg-surface-high px-2 py-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-muted">
              {firstAt ? `היום, ${firstAt}` : "היום"}
              {where && ` • תכנון הטיול ב${where}`}
            </span>
          </div>
        )}

        {turns.length === 0 && (
          <div className="flex items-start gap-2">
            <BotAvatar />
            <div className="rounded-2xl rounded-se-[0.25rem] bg-surface-2 p-4 text-sm leading-relaxed text-foreground shadow-sm">
              ספרו מה אתם מחפשים, ונחדד יחד את המסלול. אני מכיר את היעדים
              והפריטים שכבר בחרתם.
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div
              key={turn.id}
              className="flex max-w-[88%] flex-col items-start self-start"
            >
              <div className="whitespace-pre-wrap rounded-2xl rounded-es-[0.25rem] bg-primary p-4 text-sm leading-relaxed text-primary-foreground shadow-md">
                {turn.content}
              </div>
              {clock(turn.at) && (
                <span
                  className="me-1 mt-0.5 text-[0.625rem] leading-[0.875rem] font-semibold text-outline"
                  suppressHydrationWarning
                >
                  {clock(turn.at)} • נמסר
                </span>
              )}
            </div>
          ) : (
            <div key={turn.id} className="flex w-full items-start gap-2 self-end">
              <BotAvatar />
              <div className="min-w-0 flex-1 whitespace-pre-wrap rounded-2xl rounded-se-[0.25rem] bg-surface-2 p-4 text-sm leading-relaxed text-foreground shadow-sm">
                {turn.content}
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-center gap-2">
            <BotAvatar />
            <span
              className="flex gap-1 rounded-2xl bg-surface-2 px-4 py-3"
              role="status"
              aria-label="העוזר כותב"
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-2 w-2 animate-pulse rounded-full bg-outline"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {error && view === "chat" && <Banner tone="danger">{error}</Banner>}

        {/* Turning the conversation into a plan asks the model again, so it is
            its own press — the tuning row Stitch draws under a plan card. */}
        {turns.length > 0 && !plan && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void buildPlan()}
              disabled={planning || sending}
              className="flex flex-1 items-center justify-center gap-0.5 rounded-lg bg-surface-high px-1 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-sunken disabled:opacity-60"
            >
              <Route className="h-[0.9375rem] w-[0.9375rem]" aria-hidden="true" />
              {planning ? "בונה מסלול…" : "בנה לי מסלול מהשיחה"}
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Sticky, and above the tab bar on a phone. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 bg-background/90 px-4 pb-2 pt-1 backdrop-blur-md md:-mx-6 md:px-6 lg:bottom-0"
      >
        <div className="flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-[0_4px_20px_rgba(0,97,148,0.12)]">
          {canListen && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "הפסקת הקלטה" : "הקלטה קולית"}
              aria-pressed={listening}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                listening
                  ? "bg-cta-bright text-white"
                  : "bg-surface-2 text-muted hover:bg-surface-sunken",
              )}
            >
              <Mic className="h-[1.375rem] w-[1.375rem]" aria-hidden="true" />
            </button>
          )}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="שאל את העוזר כל דבר על הטיול..."
            maxLength={2000}
            aria-label="הודעה לעוזר"
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:font-normal placeholder:text-placeholder focus:outline-none pointer-coarse:text-base"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="שלח שאלה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:bg-brand-2 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
