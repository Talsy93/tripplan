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

// The export's four openers, word for word. They are written as whole briefs
// rather than as one-word tags because that is what the field wants: pressing
// one has to leave something you could send as it stands.
const VIBES = [
  "קולינרי ואיטי 🍷",
  "אתרי חובה בקצב מהיר ⚡",
  "פינות נסתרות 🌿",
  "טיול צילום 📸",
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
      {/* "עוזר הגילוי החכם" — the _4 export's smart-discovery panel.
          A gradient card with a blurred glimmer behind it, an eyebrow in small
          caps, the question, the sentence, four vibe chips that fill the field,
          the field, and a full-width call at the foot. The chips are the part
          that matters: the hardest thing about a free-text prompt is the empty
          box, and four openers turn it into a choice. Pressing one writes it
          into the field rather than sending it, so it is a starting point that
          can still be edited — which is what the export's own script does. */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-surface-high via-surface-sunken to-primary-tint/40 p-4 shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-primary-tint opacity-60 blur-2xl"
        />
        <div className="relative z-10 flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface shadow-card">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <span className="text-caption font-bold uppercase tracking-wider text-primary">
              עוזר הגילוי החכם
            </span>
          </div>

          <h3 className="text-lg font-semibold leading-6">
            לא בטוחים מאיפה להתחיל?
          </h3>
          <p className="min-w-0 max-w-measure text-sm text-muted">
            תארו בקצרה מה אתם אוהבים ואיזה קצב מתאים לכם, וקבלו הצעות מותאמות
            אישית לנקודות פתיחה.
          </p>

          <div className="flex flex-wrap gap-2">
            {VIBES.map((vibe) => (
              <button
                key={vibe}
                type="button"
                onClick={() => setPrompt(vibe)}
                className={cn(
                  "rounded-full px-3 py-1 text-caption font-medium shadow-card transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  prompt === vibe
                    ? "bg-primary text-white"
                    : "bg-surface text-foreground hover:bg-primary-tint",
                )}
              >
                {vibe}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="למשל: סמטאות ציוריות עם גלידה טובה…"
              aria-label="מה בא לכם לעשות בטיול?"
              className="w-full rounded-card bg-surface/90 px-4 py-2.5 text-sm text-foreground shadow-card outline-none backdrop-blur placeholder:text-outline"
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={prompt.trim().length < 3}
              className="w-full"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {cities.length > 0
                ? "הצעות חדשות"
                : `הציעו לי מקומות מנצחים${city ? ` ב${city}` : ""} ✨`}
            </Button>
          </form>
        </div>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      {cities.length > 0 && (
        <>
          {/* One press opens the whole list, and inside it the cards are the
              cards again.

              This went too far the first time. Each city became a row that had
              to be opened on its own, which is five presses to compare five
              suggestions — and comparing them is the entire job of this list.
              Corrected on report: "bring the destination search results back to
              the display they had, and unify it the way you did for browsing by
              category, where one press opens the list."

              Which is the right shape: the heaviness was never the card, it was
              that five of them arrive unasked above everything else on the tab.
              One row that says how many, and the cards behind it. */}
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

          {/* Adds to the list rather than replacing it — the same affordance
              the city guide has had for its categories since stage 8. The
              button above, "הצעות חדשות", is the one that starts over. */}
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
        </>
      )}
    </div>
  );
}
