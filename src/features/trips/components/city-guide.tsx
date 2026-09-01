"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Compass, Lightbulb, Map as MapIcon } from "lucide-react";
import {
  Banner,
  Button,
  Card,
  SectionHeading,
  Skeleton,
  Surface,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { googleMapsSearchUrl } from "@/lib/maps";
import { aiErrorFromResponse } from "../domain/ai-errors";
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
import {
  Building2,
  MapPin,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";

// The icon is the component, not a rendered element: a section header and a
// chip want it at different sizes, and a stored element would fix the size at
// the point of declaration.
const SECTIONS: { key: AiCategoryKey; label: string; Icon: LucideIcon }[] = [
  { key: "areas", label: "אזורי לינה", Icon: Building2 },
  { key: "restaurants", label: "מסעדות", Icon: Utensils },
  { key: "attractions", label: "אטרקציות ואתרים", Icon: MapPin },
  { key: "experiences", label: "חוויות ודברים לעשות", Icon: Sparkles },
];

// The pill row, "סקירה" first. Derived from SECTIONS rather than written out
// again, so a new category appears in both or in neither.
const TABS: { key: "overview" | AiCategoryKey; label: string }[] = [
  { key: "overview", label: "סקירה" },
  ...SECTIONS.map((section) => ({ key: section.key, label: section.label })),
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
    <Card className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold">{item.name}</span>
        <Button
          type="button"
          variant={item.selected ? "primary" : "outline"}
          size="sm"
          onClick={onToggle}
          className="shrink-0"
        >
          {item.selected && <Check className="h-4 w-4" aria-hidden="true" />}
          {item.selected ? "נוסף" : "הוספה לטיול"}
        </Button>
      </div>
      <p className="text-sm text-muted">{item.description}</p>
      <p className="flex items-start gap-1.5 text-caption text-muted">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {item.tip}
      </p>
      <a
        href={googleMapsSearchUrl(`${item.name} ${city}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-1 self-start text-caption font-semibold text-primary-ink hover:underline"
      >
        <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
        פתיחה ב-Google Maps
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
  const [keptNotice, setKeptNotice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<AiCategoryKey[]>([]);
  // Which pill is selected. "overview" is the intro and the tips — what the
  // mockup calls "סקירה" and puts first.
  //
  // The four sections used to render stacked, all of them, which on a city with
  // a full guide was four grids of cards in one scroll. The design draws a pill
  // row instead: one section at a time, and the row is how you get between
  // them.
  const [tab, setTab] = useState<"overview" | AiCategoryKey>("overview");

  const generate = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/city-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });

      if (!res.ok) {
        setError(
          await aiErrorFromResponse(res, "טעינת המדריך נכשלה. נסו שוב."),
        );
        return;
      }

      const data: AiCityGuide = await res.json();
      // The saved guide, not the AI response: it carries the selected flags of
      // anything already in the trip, which the response cannot know about.
      // Falling back to the raw response keeps the screen working if the
      // read-back fails for any reason.
      const saved = await saveGuide(tripId, city, data);
      setGuide(saved ?? toGuideData(data));
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
    const kept = await refreshGuide(tripId, city);
    setGuide(null);
    await generate();
    // Said out loud, because the list will not look wholly new and that is the
    // point: refreshing replaces the suggestions, never what is in the trip.
    setKeptNotice(kept);
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
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }
  if (error && !guide) {
    return <Banner tone="danger">{error}</Banner>;
  }
  if (!guide) {
    return null;
  }

  return (
    // gap-5, not gap-8: the pill row and the section it selects are one thing,
    // and eight units of air between them read as two.
    <div className="flex flex-col gap-5">
      {error && <Banner tone="danger">{error}</Banner>}

      {keptNotice !== null && keptNotice > 0 && (
        <Banner tone="info">
          {keptNotice === 1
            ? "פריט אחד שהוספתם לטיול נשמר"
            : `${keptNotice} פריטים שהוספתם לטיול נשמרו`}{" "}
          — רענון מחליף רק את ההצעות, לא את מה שבחרתם.
        </Banner>
      )}

      {/* The pill row. Ink for the selected one, not the action blue: a chosen
          filter is a state, and blue in this app means "press this" — the same
          call the day strip and the phone tab bar already make. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((option) => {
          const active = option.key === tab;
          const count =
            option.key === "overview"
              ? null
              : (guide.sections[option.key] ?? []).length;
          if (count === 0) return null;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setTab(option.key)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-foreground text-surface"
                  : "border border-border bg-surface text-muted hover:text-foreground",
              )}
            >
              {option.label}
              {count !== null && (
                <span className="tabular-nums opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* "סקירה" — what the mockup calls "מה כדאי לדעת": the prose, the
          getting-there line, and the whole-guide refresh. It is the tab that is
          about the guide rather than about one category of it, which is why the
          refresh lives here and not above the pills. */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {(guide.intro || guide.gettingThere) && (
            <Surface tone="quiet" padding="lg" className="flex flex-col gap-3">
              {guide.intro && <p className="max-w-measure">{guide.intro}</p>}
              {guide.gettingThere && (
                <p className="flex max-w-measure items-start gap-2 text-sm text-muted">
                  <Compass
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{guide.gettingThere}</span>
                </p>
              )}
            </Surface>
          )}

          <div className="flex items-center gap-3">
            <p className="max-w-measure text-caption text-muted">
              רענון מביא הצעות חדשות. מה שהוספתם לטיול נשאר.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              className="ms-auto shrink-0"
            >
              רענון הצעות
            </Button>
          </div>
        </div>
      )}
      {tab !== "overview" &&
        SECTIONS.filter((section) => section.key === tab).map(
          ({ key, label, Icon }) => {
            const items = guide.sections[key] ?? [];
            const isLoadingMore = loadingMore.includes(key);
            return (
              <section key={key} className="flex flex-col gap-3">
                <SectionHeading
                  level="section"
                  leading={
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  }
                >
                  {label}
                </SectionHeading>
                {/* A guide card is a paragraph and a button, so three across is
                    comfortable on a desktop. It was one column at every width. */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  loading={isLoadingMore}
                  className="self-start"
                >
                  עוד תוצאות
                </Button>
              </section>
            );
          },
        )}
    </div>
  );
}
