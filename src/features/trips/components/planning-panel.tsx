"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Disclosure,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addMoreCities, saveCities } from "../application/guide-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import {
  mergeCitySuggestions,
  moreCitiesPrompt,
} from "../domain/ai-suggestion";
import type { AiCitySuggestion } from "../domain/ai-suggestion";

type PlanningPanelProps = {
  tripId: string;
  initialCities: AiCitySuggestion[];
  // The destination the call names — "הציעו לי מקומות מנצחים ברומא". Omitted
  // before there is one, and then the button says it without a place.
  city?: string | null;
};

// How many extra cities one "more destinations" round asks for. The request
// schema allows up to 10; asking for a handful at a time keeps each round fast
// and the list readable.
const MORE_COUNT = 5;

// The openers. Written as whole briefs rather than one-word tags because that
// is what the field wants: pressing one has to leave something you could send
// as it stands. No emoji — Pencil draws these as plain text chips, and the
// app's marks are lucide glyphs only (CLAUDE.md, 2026-08-31).
const VIBES = [
  "קולינרי ואיטי",
  "אתרי חובה בקצב מהיר",
  "פינות נסתרות",
  "טיול צילום",
] as const;

export function PlanningPanel({
  tripId,
  initialCities,
  city = null,
}: PlanningPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cities, setCities] = useState<AiCitySuggestion[]>(initialCities);
  // The prompt that produced the list on screen. "More" has to reuse it — the
  // textarea may have been edited or cleared since, and asking the AI for more
  // cities under a different brief would return an unrelated set.
  const [activePrompt, setActivePrompt] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count: 5 }),
      });

      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "קבלת ההצעות נכשלה. נסו שוב."));
        return;
      }

      const data = await res.json();
      // Deduped even on a fresh round: one response can name the same city
      // twice, and there is no unique index on these rows to catch it.
      const newCities = mergeCitySuggestions([], data.cities ?? []);
      setCities(newCities);
      setActivePrompt(prompt.trim());
      await saveCities(tripId, newCities);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  // Prefers the brief that produced the current list, then whatever is typed,
  // then one derived from the cities themselves — so a list restored from the
  // database still offers "more" without making the user restate the request.
  const morePrompt = moreCitiesPrompt(activePrompt || prompt, cities);
  const canAskForMore = cities.length > 0 && morePrompt !== null;

  // A second round under the same brief, excluding what is already listed.
  async function handleMore() {
    if (!morePrompt) return;
    setLoadingMore(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: morePrompt,
          count: MORE_COUNT,
          exclude: cities.map((city) => city.name),
        }),
      });

      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "קבלת ההצעות נכשלה. נסו שוב."));
        return;
      }

      const data = await res.json();
      const incoming: AiCitySuggestion[] = data.cities ?? [];
      const merged = mergeCitySuggestions(cities, incoming);

      // The AI was asked to exclude what is on screen, but a prompt is a
      // request — it can return the same places anyway. Saying so is better
      // than a button that looks broken.
      if (merged.length === cities.length) {
        setNotice("לא נמצאו יעדים חדשים. נסו לנסח את הבקשה אחרת.");
        return;
      }

      setCities(merged);
      await addMoreCities(tripId, merged.slice(cities.length));
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pencil's AI box: the teal tint rather than the gradient — the screen
          has one lit element at most, and a tint says "the assistant is
          offering something" without competing with the orange call in the
          sticky bar. A sparkle and the question, the sentence, the opener chips
          white on the tint, then the field and its button.

          The chips are the part that matters: the hardest thing about a
          free-text prompt is the empty box, and openers turn it into a choice.
          Pressing one writes it into the field rather than sending it, so it is
          a starting point that can still be edited. */}
      <div className="flex min-w-0 flex-col gap-3 rounded-[20px] bg-primary-tint p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="min-w-0 text-base font-bold leading-6 text-primary-ink wrap-anywhere">
            לא בטוחים מה מחפשים?
          </h3>
        </div>
        <p className="-mt-1 min-w-0 max-w-measure text-sm text-primary-ink/80">
          בחרו סגנון והעוזר יציע מקומות שמתאימים לכם
        </p>

        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => (
            <button
              key={vibe}
              type="button"
              onClick={() => setPrompt(vibe)}
              aria-pressed={prompt === vibe}
              className={cn(
                "h-9 rounded-full px-3.5 text-caption font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                prompt === vibe
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-primary-ink hover:bg-surface/80",
              )}
            >
              {vibe}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="או כתבו בעצמכם: סמטאות ציוריות עם גלידה טובה…"
            aria-label="מה בא לכם לעשות בטיול?"
            className="h-11 w-full rounded-full bg-surface px-4 text-sm text-foreground outline-none placeholder:font-normal placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
          />
          {/* Teal, not the terracotta call: that colour belongs to the one
              action the screen is for, which is the sticky bar's "שיבוץ לימים". */}
          <Button
            type="submit"
            variant="brand"
            loading={loading}
            disabled={prompt.trim().length < 3}
            className="w-full rounded-full"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {cities.length > 0
              ? "הצעות חדשות"
              : `הציעו לי מקומות${city ? ` ב${city}` : ""}`}
          </Button>
        </form>

            {error && <Banner tone="danger">{error}</Banner>}
            {notice && <Banner tone="info">{notice}</Banner>}

            {/* The answer, inside the box that asked the question.
                It used to sit below the panel as a separate card, which made the
                screen read as two unrelated things — a form, and then a list that
                happened to follow it. A question and its answer in one box is
                also what makes "הצעות חדשות" legible: the button that replaces
                the list is directly above the list it replaces.

                Still one press to open. The cards are the cards — each city is a
                card you can compare against its neighbours, which is the whole
                job of this list — but five of them arriving unasked is what the
                fold is for. */}
            {cities.length > 0 && (
              <div className="flex min-w-0 flex-col gap-3 border-t border-primary/15 pt-3">
                <Disclosure
                  tone="suggest"
                  leading={<Sparkles className="h-4 w-4" />}
                  title="היעדים שהוצעו"
                  detail="לחצו לפתיחה — כל אחד מוביל למדריך שלו"
                  meta={<Badge tone="neutral">{cities.length}</Badge>}
                >
              <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
                {cities.map((city, index) => (
                  <li key={`${city.name}-${index}`}>
                    <Link
                      href={`/trips/${tripId}/city/${encodeURIComponent(city.name)}`}
                      className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card
                        variant="interactive"
                        className="flex h-full flex-col gap-1"
                      >
                        <span className="flex items-center gap-1 text-base font-semibold text-primary-ink">
                          {city.name}
                          {/* RTL: "forward" points left. */}
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-sm text-muted">
                          {city.description}
                        </span>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
                </Disclosure>

                {/* Adds to the list rather than replacing it — the same
                    affordance the city guide has had for its categories since
                    stage 8. The call above, "הצעות חדשות", is the one that starts
                    over. */}
                {canAskForMore && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleMore()}
                    loading={loadingMore}
                    className="self-start"
                  >
                    הצגת עוד יעדים
                  </Button>
                )}
              </div>
            )}
      </div>
    </div>
  );
}
