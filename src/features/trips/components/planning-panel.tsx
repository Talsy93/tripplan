"use client";

import Link from "next/link";
import { useState } from "react";
import type { AiCitySuggestion } from "../domain/ai-suggestion";

export function PlanningPanel({ tripId }: { tripId: string }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<AiCitySuggestion[]>([]);

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
      setCities(data.cities ?? []);
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
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="לדוגמה: שבוע באיטליה, דגש על אוכל, אמנות ואתרים היסטוריים"
          rows={3}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || prompt.trim().length < 3}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "חושב…" : "קבל הצעות מ-AI"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cities.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cities.map((city, index) => (
            <Link
              key={`${city.name}-${index}`}
              href={`/trips/${tripId}/city/${encodeURIComponent(city.name)}`}
              className="flex flex-col gap-1 rounded border border-gray-200 px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium">{city.name} ←</span>
              <span className="text-sm text-gray-600">{city.description}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
