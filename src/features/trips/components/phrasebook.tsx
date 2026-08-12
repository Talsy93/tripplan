"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import type { AiPhrase, AiPhrasebook } from "../domain/phrasebook";

// Matches across all four fields. Someone reaching for a phrase might remember
// the Hebrew, the English, or how it sounded — the pronunciation row is
// searchable for the same reason it exists.
function matches(phrase: AiPhrase, needle: string) {
  return [phrase.he, phrase.en, phrase.local, phrase.pronunciation]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function Phrasebook({
  tripId,
  initialPhrasebook,
}: {
  tripId: string;
  initialPhrasebook: AiPhrasebook | null;
}) {
  const [phrasebook, setPhrasebook] = useState(initialPhrasebook);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Sections with no surviving phrase drop out entirely, so a search never
  // leaves a heading standing over nothing.
  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!phrasebook) return [];
    if (!needle) return phrasebook.sections;

    return phrasebook.sections
      .map((section) => ({
        ...section,
        phrases: section.phrases.filter((phrase) => matches(phrase, needle)),
      }))
      .filter((section) => section.phrases.length > 0);
  }, [phrasebook, query]);

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/phrasebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (res.status === 429) {
        setError("יותר מדי בקשות. נסו שוב בעוד רגע.");
        return;
      }
      if (!res.ok) {
        setError("בניית השיחון נכשלה. נסו שוב.");
        return;
      }
      setPhrasebook((await res.json()) as AiPhrasebook);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg">
          מילים שימושיות
          {phrasebook && (
            <span className="ms-2 text-sm font-normal text-muted">
              {phrasebook.language}
            </span>
          )}
        </h2>
        <Button
          type="button"
          onClick={build}
          loading={building}
          size="sm"
          variant={phrasebook ? "outline" : "primary"}
          className="ms-auto"
        >
          {phrasebook ? "בנה מחדש" : "בנה שיחון"}
        </Button>
      </div>

      {phrasebook && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש ביטוי…"
            aria-label="חיפוש בשיחון"
            className="ps-9"
          />
        </div>
      )}

      {error && <p className="text-sm text-danger-ink">{error}</p>}

      {!phrasebook && !building && !error && (
        <p className="text-sm text-muted">
          נזהה את שפת היעד לפי הערים בטיול ונבנה שיחון בסיסי, כולל איך להגות כל
          ביטוי.
        </p>
      )}

      {phrasebook && query.trim() && sections.length === 0 && (
        <EmptyState
          icon="🔍"
          title="אין ביטוי כזה בשיחון"
          description="נסו מילה אחרת, או בנו את השיחון מחדש כדי להרחיב אותו."
        />
      )}

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h3 className="font-bold">{section.title}</h3>
          <ul className="flex flex-col gap-2">
            {section.phrases.map((phrase) => (
              <li key={`${section.title}|${phrase.he}`}>
                <Card className="flex flex-col gap-1 p-3">
                  <span className="font-semibold">{phrase.he}</span>

                  {/* The local script is set LTR-neutral with dir="auto" so a
                      language written right-to-left renders correctly too. */}
                  <span dir="auto" className="text-sm">
                    {phrase.local}
                  </span>

                  {/* The row that makes the feature usable: how to actually
                      say it, in letters the reader knows. */}
                  <span className="text-sm font-medium text-primary">
                    🗣️ {phrase.pronunciation}
                  </span>

                  <span dir="ltr" className="text-xs text-muted">
                    {phrase.en}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
