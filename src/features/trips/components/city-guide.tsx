"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Compass, Lightbulb, Map as MapIcon, Plus } from "lucide-react";
import { Banner, Button, ReadMore, Skeleton } from "@/components/ui";
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
import { CategoryTile } from "./category-tile";

// Pencil gives each section three names: a one-word pill ("מסעדות"), a
// question for the heading over its cards ("איפה אוכלים ברומא"), and the kind
// of thing one card is, for the line under its name. The icon is the category
// tile now (category-tile.tsx), so no lucide component is carried here.
const SECTIONS: {
  key: AiCategoryKey;
  tab: string;
  heading: (city: string) => string;
  kind: string;
}[] = [
  {
    key: "areas",
    tab: "לינה",
    heading: (city) => `איפה לנים ב${city}`,
    kind: "אזור לינה",
  },
  {
    key: "restaurants",
    tab: "מסעדות",
    heading: (city) => `איפה אוכלים ב${city}`,
    kind: "מסעדה",
  },
  {
    key: "attractions",
    tab: "אטרקציות",
    heading: (city) => `מה רואים ב${city}`,
    kind: "אטרקציה או אתר",
  },
  {
    key: "experiences",
    tab: "חוויות",
    heading: (city) => `מה עושים ב${city}`,
    kind: "חוויה",
  },
];

// The pill row, "סקירה" first. Derived from SECTIONS rather than written out
// again, so a new category appears in both or in neither.
const TABS: { key: "overview" | AiCategoryKey; label: string }[] = [
  { key: "overview", label: "סקירה" },
  ...SECTIONS.map((section) => ({ key: section.key, label: section.tab })),
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

// One recommendation, as Pencil draws it: a white card with the category
// tile, the name and what kind of place it is, the add pill at the far end,
// the description under them, and the tip as a small grey tag at the foot.
//
// This used to fold the description, the tip and the Maps link behind the
// name, because a category of ten was ten paragraphs to read past. The design
// puts the description on the card — it is one or two sentences, and it is
// what tells two restaurants apart — so it is open again, capped at three
// lines. The Maps link survives as an icon button beside the tip.
function GuideCard({
  item,
  city,
  category,
  kind,
  onToggle,
}: {
  item: GuideItem;
  city: string;
  category: AiCategoryKey;
  kind: string;
  onToggle: () => void;
}) {
  return (
    <article className="@container/card flex h-full min-w-0 flex-col gap-3 rounded-[20px] bg-surface p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryTile category={category} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="min-w-0 text-base font-bold leading-6 break-words text-pretty">
            {item.name}
          </h3>
          <p className="min-w-0 truncate text-caption text-muted">{kind}</p>
        </div>
        {/* Beside the name only when the card has the width for both — see
            AddPill. */}
        <AddPill item={item} onToggle={onToggle} className="hidden @[21rem]/card:flex" />
      </div>

      {item.description && (
        <p className="line-clamp-3 min-w-0 text-sm leading-6 text-foreground/80">
          {item.description}
        </p>
      )}

      <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
        {item.tip ? (
          <p className="flex min-w-0 items-start gap-1.5 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-caption text-muted">
            <Lightbulb
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0">{item.tip}</span>
          </p>
        ) : (
          <span />
        )}
        <span className="flex shrink-0 items-center gap-1">
        <AddPill item={item} onToggle={onToggle} className="flex @[21rem]/card:hidden" />
        <a
          href={googleMapsSearchUrl(`${item.name} ${city}`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.name} ב-Google Maps`}
          title="פתיחה ב-Google Maps"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
        </a>
        </span>
      </div>
    </article>
  );
}

// "הוספה +" outlined at rest, "נוסף ✓" filled green once the place is in;
// pressing it again takes it out. Beside the name in a wide card; in a narrow
// one (three across on a tablet) it moves to the card's foot, because beside
// the name it left the name ~90px and broke it word by word — reported as the
// guide being "completely broken on the iPad". Only one of the two is ever
// displayed.
function AddPill({
  item,
  onToggle,
  className,
}: {
  item: GuideItem;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={item.selected}
      aria-label={
        item.selected
          ? `הסרה של ${item.name} מהטיול`
          : `הוספת ${item.name} לטיול`
      }
      className={cn(
        className,
        "h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        item.selected
          ? "bg-success text-white hover:bg-success-strong"
          : "border border-border-strong bg-surface text-foreground hover:bg-surface-sunken",
      )}
    >
      {item.selected ? (
        <Check className="h-4 w-4 animate-stamp" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      {item.selected ? "נוסף" : "הוספה"}
    </button>
  );
}

type CityGuideProps = {
  tripId: string;
  city: string;
  initialGuide: CityGuideData | null;
  // PN21: "<עיר> בקצרה", beside the sections from @4xl. Under the pill row
  // rather than beside the whole guide, so the terracotta strip keeps the full
  // width of the band it continues.
  aside?: ReactNode;
};

export function CityGuide({ tripId, city, initialGuide, aside }: CityGuideProps) {
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
        <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
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
    // gap-4, not gap-8: the pill row and the section it selects are one thing,
    // and eight units of air between them read as two.
    <div className="flex flex-col gap-4">
      {/* The pill row, inside the terracotta band — Pencil draws the tabs as
          the band's last line. The band itself is CityBand, the page's banner;
          this strip continues it with the same fill, full-bleed by the same
          negative margins, and -mt-6 closes the gap PageEnter puts between the
          banner and the content. It has to be this component's first child for
          that to hold, which is why the banners below come after it.

          The selected pill is white with the band's ink, the rest are white on
          a 12% veil — a chosen filter is a state, not a call to action. */}
      <div className="-mx-4 -mt-6 flex gap-2 overflow-x-auto bg-cat-mustsee-ink px-4 pb-4 [scrollbar-width:none] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
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
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                active
                  ? "bg-white text-cat-mustsee-ink"
                  : "bg-white/12 text-white hover:bg-white/20",
              )}
            >
              {option.label}
              {count !== null && (
                <span className="tabular-nums opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex flex-col gap-4",
          aside && "@4xl:grid @4xl:grid-cols-[minmax(0,1fr)_21rem] @4xl:items-start @4xl:gap-8",
        )}
      >
      <div className="flex min-w-0 flex-col gap-4">
      {error && <Banner tone="danger">{error}</Banner>}

      {keptNotice !== null && keptNotice > 0 && (
        <Banner tone="info">
          {keptNotice === 1
            ? "פריט אחד שהוספתם לטיול נשמר"
            : `${keptNotice} פריטים שהוספתם לטיול נשמרו`}{" "}
          — רענון מחליף רק את ההצעות, לא את מה שבחרתם.
        </Banner>
      )}

      {/* "סקירה" — what the mockup calls "מה כדאי לדעת": the prose, the
          getting-there line, and the whole-guide refresh. It is the tab that is
          about the guide rather than about one category of it, which is why the
          refresh lives here and not above the pills. */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {(guide.intro || guide.gettingThere) && (
            <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-card">
              {/* The model writes three or four sentences here and they open
                  the tab. The first two say which city this is and what shape
                  it has, which is what the reader came for; the rest is worth
                  having and worth asking for. */}
              {guide.intro && (
                <ReadMore className="text-foreground">{guide.intro}</ReadMore>
              )}
              {guide.gettingThere && (
                <p className="flex max-w-measure items-start gap-2 text-sm text-muted">
                  <Compass
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{guide.gettingThere}</span>
                </p>
              )}
            </div>
          )}

          {/* The caption that used to sit beside this button said "refresh
              brings new suggestions, what you added stays" — which is word for
              word what the banner says after a refresh, where it is actually
              needed. Standing furniture explaining a button nobody has pressed
              yet. */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              className="ms-auto shrink-0 rounded-full"
            >
              רענון הצעות
            </Button>
          </div>
        </div>
      )}
      {tab !== "overview" &&
        SECTIONS.filter((section) => section.key === tab).map(
          ({ key, heading, kind }) => {
            const items = guide.sections[key] ?? [];
            const isLoadingMore = loadingMore.includes(key);
            return (
              <section key={key} className="flex flex-col gap-3">
                {/* Pencil: the section's question, and the count at the far
                    end. */}
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <h2 className="min-w-0 text-lg font-bold leading-6 wrap-anywhere">
                    {heading(city)}
                  </h2>
                  <span className="shrink-0 text-caption tabular-nums text-muted">
                    {items.length === 1
                      ? "המלצה אחת"
                      : `${items.length} המלצות`}
                  </span>
                </div>
                {/* A guide card is a paragraph and a button, so three across is
                    comfortable on a desktop. It was one column at every width. */}
                <div className="grid gap-3 @md:grid-cols-2 @5xl:grid-cols-3">
                  {items.map((item, index) => (
                    <GuideCard
                      key={`${item.name}-${index}`}
                      item={item}
                      city={city}
                      category={key}
                      kind={kind}
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
                  className="self-start rounded-full"
                >
                  עוד תוצאות
                </Button>
              </section>
            );
          },
        )}
      </div>
      {aside && <aside className="min-w-0 @4xl:sticky @4xl:top-6">{aside}</aside>}
      </div>
    </div>
  );
}
