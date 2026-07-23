"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
import {
  refreshGuide,
  saveGuide,
  saveMore,
  setSelected,
} from "../application/guide-actions";
import type {
  AiCategoryKey,
  AiCityGuide,
  AiRecommendation,
  CityGuideData,
  GuideItem,
  SavedCityGuide,
} from "../domain/ai-suggestion";

const SECTIONS: { key: AiCategoryKey; label: string; icon: string }[] = [
  { key: "areas", label: "אזורי לינה", icon: "🏘️" },
  { key: "restaurants", label: "מסעדות", icon: "🍽️" },
  { key: "attractions", label: "אטרקציות ואתרים", icon: "📍" },
  { key: "experiences", label: "חוויות ודברים לעשות", icon: "✨" },
];

function withSelected(items: AiRecommendation[]): GuideItem[] {
  return items.map((item) => ({ ...item, selected: false }));
}

function toGuideData(guide: AiCityGuide): CityGuideData {
  const sections: SavedCityGuide = {
    areas: withSelected(guide.areas),
    restaurants: withSelected(guide.restaurants),
    attractions: withSelected(guide.attractions),
    experiences: withSelected(guide.experiences),
  };
  return {
    intro: guide.intro,
    gettingThere: guide.getting_there,
    sections,
  };
}

function GuideCard({
  item,
  city,
  onToggle,
}: {
  item: GuideItem;
  city: string;
  onToggle: () => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold">{item.name}</span>
        <Button
          type="button"
          variant={item.selected ? "primary" : "outline"}
          size="sm"
          onClick={onToggle}
          className="shrink-0"
        >
          {item.selected ? "✓ נוסף" : "הוסף לטיול"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-muted">{item.description}</p>
      <p className="text-xs text-muted">💡 {item.tip}</p>
      <a
        href={googleMapsSearchUrl(`${item.name} ${city}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-xs text-primary hover:underline"
      >
        🗺️ פתח ב-Google Maps
      </a>
    </Card>
  );
}

type CityGuideProps = {
  tripId: string;
  city: string;
  initialGuide: CityGuideData | null;
};

export function CityGuide({ tripId, city, initialGuide }: CityGuideProps) {
  const [guide, setGuide] = useState<CityGuideData | null>(initialGuide);
  const [loading, setLoading] = useState(!initialGuide);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<AiCategoryKey[]>([]);

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
      await saveGuide(tripId, city, data);
      setGuide(toGuideData(data));
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    }
  }, [tripId, city]);

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
          exclude: guide.sections[key].map((item) => item.name),
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const incoming: AiRecommendation[] = data.recommendations ?? [];

      let added: AiRecommendation[] = [];
      setGuide((prev) => {
        if (!prev) return prev;
        const existing = new Set(
          prev.sections[key].map((item) => item.name.trim().toLowerCase()),
        );
        added = incoming.filter(
          (item) => !existing.has(item.name.trim().toLowerCase()),
        );
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [key]: [...prev.sections[key], ...withSelected(added)],
          },
        };
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

  function toggle(key: AiCategoryKey, item: GuideItem) {
    const next = !item.selected;
    setGuide((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [key]: prev.sections[key].map((it) =>
            it.name === item.name ? { ...it, selected: next } : it,
          ),
        },
      };
    });
    void setSelected(tripId, city, key, item.name, next);
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
    <div className="flex flex-col gap-8">
      {(guide.intro || guide.gettingThere) && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-5">
          {guide.intro && <p className="leading-relaxed">{guide.intro}</p>}
          {guide.gettingThere && (
            <p className="flex items-start gap-2 text-sm text-muted">
              <span aria-hidden="true">🧭</span>
              <span>{guide.gettingThere}</span>
            </p>
          )}
        </section>
      )}

      <div className="flex items-center gap-3">
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
        const items = guide.sections[key] ?? [];
        if (items.length === 0) return null;
        const isLoadingMore = loadingMore.includes(key);
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">
              {icon} {label}
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <GuideCard
                  key={`${item.name}-${index}`}
                  item={item}
                  city={city}
                  onToggle={() => toggle(key, item)}
                />
              ))}
            </div>
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
