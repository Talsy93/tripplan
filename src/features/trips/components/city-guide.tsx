"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { refreshGuide, saveGuide, saveMore } from "../application/guide-actions";
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
    <Card className="flex h-full flex-col gap-2 p-4">
      <span className="font-semibold">{item.name}</span>
      <p className="text-sm text-muted">{item.description}</p>
      <p className="mt-auto text-xs text-muted">💡 {item.tip}</p>
    </Card>
  );
}

type CityGuideProps = {
  tripId: string;
  city: string;
  initialGuide: AiCityGuide | null;
};

export function CityGuide({ tripId, city, initialGuide }: CityGuideProps) {
  const [guide, setGuide] = useState<AiCityGuide | null>(initialGuide);
  const [loading, setLoading] = useState(!initialGuide);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<AiCategoryKey[]>([]);

  // Generate a guide from the AI and persist it. Used on first visit and refresh.
  const generate = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/city-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });

      if (res.status === 429) {
        setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError("טעינת המדריך נכשלה. נסו שוב.");
        return;
      }

      const data: AiCityGuide = await res.json();
      setGuide(data);
      await saveGuide(tripId, city, data);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    }
  }, [tripId, city]);

  // Only generate when there is nothing saved yet.
  const hasGenerated = useRef(Boolean(initialGuide));
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;
    setLoading(true);
    generate().finally(() => setLoading(false));
  }, [generate]);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshGuide(tripId, city);
    setGuide(null);
    await generate();
    setRefreshing(false);
  }

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

      let added: AiRecommendation[] = [];
      setGuide((prev) => {
        if (!prev) return prev;
        const existing = new Set(
          prev[key].map((item) => item.name.trim().toLowerCase()),
        );
        added = incoming.filter(
          (item) => !existing.has(item.name.trim().toLowerCase()),
        );
        return { ...prev, [key]: [...prev[key], ...added] };
      });

      if (added.length > 0) {
        await saveMore(tripId, city, key, added);
      }
    } catch {
      // Silent: the existing list stays intact on failure.
    } finally {
      setLoadingMore((prev) => prev.filter((k) => k !== key));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">בונה מדריך לעיר…</p>;
  }
  if (error && !guide) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!guide) {
    return null;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between gap-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ms-auto"
        >
          {refreshing ? "מרענן…" : "רענן הצעות"}
        </Button>
      </div>

      {SECTIONS.map(({ key, label, icon }) => {
        const items = guide[key] ?? [];
        if (items.length === 0) return null;
        const isLoadingMore = loadingMore.includes(key);
        return (
          <section key={key} className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">
              {icon} {label}
            </h2>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <RecommendationCard item={item} />
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadMore(key)}
              disabled={isLoadingMore}
              className="self-start"
            >
              {isLoadingMore ? "מוסיף…" : "עוד תוצאות"}
            </Button>
          </section>
        );
      })}
    </div>
  );
}
