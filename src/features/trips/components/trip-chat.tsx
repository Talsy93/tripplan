"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { applyPlan, resetChat } from "../application/chat-actions";
import { PlanPreview } from "./plan-preview";
import type { TripChatMessage } from "../domain/chat";
import type { AiTripPlan } from "../domain/trip-plan";

type Turn = { id: string; role: "user" | "model"; content: string };

const OPENERS = [
  "אני רוצה 10 ימים, תקציב בינוני",
  "מה כדאי לראות שאינו תיירותי מדי?",
  "עזור לי לחלק את הימים בין הערים",
];

export function TripChat({
  tripId,
  initialMessages,
}: {
  tripId: string;
  initialMessages: TripChatMessage[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiTripPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view — a chat that leaves you scrolled to the top
  // after a reply makes you hunt for the answer you just asked for.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, sending]);

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
      { id: pendingId, role: "user", content: message },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, message }),
      });

      if (res.status === 429) {
        setError("יותר מדי הודעות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError("השליחה נכשלה. נסו שוב.");
        return;
      }

      const data: { reply: string } = await res.json();
      setTurns((current) => [
        ...current,
        { id: `${pendingId}-reply`, role: "model", content: data.reply },
      ]);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
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
      if (res.status === 429) {
        setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError("בניית המסלול נכשלה. נסו שוב.");
        return;
      }
      setPlan((await res.json()) as AiTripPlan);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setPlanning(false);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">שיחה עם מתכנן הטיולים</h2>
        {turns.length > 0 && (
          <>
            <Button
              type="button"
              onClick={() => void buildPlan()}
              disabled={planning || sending}
              size="sm"
              className="ms-auto"
            >
              {planning ? "בונה…" : "בנה מסלול מהשיחה"}
            </Button>
            <button
              type="button"
              onClick={() => void reset()}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              נקה שיחה
            </button>
          </>
        )}
      </div>

      {applied && (
        <p className="text-sm text-muted">
          נוסף לטיול ✓ — היעדים והפריטים מופיעים עכשיו בטאב התכנון ובמפת המסלול.
        </p>
      )}

      {plan && (
        <PlanPreview
          plan={plan}
          applying={applying}
          onApply={() => void confirmPlan()}
          onDismiss={() => setPlan(null)}
        />
      )}

      {turns.length === 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            ספרו מה אתם מחפשים, ונחדד יחד את המסלול. השיחה מכירה את היעדים
            והפריטים שכבר בחרתם.
          </p>
          <div className="flex flex-wrap gap-2">
            {OPENERS.map((opener) => (
              <button
                key={opener}
                type="button"
                onClick={() => void send(opener)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-primary"
              >
                {opener}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <ul className="flex flex-col gap-3">
          {turns.map((turn) => (
            <li
              key={turn.id}
              className={cn(
                "flex",
                turn.role === "user" ? "justify-start" : "justify-end",
              )}
            >
              <Card
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap p-3 text-sm",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface",
                )}
              >
                {turn.content}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {sending && <p className="text-sm text-muted">חושב…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div ref={endRef} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // chat uses, and the reason a textarea is usable here at all.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          placeholder="מה תרצו לשאול?"
          rows={2}
          maxLength={2000}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          שלח
        </Button>
      </form>
    </div>
  );
}
