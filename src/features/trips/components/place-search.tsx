"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  ListRow,
  Surface,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addPlace } from "../application/place-actions";
import { saveMore, setSelected } from "../application/guide-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { PLACE_CATEGORIES, SEARCH_PRESETS, SEARCH_PRESET_KEYS } from "../domain/place";
import type { AiRecommendation } from "../domain/ai-suggestion";
import {
  cityToneClass,
  cityToneMap,
} from "../domain/tone";
import type { SearchPreset } from "../domain/place";
import type { Place } from "../domain/place";
import type { AddedPlace } from "../infrastructure/place-service";
import { PlaceDetails } from "./place-details";
import { DomainIcon } from "./domain-icon";
import { PlacePhoto } from "./place-photo";

// The Pencil grid's eight tiles. Presets, not stored categories — see
// SEARCH_PRESETS in domain/place.ts for why the two are different lists.
//
// The tints are the export's: three tiles share the warm must-see tint
// (אתרי חובה, מוזיאונים, קפה), and לילה is a bluer lilac than נסתרות beside
// it. There is no token for that one, so it is mixed from two that exist
// rather than hard-coded, and follows them if the palette moves.
const PRESET_TONES: Record<SearchPreset, string> = {
  mustsee: "bg-cat-mustsee-tint text-cat-mustsee-ink",
  food: "bg-cat-food-tint text-cat-food-ink",
  nature: "bg-cat-nature-tint text-cat-nature-ink",
  museums: "bg-cat-mustsee-tint text-cat-mustsee-ink",
  cafe: "bg-cat-mustsee-tint text-cat-mustsee-ink",
  shopping: "bg-cat-shopping-tint text-cat-shopping-ink",
  hidden: "bg-cat-hidden-tint text-cat-hidden-ink",
  nightlife:
    "bg-[color-mix(in_oklab,var(--cat-hidden-tint),var(--primary-tint)_40%)] text-[color-mix(in_oklab,var(--cat-hidden-ink),var(--primary-ink)_25%)]",
};

function PresetTile({
  preset,
  size = "lg",
  className,
}: {
  preset: SearchPreset;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "h-14 w-14 rounded-[18px]" : "h-11 w-11 rounded-[14px]",
        PRESET_TONES[preset],
        className,
      )}
    >
      <DomainIcon
        name={SEARCH_PRESETS[preset].icon}
        className={size === "lg" ? "h-6 w-6" : "h-5 w-5"}
      />
    </span>
  );
}

// A place is in the trip whether or not the itinerary has been built since —
// so "in the trip" is the fallback, and a day is the better news when we have
// it.
function dayLabel(days: number[]) {
  if (days.length === 0) return "בטיול";
  if (days.length === 1) return `יום ${days[0]}`;
  return `ימים ${days.join(", ")}`;
}

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: Place[] }
  // Suggestions from the model for a district, which are not Places: they have
  // no coordinates and no OSM id, so they cannot share the results list.
  | { kind: "ai"; area: string; items: AiRecommendation[] }
  | { kind: "error"; message: string };

// One result page at a time. The server already returns a larger ranked list
// than this (see MAX_RESULTS in lib/overpass.ts) purely so "עוד תוצאות" can
// reveal more of it locally — no second Overpass call, no extra rate-limit
// spend, for something that isn't a new search at all.
const PAGE_SIZE = 20;

// A point to search around instead of the city as a whole — set by "חיפוש
// ליד כאן" on a result. A city's own centre can be many kilometres from a
// district the user actually cares about (this is also why a large city's
// results can look like they're "in the wrong place"), and re-centring on a
// place already found is more accurate than widening the radius would be.
type NearPoint = { latitude: number; longitude: number; label: string };

export function PlaceSearch({
  tripId,
  cities,
  addedPlaces,
  initialCategory = null,
  initialPlaces,
}: {
  tripId: string;
  // The trip's destinations, in route order — the filter's options.
  cities: string[];
  // Places already in the trip, with the itinerary days they're scheduled on,
  // so results can say so instead of offering to add them twice.
  addedPlaces: AddedPlace[];
  // For the preview harness: a category already open with its results, so the
  // result cards can be seen without the search route (it needs a session).
  initialCategory?: SearchPreset | null;
  initialPlaces?: Place[];
}) {
  const [city, setCity] = useState(cities[0] ?? "");
  // Null means the category grid — the screen this tab opens on.
  const [category, setCategory] = useState<SearchPreset | null>(initialCategory);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>(
    initialPlaces ? { kind: "results", places: initialPlaces } : { kind: "idle" },
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [near, setNear] = useState<NearPoint | null>(null);
  // A district inside the city, typed by the user — "Omotesando" in Tokyo.
  const [area, setArea] = useState("");
  // The area the results on screen actually came from, which is not the same
  // as what is in the field: the field can be edited without searching again.
  const [activeArea, setActiveArea] = useState("");
  const [askingAi, setAskingAi] = useState(false);
  const [aiAdded, setAiAdded] = useState<string[]>([]);
  const [open, setOpen] = useState<Place | null>(null);
  const [added, setAdded] = useState<Map<string, number[]>>(
    () => new Map(addedPlaces.map((place) => [place.externalId, place.days])),
  );
  const [adding, setAdding] = useState<string | null>(null);

  const tones = cityToneMap(cities);

  async function add(place: Place) {
    setAdding(place.id);
    // Optimistic: the row is written server-side, and a failure rolls it back.
    // No days yet — it only gets scheduled when the itinerary is next built.
    setAdded((prev) => new Map(prev).set(place.id, []));

    const ok = await addPlace(tripId, city, place);
    if (!ok) {
      setAdded((prev) => {
        const next = new Map(prev);
        next.delete(place.id);
        return next;
      });
    }
    setAdding(null);
  }

  async function search(
    nextPreset: SearchPreset | null,
    nextCity: string = city,
    nextNear: NearPoint | null = near,
    nextArea: string = area,
  ) {
    if (!nextCity) return;
    setStatus({ kind: "searching" });

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          city: nextCity,
          preset: nextPreset ?? undefined,
          query: query.trim() || undefined,
          near: nextNear
            ? { latitude: nextNear.latitude, longitude: nextNear.longitude }
            : undefined,
          // Ignored by the server when `near` is set — an exact point is more
          // specific than a district name, so there is nothing to resolve.
          area: !nextNear && nextArea.trim() ? nextArea.trim() : undefined,
        }),
      });

      if (res.status === 429) {
        setStatus({
          kind: "error",
          message: "יותר מדי חיפושים. נסו שוב בעוד רגע.",
        });
        return;
      }
      if (res.status === 503) {
        // Overpass is a shared service — this is "busy", not "broken", and the
        // difference matters to whether the user bothers trying again.
        setStatus({
          kind: "error",
          message: "שירות המפות עמוס כרגע. נסו שוב בעוד כמה שניות.",
        });
        return;
      }
      if (res.status === 422) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        // "We cannot find Tokyo" and "we cannot find that district in Tokyo"
        // need different reactions — the second is usually a typo, and the
        // AI can often answer it even when OpenStreetMap cannot.
        setStatus({
          kind: "error",
          message:
            body.error === "area_not_located"
              ? `לא מצאנו את האזור "${nextArea}" בתוך ${nextCity}. בדקו את האיות, או בקשו מה-AI רעיונות באזור.`
              : `לא הצלחנו לאתר את ${nextCity} על המפה, אז אין סביב מה לחפש.`,
        });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: "החיפוש נכשל. נסו שוב." });
        return;
      }

      const data: { places: Place[] } = await res.json();
      setVisibleCount(PAGE_SIZE);
      setActiveArea(nextNear ? "" : nextArea.trim());
      setStatus({ kind: "results", places: data.places ?? [] });
    } catch {
      setStatus({ kind: "error", message: "שגיאת רשת. נסו שוב." });
    }
  }

  function openCategory(key: SearchPreset) {
    setCategory(key);
    setNear(null);
    void search(key, city, null, area);
  }

  function backToGrid() {
    setCategory(null);
    setStatus({ kind: "idle" });
    setQuery("");
    setNear(null);
    setArea("");
    setActiveArea("");
  }

  // "Enter" a result the way choosing a city does: re-centre the search on
  // it and run the current category again from there.
  function searchNear(place: Place) {
    const point: NearPoint = {
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.name,
    };
    setOpen(null);
    setNear(point);
    void search(category, city, point);
  }

  function clearNear() {
    setNear(null);
    void search(category, city, null, area);
  }

  // The other half of an area search, and the half OpenStreetMap cannot do.
  //
  // Overpass finds what is *tagged* within a radius. It has no idea that
  // Omotesando means boutiques and a particular kind of café, or which of the
  // places in it are the ones worth going for. So when OSM comes back thin —
  // or cannot place the district at all — the model is asked the same question
  // and its answers are added to the trip as guide items.
  async function askAiAboutArea() {
    const target = area.trim() || activeArea;
    if (!target || !city) return;

    setAskingAi(true);
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          area: target,
          // Attractions rather than the category on screen: the six search
          // categories are OSM tag groups and only two of them map onto the
          // guide's four. "What is this district known for" is an attractions
          // question whichever tile the user came in through.
          category: "attractions",
          count: 5,
        }),
      });

      if (!res.ok) {
        setStatus({
          kind: "error",
          message: await aiErrorFromResponse(
            res,
            "בקשת הרעיונות נכשלה. נסו שוב.",
          ),
        });
        return;
      }

      const data = await res.json();
      const items: AiRecommendation[] = data.recommendations ?? [];
      if (items.length === 0) {
        setStatus({
          kind: "error",
          message: `ה-AI לא מצא המלצות באזור ${target}.`,
        });
        return;
      }

      // Written to the trip's guide for this city, so they survive leaving the
      // tab and can be added like any other guide item. The area is recorded
      // in the name so a list of twelve attractions in Tokyo still says which
      // district each one is in.
      await saveMore(
        tripId,
        city,
        "attractions",
        items.map((item) => ({ ...item, name: `${item.name} (${target})` })),
      );
      setStatus({ kind: "ai", area: target, items });
    } catch {
      setStatus({ kind: "error", message: "שגיאת רשת. נסו שוב." });
    } finally {
      setAskingAi(false);
    }
  }

  async function addAiItem(item: AiRecommendation, target: string) {
    const name = `${item.name} (${target})`;
    setAdding(name);
    await setSelected(tripId, city, "attractions", name, true);
    setAiAdded((current) => [...current, name]);
    setAdding(null);
  }

  // The results list, the empty state and the "more" button, shared by both
  // shapes this component takes. The grid used to be a dead end — there was no
  // way to search without first picking a category — so this markup only ever
  // rendered in one place and lived inline there.
  const results = (
    <>
      {status.kind === "searching" && <ResultSkeletons />}
      {status.kind === "results" && status.places.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="לא נמצאו תוצאות"
          description={
            activeArea
              ? `אין מקומות מתויגים בקטגוריה הזו ב${activeArea}. נסו קטגוריה אחרת, או בקשו מה-AI רעיונות באזור.`
              : "נסו קטגוריה אחרת, עיר אחרת, או חיפוש רחב יותר."
          }
        />
      )}
      {status.kind === "results" && status.places.length > 0 && (
        // Cards, two across on a phone (2026-09-25, "design how the results
        // look"): a list of forty text rows read as a directory; a grid of
        // tinted cards reads as places. The card is the details button; the
        // round "+" in its corner is the add, its own target.
        <ul className="stagger grid grid-cols-2 gap-3 @2xl:grid-cols-3">
          {status.places.slice(0, visibleCount).map((place) => (
            <li key={place.id} className="animate-rise min-w-0">
              <ResultCard
                place={place}
                city={city}
                preset={category}
                days={added.get(place.id)}
                adding={adding === place.id}
                onOpen={() => setOpen(place)}
                onAdd={() => void add(place)}
              />
            </li>
          ))}
        </ul>
      )}
      {status.kind === "results" && status.places.length > visibleCount && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="self-center rounded-full px-6"
        >
          עוד {Math.min(PAGE_SIZE, status.places.length - visibleCount)} מקומות
        </Button>
      )}
    </>
  );

  if (cities.length === 0) {
    return (
      <EmptyState
        icon={<Compass />}
        title="קודם בחרו יעדים"
        description="החיפוש עובד סביב ערי הטיול, אז הוסיפו יעד אחד לפחות."
      />
    );
  }

  // ---- The grid: where this tab starts -------------------------------------
  if (category === null) {
    return (
      <div className="flex flex-col gap-4">
        {/* Free text across every category, which is what the design puts
            above the grid — the API's `category` was already optional, so the
            grid is not a dead end.

            Pencil: one tall white pill with the magnifier at its start and the
            city in the placeholder. The round submit button only appears once
            there is something to submit — the export draws none, and Enter (the
            keyboard's "search" key on a phone) already sends the form. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search(null);
          }}
          className="flex h-14 items-center gap-2 rounded-full bg-surface pe-2 ps-5 shadow-card"
        >
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`מקום, מסעדה או שכונה ב${city}`}
            aria-label={`חיפוש ב${city}`}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:font-normal placeholder:text-placeholder"
          />
          {query.trim() && (
            <button
              type="submit"
              aria-label={`חיפוש ב${city}`}
              disabled={status.kind === "searching"}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground transition-colors hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status.kind === "searching" && "opacity-60",
              )}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </form>
        {/* Which destination, when there is more than one. The category view has
            its own copy of this in a sticky bar; here it is a plain row, because
            nothing scrolls under it. */}
        {cities.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cities.map((option) => (
              <Chip
                key={option}
                active={option === city}
                onClick={() => {
                  setCity(option);
                  setNear(null);
                  setStatus({ kind: "idle" });
                }}
              >
                {option}
              </Chip>
            ))}
          </div>
        )}
        {/* Pencil: the export's eight tinted icon tiles, 4×2 on a phone, with
            the label under each; one row of eight once the column is wide
            enough. The per-tile "already in the trip" count went with the
            six stored categories — a preset like טבע or לילה does not map 1:1
            onto what a row stores, so any count on it would be a guess.
            stagger + animate-rise stay — inert under prefers-reduced-motion,
            see globals.css. */}
        <div className="stagger grid grid-cols-4 gap-x-2 gap-y-3 @2xl:grid-cols-8">
          {SEARCH_PRESET_KEYS.map((key) => {
            const meta = SEARCH_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => openCategory(key)}
                className={cn(
                  "animate-rise group/cat flex min-w-0 flex-col items-center gap-1.5 rounded-[18px] py-1",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <PresetTile
                  preset={key}
                  className="transition-transform duration-press ease-snap group-hover/cat:scale-105 group-active/cat:scale-95"
                />
                <span className="max-w-full truncate text-caption font-semibold text-foreground">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
        {status.kind === "error" && (
          <Banner tone="danger">{status.message}</Banner>
        )}
        {results}
        {open && (
          <PlaceDetails
            place={open}
            city={city}
            onClose={() => setOpen(null)}
            onSearchNearby={() => searchNear(open)}
          />
        )}
      </div>
    );
  }

  // ---- One category --------------------------------------------------------
  const meta = SEARCH_PRESETS[category];
  const found = status.kind === "results" ? status.places.length : null;

  return (
    <div className="flex flex-col gap-4">
      {/* The category's own band: its tint edge to edge of the card, the tile,
          the name, how many were found and where — and the city chips inside
          it, so which city this is never scrolls out of the header. */}
      <section className={cn("flex flex-col gap-3 rounded-[24px] p-4", PRESET_TONES[category])}>
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={backToGrid}
            aria-label="חזרה לקטגוריות"
            className="-ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface/70 text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <PresetTile preset={category} size="md" className="bg-surface" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="min-w-0 text-xl leading-7 font-bold text-foreground wrap-anywhere">
              {meta.label}
            </h2>
            <p className="flex min-w-0 items-center gap-1 text-[13px] text-muted-strong">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {found !== null && `${found} מקומות · `}
                {near ? `ליד ${near.label}` : activeArea ? `${activeArea} · ${city}` : city}
              </span>
            </p>
          </div>
          {near && (
            <button
              type="button"
              onClick={clearNear}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface/70 px-3 text-xs font-semibold text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              כל {city}
            </button>
          )}
        </div>
        {cities.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cities.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCity(option);
                  setNear(null);
                  void search(category, option, null);
                }}
                aria-pressed={option === city}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  option === city ? "bg-foreground text-background" : "bg-surface/70 text-foreground hover:bg-surface",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* One search pill for a name inside the category; the district search is
          a second, quieter pill — it is the less common question. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search(category);
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex h-12 items-center gap-2 rounded-full bg-surface pe-1.5 ps-4 shadow-card focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`חיפוש בתוך ${meta.label}`}
            aria-label={`חיפוש בתוך ${meta.label}`}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
          />
          {(query.trim() || area.trim()) && (
            <button
              type="submit"
              aria-label="חיפוש"
              disabled={status.kind === "searching"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {/* The field that makes a district searchable at all: the name search
            above matches a place's *name*, so "Omotesando" finds nothing there.
            This one is resolved to a point and becomes the search's centre. */}
        <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface/60 pe-1.5 ps-4">
          <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder={`שכונה ב${city} — למשל Omotesando`}
            aria-label={`שכונה ב${city}`}
            disabled={near !== null}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-placeholder disabled:opacity-50"
          />
          {area.trim() && (
            <button
              type="button"
              onClick={() => {
                setArea("");
                void search(category, city, near, "");
              }}
              aria-label="ניקוי השכונה"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-sunken"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>

      {status.kind === "error" && (
        <Banner tone="danger">{status.message}</Banner>
      )}

      {/* Offered whenever a district is in play, not only on failure.
          OpenStreetMap and the model know different things: OSM has the real
          shops with their opening hours, the model knows what the district is
          for. Both are worth having, so the button sits beside the results
          rather than replacing them. */}
      {(area.trim() || activeArea) && status.kind !== "searching" && (
        // Quiet, not lit — and that is a change T7 made rather than the shape
        // this started as.
        //
        // It used to be an AuraPanel described as "the one lit element on the
        // discovery screen". It was not: the discovery panel below it on the
        // same tab is lit too, and this one is two levels into a flow (open a
        // category, type a district), so both could be on screen at once. Law 03
        // allows one per screen, and the one the design draws on this tab is the
        // discovery offer — see planning-panel.tsx.
        //
        // The sparkle and the tinted glyph still say "the model is offering
        // something", which is the whole job. Full light was never carrying more
        // meaning than that here.
        <Surface tone="quiet" className="flex min-w-0 gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink"
            aria-hidden="true"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="min-w-0 text-base font-bold wrap-anywhere">
              מה ה-AI ממליץ ב{area.trim() || activeArea}?
            </p>
            <p className="min-w-0 max-w-measure text-sm text-muted">
              OpenStreetMap יודע אילו מקומות יש ומתי הם פתוחים. את מה שהאזור
              עצמו שווה בשבילו — לא.
            </p>
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => void askAiAboutArea()}
              loading={askingAi}
              className="mt-2 self-start"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              בקשו הצעות
            </Button>
          </div>
        </Surface>
      )}

      {status.kind === "ai" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            המלצות ה-AI לאזור {status.area}. הן נשמרות במדריך של {city}.
          </p>
          <ul className="grid gap-2 @2xl:grid-cols-2">
            {status.items.map((item) => {
              const name = `${item.name} (${status.area})`;
              return (
                <li key={item.name} className={cityToneClass(tones, city)}>
                  <ListRow
                    accent="tone"
                    title={item.name}
                    subtitle={item.description}
                    trailing={
                      aiAdded.includes(name) ? (
                        <Badge tone="success">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          נוסף
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="soft"
                          loading={adding === name}
                          onClick={() => void addAiItem(item, status.area)}
                        >
                          הוספה
                        </Button>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {results}

      {open && (
        <PlaceDetails
          place={open}
          city={city}
          onClose={() => setOpen(null)}
          onSearchNearby={() => searchNear(open)}
        />
      )}
    </div>
  );
}

// One search result as a card: the category's tint and glyph on top — or, for a
// place with a Wikipedia entry, its photograph, which is the one kind of place
// the free photo lookup reliably finds — then the name and one line of what it
// is, and the round "+" (or the day it is on) in the corner.
function ResultCard({
  place,
  city,
  preset,
  days,
  adding,
  onOpen,
  onAdd,
}: {
  place: Place;
  city: string;
  preset: SearchPreset | null;
  days: number[] | undefined;
  adding: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const tone = preset ? PRESET_TONES[preset] : "bg-surface-sunken text-muted";
  const icon = preset
    ? SEARCH_PRESETS[preset].icon
    : PLACE_CATEGORIES[place.category ?? "other"].icon;
  const glyph = <DomainIcon name={icon} className="h-8 w-8" />;
  const meta =
    [place.cuisine, place.brand].filter(Boolean).join(" · ") ||
    place.openingHours ||
    place.address;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[20px] bg-surface shadow-card">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className={cn("relative flex h-24 w-full items-center justify-center", tone)}>
          {place.notable ? (
            <PlacePhoto
              query={place.localName ?? place.name}
              near={city}
              className={cn("absolute inset-0 flex h-full w-full items-center justify-center", tone)}
              fallback={glyph}
            />
          ) : (
            glyph
          )}
          {place.notable && (
            <span className="absolute top-2 start-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-bold text-foreground">
              מוכר
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 p-3 pb-14">
          <span className="line-clamp-2 text-[15px] leading-snug font-bold text-foreground">
            {place.name}
          </span>
          {meta && (
            <span className="line-clamp-1 text-xs text-muted" dir="auto">
              {meta}
            </span>
          )}
        </span>
      </button>
      <div className="absolute end-2.5 bottom-2.5">
        {days ? (
          <span className="flex h-9 items-center gap-1 rounded-full bg-success-tint px-3 text-xs font-bold text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {dayLabel(days)}
          </span>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={adding}
            aria-label={`הוספת ${place.name} לטיול`}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              adding && "opacity-60",
            )}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

function ResultSkeletons() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-[20px] bg-surface shadow-card">
          <div className="h-24 animate-pulse bg-surface-sunken" />
          <div className="flex flex-col gap-2 p-3 pb-6">
            <div className="h-4 w-4/5 animate-pulse rounded bg-surface-sunken" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
          </div>
        </li>
      ))}
    </ul>
  );
}
