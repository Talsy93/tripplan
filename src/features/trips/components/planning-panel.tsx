"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Textarea } from "@/components/ui";
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
};

// How many extra cities one "more destinations" round asks for. The request
// schema allows up to 10; asking for a handful at a time keeps each round fast
// and the list readable.
const MORE_COUNT = 5;

export function PlanningPanel({ tripId, initialCities }: PlanningPanelProps) {
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
    <section className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="prompt" className="text-sm font-medium">
          מה בא לכם לעשות בטיול?
        </label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="לדוגמה: שבוע באיטליה, דגש על אוכל, אמנות ואתרים היסטוריים"
          rows={3}
        />
        <Button
          type="submit"
          disabled={loading || prompt.trim().length < 3}
          className="self-start"
        >
          {loading ? "חושב…" : cities.length > 0 ? "הצעות חדשות" : "קבל הצעות מ-AI"}
        </Button>
      </form>

      {error && <p className="text-sm text-danger-ink">{error}</p>}
      {notice && <p className="text-sm text-muted">{notice}</p>}

      {cities.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cities.map((city, index) => (
              <Link
                key={`${city.name}-${index}`}
                href={`/trips/${tripId}/city/${encodeURIComponent(city.name)}`}
                className="block"
              >
                <Card className="flex h-full flex-col gap-1 p-4 transition-colors hover:border-primary">
                  <span className="font-medium text-primary">
                    {city.name} ←
                  </span>
                  <span className="text-sm text-muted">{city.description}</span>
                </Card>
              </Link>
            ))}
          </div>

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
              {loadingMore ? "מחפש עוד…" : "הצג עוד יעדים"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
