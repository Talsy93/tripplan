"use client";

import { useEffect, useState } from "react";
import type {
  AiCategoryKey,
  AiCityGuide,
  AiRecommendation,
} from "../domain/ai-suggestion";

const SECTIONS: { key: AiCategoryKey; label: string; icon: string }[] = [
  { key: "hotels", label: "מלונות", icon: "🏨" },
  { key: "restaurants", label: "מסעדות", icon: "🍽️" },
  { key: "attractions", label: "אטרקציות ואתרים", icon: "📍" },
  { key: "experiences", label: "חוויות ודברים לעשות", icon: "✨" },
];

function RecommendationCard({ item }: { item: AiRecommendation }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
      <span className="font-semibold">{item.name}</span>
      <p className="text-sm text-gray-600">{item.description}</p>
      <p className="text-xs text-gray-500">💡 {item.tip}</p>
    </li>
  );
}

export function CityGuide({ city }: { city: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<AiCityGuide | null>(null);
  const [loadingMore, setLoadingMore] = useState<AiCategoryKey[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/city-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
        });

        if (!active) return;

        if (res.status === 429) {
          setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
          return;
        }
        if (!res.ok) {
          setError("טעינת המדריך נכשלה. נסו שוב.");
          return;
        }

        const data = await res.json();
        if (active) setGuide(data);
      } catch {
        if (active) setError("שגיאת רשת. נסו שוב.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [city]);

  async function loadMore(key: AiCategoryKey) {
    if (!guide || loadingMore.includes(key)) return;

    setLoadingMore((prev) => [...prev, key]);
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          category: key,
          exclude: guide[key].map((item) => item.name),
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const incoming: AiRecommendation[] = data.recommendations ?? [];

      setGuide((prev) => {
        if (!prev) return prev;
        const existing = new Set(
          prev[key].map((item) => item.name.trim().toLowerCase()),
        );
        const fresh = incoming.filter(
          (item) => !existing.has(item.name.trim().toLowerCase()),
        );
        return { ...prev, [key]: [...prev[key], ...fresh] };
      });
    } catch {
      // Silent: the existing list stays intact on failure.
    } finally {
      setLoadingMore((prev) => prev.filter((k) => k !== key));
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">בונה מדריך לעיר…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!guide) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      {SECTIONS.map(({ key, label, icon }) => {
        const items = guide[key] ?? [];
        if (items.length === 0) return null;
        const isLoadingMore = loadingMore.includes(key);
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">
              {icon} {label}
            </h2>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((item, index) => (
                <RecommendationCard key={`${item.name}-${index}`} item={item} />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => loadMore(key)}
              disabled={isLoadingMore}
              className="self-start rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {isLoadingMore ? "מוסיף…" : "עוד תוצאות"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
