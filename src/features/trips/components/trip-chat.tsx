"use client";

import { useEffect, useRef, useState } from "react";
import {
  Banner,
  Button,
  Card,
  Chip,
  SectionHeading,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { applyPlan, resetChat } from "../application/chat-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
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

      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "השליחה נכשלה. נסו שוב."));
        // The optimistic bubble above was never saved — nothing ever reached
        // appendChatMessages — so leaving it in `turns` would show a message
        // that looks sent forever and vanishes the moment the page reloads.
        // Removing it and giving the text back to the input is what makes a
        // busy/quota/network failure a retry rather than a retype.
        setTurns((current) => current.filter((turn) => turn.id !== pendingId));
        setDraft(message);
        return;
      }

      const data: { reply: string } = await res.json();
      setTurns((current) => [
        ...current,
        { id: `${pendingId}-reply`, role: "model", content: data.reply },
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
      <SectionHeading
        level="page"
        actions={
          turns.length > 0 && (
            <>
              <Button
                type="button"
                onClick={() => void buildPlan()}
                loading={planning}
                disabled={sending}
                size="sm"
              >
                בניית מסלול מהשיחה
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void reset()}
              >
                ניקוי שיחה
              </Button>
            </>
          )
        }
      >
        שיחה עם מתכנן הטיולים
      </SectionHeading>

      {applied && (
        <Banner tone="success">
          נוסף לטיול — היעדים והפריטים מופיעים עכשיו בטאב התכנון ובמפת המסלול.
        </Banner>
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
              <Chip key={opener} onClick={() => void send(opener)}>
                {opener}
              </Chip>
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
                padding="sm"
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap text-sm lg:max-w-[70%]",
                  turn.role === "user"
                    ? "border-primary bg-primary text-primary-foreground"
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
      {error && <Banner tone="danger">{error}</Banner>}
      <div ref={endRef} />

      {/* Sticky, and it was not before: the composer sat in normal flow at the
          bottom of a growing list, so on a phone you had to scroll past the
          whole conversation to reach the box you wanted to type in. The offset
          clears the fixed bottom nav; from md there is no bar to clear. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 rounded-card border border-border bg-surface/95 p-2 shadow-card backdrop-blur md:bottom-4"
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
        <Button type="submit" loading={sending} disabled={!draft.trim()}>
          שליחה
        </Button>
      </form>
    </div>
  );
}
