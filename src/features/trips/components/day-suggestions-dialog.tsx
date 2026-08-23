"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Lightbulb } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Dialog,
  EmptyState,
  ListRow,
  Skeleton,
  useToast,
} from "@/components/ui";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { saveMore, setSelected } from "../application/guide-actions";
import type { AiCategoryKey, AiRecommendation } from "../domain/ai-suggestion";

// What an empty day is offered. Attractions and experiences rather than all
// four guide categories: a blank afternoon needs something to *do*, and
// "areas to stay in" is a decision made once for the whole city, not per day.
const CATEGORIES: { key: AiCategoryKey; label: string }[] = [
  { key: "attractions", label: "אטרקציות ואתרים" },
  { key: "experiences", label: "חוויות ודברים לעשות" },
];

const PER_CATEGORY = 4;

type Suggestion = AiRecommendation & { category: AiCategoryKey };

// Suggestions for one empty day, fetched when the dialog opens.
//
// Reuses /api/ai/recommendations — the same route the city guide's "more
// results" button has used since stage 8 — rather than a new endpoint: the
// question ("what else is there to do in this city") is identical, and the
// only difference is where the answer is rendered.
//
// `exclude` carries what the trip already holds in this city, so the day is
// not offered the temple it is already visiting on Tuesday.
export function DaySuggestionsDialog({
  tripId,
  city,
  dayNumber,
  alreadyInTrip,
  open,
  onClose,
}: {
  tripId: string;
  city: string;
  dayNumber: number;
  // Names already added to the trip in this city, so they are not re-offered.
  alreadyInTrip: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const { showToast } = useToast();

  // Deliberately does not reset the state it is about to fill. The dialog is
  // mounted only when it opens (the parent renders it conditionally), so the
  // initial state — no suggestions, no error — is already the loading state,
  // and clearing it here would be a synchronous setState inside the effect
  // below for no gain. `retry` does the reset, from an event handler.
  const load = useCallback(async () => {
    try {
      // The two categories are fetched together rather than in sequence: this
      // is a modal the user is watching, and two round trips to Gemini one
      // after the other is twice the wait for no benefit.
      const responses = await Promise.all(
        CATEGORIES.map(async ({ key }) => {
          const res = await fetch("/api/ai/recommendations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              city,
              category: key,
              count: PER_CATEGORY,
              exclude: alreadyInTrip,
            }),
          });
          if (!res.ok) {
            throw new Error(
              await aiErrorFromResponse(res, "קבלת ההצעות נכשלה. נסו שוב."),
            );
          }
          const data = await res.json();
          const items: AiRecommendation[] = data.recommendations ?? [];
          return items.map((item) => ({ ...item, category: key }));
        }),
      );

      const flat = responses.flat();
      setSuggestions(flat);

      // Persisted so the names survive the dialog closing — otherwise adding
      // one later would have nothing to write, since these rows do not exist
      // in the guide yet.
      for (const { key } of CATEGORIES) {
        const forCategory = flat.filter((item) => item.category === key);
        if (forCategory.length > 0) {
          await saveMore(tripId, city, key, forCategory);
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "שגיאת רשת. נסו שוב.",
      );
    }
  }, [tripId, city, alreadyInTrip]);

  // Guarded by a ref, the same shape city-guide.tsx uses for its own
  // fetch-on-mount: the request must fire exactly once per opening, and
  // without the guard a re-render that changes `load`'s identity would ask
  // Gemini again — which costs a request from a 20-per-minute budget shared
  // by the whole project.
  const hasLoaded = useRef(false);
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    void load();
  }, [load]);

  function retry() {
    setError(null);
    setSuggestions(null);
    void load();
  }

  async function add(suggestion: Suggestion) {
    setAdding(suggestion.name);
    setAdded((current) => [...current, suggestion.name]);

    await setSelected(tripId, city, suggestion.category, suggestion.name, true);
    showToast(`${suggestion.name} נוסף לטיול`);
    setAdding(null);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`רעיונות ליום ${dayNumber} ב${city}`}
    >
      {error && (
        <div className="flex flex-col items-start gap-2">
          <Banner tone="danger">{error}</Banner>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            ניסיון חוזר
          </Button>
        </div>
      )}

      {!error && suggestions === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {suggestions !== null && suggestions.length === 0 && (
        <EmptyState
          icon="🔍"
          title="לא נמצאו רעיונות חדשים"
          description="נראה שכבר הוספתם לטיול את רוב מה שיש להציע כאן."
        />
      )}

      {suggestions !== null && suggestions.length > 0 && (
        <>
          <p className="text-sm text-muted">
            מה שתוסיפו ייכנס למאגר של הטיול. בנו את הלו״ז מחדש כדי לשבץ אותו
            ליום.
          </p>
          <ul className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.category}-${suggestion.name}`}>
                <ListRow
                  title={suggestion.name}
                  subtitle={suggestion.description}
                  trailing={
                    added.includes(suggestion.name) ? (
                      <Badge tone="success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        נוסף
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        loading={adding === suggestion.name}
                        onClick={() => void add(suggestion)}
                      >
                        הוספה
                      </Button>
                    )
                  }
                />
                {suggestion.tip && (
                  <p className="flex items-start gap-1.5 px-3 pt-1 text-caption text-muted">
                    <Lightbulb
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {suggestion.tip}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
