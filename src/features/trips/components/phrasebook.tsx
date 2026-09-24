"use client";

import { useMemo, useState } from "react";
import { Languages, Search } from "lucide-react";
import {
  Banner,
  Button,
  EmptyState,
  Input,
  SectionHeading,
} from "@/components/ui";
import { cn } from "@/lib/cn";
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
  // The chip that is selected, by section title. Null until one is pressed,
  // which reads as "the first section".
  const [active, setActive] = useState<string | null>(null);

  const searching = query.trim().length > 0;

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

  // The section on screen when nothing is being searched. Held by title and
  // resolved against the live list, so a rebuilt phrasebook whose sections
  // are named differently falls back to its first one instead of to nothing.
  const current =
    phrasebook?.sections.find((section) => section.title === active) ??
    phrasebook?.sections[0] ??
    null;
  const shown = searching ? sections : current ? [current] : [];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        level="page"
        description={
          phrasebook
            ? speechLang
              ? `${phrasebook.language} · לחצו להשמעה`
              : phrasebook.language
            : undefined
        }
        actions={
          <Button
            type="button"
            onClick={build}
            loading={building}
            size="sm"
            variant={phrasebook ? "outline" : "primary"}
            className="rounded-full"
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
            className="pointer-events-none absolute inset-y-0 start-4 my-auto h-[1.125rem] w-[1.125rem] text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש ביטוי"
            aria-label="חיפוש בשיחון"
            className="h-12 rounded-full border-border bg-surface ps-11"
          />
        </div>
      )}

      {/* One section at a time, chosen from a row of chips — Pencil's version
          of what was an accordion. A built phrasebook is six or seven sections
          with six phrases each, forty cards in one scroll, where what you want
          is "how do I ask for the bill". The chip names are enough to choose a
          section by, and the first one is selected so the page never arrives
          empty.

          While a search is running the chips step aside: the cards on screen
          are the matches from every section, each under its section's name,
          and asking the reader to pick a chip to find out what matched would
          make the search useless. */}
      {phrasebook && !searching && phrasebook.sections.length > 1 && (
        <div
          role="group"
          aria-label="נושאים בשיחון"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {phrasebook.sections.map((section) => {
            const on = section.title === current?.title;
            return (
              <button
                key={section.title}
                type="button"
                aria-pressed={on}
                onClick={() => setActive(section.title)}
                className={cn(
                  "flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "bg-foreground text-background"
                    : "border border-border bg-surface text-foreground hover:border-border-strong",
                )}
              >
                {section.title}
              </button>
            );
          })}
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

      {phrasebook && searching && sections.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="אין ביטוי כזה בשיחון"
          description="נסו מילה אחרת, או בנו את השיחון מחדש כדי להרחיב אותו."
        />
      )}

      {shown.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          {searching && (
            <h3 className="px-1 text-sm font-semibold text-muted">
              {section.title}
            </h3>
          )}
          {/* A phrase card is short, so a wide screen fits three of them and a
              two-week phrasebook stops being a single scrolling column. */}
          <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
            {section.phrases.map((phrase) => (
              <li key={`${section.title}|${phrase.he}`} className="min-w-0">
                {/* wrap-anywhere on every line here: a transliteration or a
                    local script is often one long token with nowhere to break,
                    and a single phrase used to hold the grid column open. */}
                <div className="flex h-full min-w-0 items-center gap-3 rounded-[20px] bg-surface p-4 shadow-card">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.8125rem] text-muted wrap-anywhere">
                      {phrase.he}
                    </span>

                    {/* The local script is set LTR-neutral with dir="auto" so
                        a language written right-to-left renders correctly
                        too. */}
                    <span
                      dir="auto"
                      className="text-[1.0625rem] leading-6 font-semibold text-foreground wrap-anywhere"
                    >
                      {phrase.local}
                    </span>

                    {/* The row that makes the feature usable: how to actually
                        say it, in letters the reader knows. */}
                    <span className="text-sm text-primary wrap-anywhere">
                      {phrase.pronunciation}
                    </span>

                    <span
                      dir="ltr"
                      className="text-end text-caption text-outline wrap-anywhere"
                    >
                      {phrase.en}
                    </span>
                  </div>

                  {/* Where the device has a voice for the language, a button
                      that says it. Rendered only when the language resolves to
                      a BCP-47 tag — see speechLangFor. With none there is no
                      speaker at all: a decorative one in this spot was read as
                      a play button once already. */}
                  {speechLang && (
                    <SpeakButton
                      text={phrase.local}
                      lang={speechLang}
                      label={`השמעה של ${phrase.he}`}
                      size="lg"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
