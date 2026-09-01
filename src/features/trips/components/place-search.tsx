"use client";

import { useState } from "react";
import {
  Check,
  ChevronRight,
  Compass,
  MapPin,
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
  Glyph,
  Input,
  ListRow,
  SectionHeading,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addPlace } from "../application/place-actions";
import { saveMore, setSelected } from "../application/guide-actions";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { PLACE_CATEGORIES } from "../domain/place";
import type { AiRecommendation } from "../domain/ai-suggestion";
import {
  cityToneClass,
  cityToneMap,
  toneByIndex,
  toneClass,
} from "../domain/tone";
import type { PlaceCategory } from "../domain/place";
import type { Place } from "../domain/place";
import type { AddedPlace } from "../infrastructure/place-service";
import { PlaceDetails } from "./place-details";
import { AuraPanel } from "./aura-panel";
import { DomainIcon } from "./domain-icon";

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[];

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
  savedCounts,
}: {
  tripId: string;
  // The trip's destinations, in route order — the filter's options.
  cities: string[];
  // Places already in the trip, with the itinerary days they're scheduled on,
  // so results can say so instead of offering to add them twice.
  addedPlaces: AddedPlace[];
  // How many things the trip already holds per category, for the tiles.
  savedCounts: Record<PlaceCategory, number>;
}) {
  const [city, setCity] = useState(cities[0] ?? "");
  // Null means the category grid — the screen this tab opens on.
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
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
    nextCategory: PlaceCategory | null,
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
          category: nextCategory ?? undefined,
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

  function openCategory(key: PlaceCategory) {
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
      // Three columns at every width, which is what the design draws. It used
      // to be 2/3/4/6, and at xl that put six tiles in one 110px-tall row above
      // an otherwise empty screen — a toolbar, not the opening move of a tab.
      <div className="grid grid-cols-3 gap-2.5">
        {CATEGORY_KEYS.map((key, index) => {
          const meta = PLACE_CATEGORIES[key];
          const count = savedCounts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => openCategory(key)}
              // The tone tints the icon's square, not the tile.
              //
              // These tiles were filled edge to edge with one of the six
              // pastels once, and that was reverted for a good reason: six
              // saturated blocks on the opening screen of the tab, and the
              // colour said nothing. The design's answer is the middle one — a
              // white card with a tinted 40px square inside it, the same
              // treatment every domain glyph in the app already gets. The card
              // stays quiet and the row of icons stays scannable.
              className={cn(
                toneClass(toneByIndex(index)),
                "flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-3 text-center shadow-soft transition-shadow",
                "hover:border-border-strong hover:shadow-lift",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Glyph tone size="md">
                <DomainIcon name={meta.icon} className="h-5 w-5 shrink-0" />
              </Glyph>
              <span className="min-w-0 text-sm font-bold wrap-anywhere">
                {meta.label}
              </span>
              {/* Only when there is something to count. The design's tile is an
                  icon and a label; "לחיפוש" under every one of the six said the
                  same thing six times and told nobody anything. */}
              {count > 0 && (
                <span className="text-caption text-muted">{count} בטיול</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ---- One category --------------------------------------------------------
  const meta = PLACE_CATEGORIES[category];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={backToGrid}
        className="flex items-center gap-1 self-start rounded-control text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        חזרה לקטגוריות
      </button>

      <SectionHeading level="section" leading={<DomainIcon name={meta.icon} />}>
        {meta.label}
      </SectionHeading>

      {/* The destination name used to scroll away with the first result, so a
          long list of "restaurants" gave no reminder of which city they were
          in once the chip row above them was gone. Sticky and full-bleed
          (matching <main>'s own padding so the bar reaches the edges it
          scrolls under), it stays in view for as long as the results do. */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
            <MapPin
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              {near
                ? `ליד ${near.label}`
                : activeArea
                  ? `${activeArea} · ${city}`
                  : city}
            </span>
          </div>
          {near && (
            <button
              type="button"
              onClick={clearNear}
              className="flex shrink-0 items-center gap-1 rounded-control text-caption text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              חזרה לכל {city}
            </button>
          )}
        </div>
        {cities.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cities.map((option) => (
              <Chip
                key={option}
                active={option === city}
                onClick={() => {
                  setCity(option);
                  setNear(null);
                  void search(category, option, null);
                }}
              >
                {option}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search(category);
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`חיפוש בתוך ${meta.label}`}
              className="ps-9"
            />
          </div>
          <Button type="submit" loading={status.kind === "searching"}>
            חיפוש
          </Button>
        </div>

        {/* The field that makes a district searchable at all.
            The search above matches a place's *name*, so typing "Omotesando"
            into it finds nothing — no café is called Omotesando. This one is
            resolved to a point and becomes the centre of the search instead,
            so the category is looked for *inside* the district. */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
            />
            <Input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder={`אזור או שכונה ב${city} — למשל Omotesando`}
              className="ps-9"
              disabled={near !== null}
            />
          </div>
          {area.trim() && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setArea("");
                void search(category, city, near, "");
              }}
            >
              נקה
            </Button>
          )}
        </div>
      </form>

      {status.kind === "searching" && (
        <p className="text-sm text-muted">
          מחפש{" "}
          {activeArea || area.trim()
            ? `ב${area.trim() || activeArea}`
            : `ב־${city}`}
          …
        </p>
      )}

      {status.kind === "error" && (
        <Banner tone="danger">{status.message}</Banner>
      )}

      {/* Offered whenever a district is in play, not only on failure.
          OpenStreetMap and the model know different things: OSM has the real
          shops with their opening hours, the model knows what the district is
          for. Both are worth having, so the button sits beside the results
          rather than replacing them. */}
      {(area.trim() || activeArea) && status.kind !== "searching" && (
        // The one lit element on the discovery screen. OSM's results are facts
        // and look like facts — white rows on grey; this is the thing being
        // offered, and it is the only place here where the trip's own light
        // does any work. See AuraPanel for why exactly one.
        <AuraPanel>
          <span className="flex min-w-0 items-center gap-1.5 text-caption font-extrabold text-white/75">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            הצעות בשבילכם
          </span>
          <p className="min-w-0 text-title font-bold wrap-anywhere">
            מה ה-AI ממליץ ב{area.trim() || activeArea}?
          </p>
          <p className="min-w-0 text-caption text-white/75">
            OpenStreetMap יודע אילו מקומות יש ומתי הם פתוחים. את מה שהאזור עצמו
            שווה בשבילו — לא.
          </p>
          <Button
            type="button"
            variant="onLight"
            size="sm"
            onClick={() => void askAiAboutArea()}
            loading={askingAi}
            className="mt-1 self-start"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            בקשו הצעות
          </Button>
        </AuraPanel>
      )}

      {status.kind === "ai" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            המלצות ה-AI לאזור {status.area}. הן נשמרות במדריך של {city}.
          </p>
          <ul className="grid gap-2 xl:grid-cols-2">
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
        <ul className="grid gap-2 xl:grid-cols-2">
          {status.places.slice(0, visibleCount).map((place) => {
            const days = added.get(place.id);
            return (
              <li key={place.id} className={cityToneClass(tones, city)}>
                <ListRow
                  accent="tone"
                  title={
                    <button
                      type="button"
                      onClick={() => setOpen(place)}
                      className="flex min-w-0 items-center gap-2 rounded text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 truncate">{place.name}</span>
                      {place.notable && (
                        <Badge
                          tone="action"
                          title="למקום יש ערך בוויקיפדיה"
                          className="shrink-0"
                        >
                          מוכר
                        </Badge>
                      )}
                    </button>
                  }
                  subtitle={
                    [place.brand, place.cuisine, place.openingHours]
                      .filter(Boolean)
                      .join(" · ") ||
                    place.address ||
                    undefined
                  }
                  trailing={
                    days ? (
                      <Badge tone="success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {dayLabel(days)}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        onClick={() => void add(place)}
                        loading={adding === place.id}
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
      )}

      {status.kind === "results" && status.places.length > visibleCount && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="self-start"
        >
          עוד תוצאות
        </Button>
      )}

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
