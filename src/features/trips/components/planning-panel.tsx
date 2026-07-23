"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Textarea } from "@/components/ui";
import { saveCities } from "../application/guide-actions";
import type { AiCitySuggestion } from "../domain/ai-suggestion";

type PlanningPanelProps = {
  tripId: string;
  initialCities: AiCitySuggestion[];
};

export function PlanningPanel({ tripId, initialCities }: PlanningPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<AiCitySuggestion[]>(initialCities);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count: 5 }),
      });

      if (res.status === 429) {
        setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError("קבלת ההצעות נכשלה. נסו שוב.");
        return;
      }

      const data = await res.json();
      const newCities: AiCitySuggestion[] = data.cities ?? [];
      setCities(newCities);
      await saveCities(tripId, newCities);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setLoading(false);
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cities.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cities.map((city, index) => (
            <Link
              key={`${city.name}-${index}`}
              href={`/trips/${tripId}/city/${encodeURIComponent(city.name)}`}
              className="block"
            >
              <Card className="flex h-full flex-col gap-1 p-4 transition-colors hover:border-primary">
                <span className="font-medium text-primary">{city.name} ←</span>
                <span className="text-sm text-muted">{city.description}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
