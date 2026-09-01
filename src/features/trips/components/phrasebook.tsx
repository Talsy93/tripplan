"use client";

import { useMemo, useState } from "react";
import { Languages, Search, Volume2 } from "lucide-react";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeading,
} from "@/components/ui";
import { aiErrorFromResponse } from "../domain/ai-errors";
import { speechLangFor } from "../domain/phrasebook";
import type { AiPhrase, AiPhrasebook } from "../domain/phrasebook";
import { SpeakButton } from "./speak-button";

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

  // One lookup for the whole page rather than one per card. Null means the AI
  // named a language the speech table does not cover, and then no card gets a
  // speak button — see speechLangFor for why that is better than guessing.
  const speechLang = phrasebook
    ? speechLangFor(phrasebook.language_english)
    : null;

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/phrasebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (!res.ok) {
        setError(await aiErrorFromResponse(res, "בניית השיחון נכשלה. נסו שוב."));
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
      <SectionHeading
        level="page"
        description={phrasebook?.language}
        actions={
          <Button
            type="button"
            onClick={build}
            loading={building}
            size="sm"
            variant={phrasebook ? "outline" : "primary"}
          >
            {phrasebook ? "בנייה מחדש" : "בניית שיחון"}
          </Button>
        }
      >
        מילים שימושיות
      </SectionHeading>

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

      {error && <Banner tone="danger">{error}</Banner>}

      {!phrasebook && !building && !error && (
        <EmptyState
          icon={<Languages />}
          title="אין עדיין שיחון"
          description="נזהה את שפת היעד לפי הערים בטיול ונבנה שיחון בסיסי, כולל איך להגות כל ביטוי."
          action={
            <Button type="button" onClick={build} loading={building}>
              בניית שיחון
            </Button>
          }
        />
      )}

      {phrasebook && query.trim() && sections.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="אין ביטוי כזה בשיחון"
          description="נסו מילה אחרת, או בנו את השיחון מחדש כדי להרחיב אותו."
        />
      )}

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <SectionHeading level="section">{section.title}</SectionHeading>
          {/* A phrase card is short, so a wide screen fits three of them and a
              two-week phrasebook stops being a single scrolling column. */}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {section.phrases.map((phrase) => (
              <li key={`${section.title}|${phrase.he}`} className="min-w-0">
                {/* wrap-anywhere on every line here: a transliteration or a
                    local script is often one long token with nowhere to break,
                    and a single phrase used to hold the grid column open. */}
                <Card padding="sm" className="flex h-full min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold wrap-anywhere">
                    {phrase.he}
                  </span>

                  {/* The local script is set LTR-neutral with dir="auto" so a
                      language written right-to-left renders correctly too. */}
                  <span dir="auto" className="text-sm wrap-anywhere">
                    {phrase.local}
                  </span>

                  {/* The row that makes the feature usable: how to actually
                      say it, in letters the reader knows — and, where the
                      device has a voice for the language, a button that says
                      it. The speaker glyph used to sit here as decoration in
                      exactly this spot, which is why it was read as a play
                      button; it now is one.

                      Rendered only when the language resolves to a BCP-47
                      tag. See speechLangFor. */}
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-primary-ink">
                    {speechLang ? (
                      <SpeakButton
                        text={phrase.local}
                        lang={speechLang}
                        label={`השמעה של ${phrase.he}`}
                      />
                    ) : (
                      <Volume2
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 wrap-anywhere">
                      {phrase.pronunciation}
                    </span>
                  </span>

                  <span dir="ltr" className="text-caption text-muted wrap-anywhere">
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
