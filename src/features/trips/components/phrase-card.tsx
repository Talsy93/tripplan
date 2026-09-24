"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Languages } from "lucide-react";
import { Dialog } from "@/components/ui";
import { speechLangFor } from "../domain/phrasebook";
import type { AiPhrasebook } from "../domain/phrasebook";
import { SpeakButton } from "./speak-button";
import { toolTileClasses, ToolTileBody } from "./tool-tile";

// The phrasebook on the היום tab: phrases from the trip's own phrasebook, each
// with its Hebrew meaning, the local words in the destination's script, and a
// speaker. The browser's own speech voice — free and offline, no request
// anywhere.
//
// With no phrasebook yet, a link to where one is made. Never built from here:
// building one asks the AI, and that is the owner's call on its own screen.
//
// A client component since the tile (Pencil, v7) opens a sheet; the phrasebook
// is plain stored data, so passing it across costs nothing.

function phrasesOf(phrasebook: AiPhrasebook | null, count: number) {
  return phrasebook?.sections.flatMap((section) => section.phrases).slice(0, count) ?? [];
}

// Pencil's "שיחון" tile: the first phrase in the local language as the value
// ("Grazie"), and a sheet with the handful worth having on the street.
export function PhraseTile({
  tripId,
  phrasebook,
}: {
  tripId: string;
  phrasebook: AiPhrasebook | null;
}) {
  const [open, setOpen] = useState(false);
  const phrases = phrasesOf(phrasebook, 6);
  const first = phrases[0] ?? null;

  if (!phrasebook || !first) {
    return (
      <Link href={`/trips/${tripId}/more/phrases`} className={toolTileClasses}>
        <ToolTileBody icon={<Languages />} value="ליצירה" label="שיחון" />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`שיחון ${phrasebook.language}`}
        className={toolTileClasses}
      >
        <ToolTileBody
          icon={<Languages />}
          value={first.local}
          valueDir="auto"
          label="שיחון"
        />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          <>
            <span className="block">שיחון {phrasebook.language}</span>
            <span className="mt-0.5 block text-sm leading-5 font-normal text-muted">
              לחיצה על הרמקול משמיעה את המשפט
            </span>
          </>
        }
      >
        <PhraseRows phrasebook={phrasebook} count={6} />
        <Link
          href={`/trips/${tripId}/more/phrases`}
          className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-border text-sm font-semibold text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          לשיחון המלא
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Dialog>
    </>
  );
}

function PhraseRows({
  phrasebook,
  count,
}: {
  phrasebook: AiPhrasebook;
  count: number;
}) {
  const phrases = phrasesOf(phrasebook, count);
  const lang = speechLangFor(phrasebook.language_english);

  return (
    <ul className="flex flex-col">
      {phrases.map((phrase) => (
        <li
          key={phrase.he}
          className="flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base leading-6 font-semibold text-foreground" dir="auto">
              {phrase.local}
            </span>
            <span className="truncate text-xs text-muted">
              {phrase.he}
              {phrase.pronunciation !== phrase.local && (
                <span dir="auto"> · {phrase.pronunciation}</span>
              )}
            </span>
          </div>
          {lang && (
            <SpeakButton text={phrase.local} lang={lang} label={`השמעת ${phrase.he}`} />
          )}
        </li>
      ))}
    </ul>
  );
}

// The phrasebook open on the page rather than behind a tile: two phrases and a
// link to the rest. The day screen now uses the tile; this stays for layouts
// that want the phrases in view.
export function PhraseCard({
  tripId,
  phrasebook,
}: {
  tripId: string;
  phrasebook: AiPhrasebook | null;
}) {
  const hasPhrases = phrasesOf(phrasebook, 1).length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[1.25rem] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary"
          >
            <Languages className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <h4 className="text-base leading-6 font-bold text-foreground">
            שיחון {phrasebook?.language ?? ""}
          </h4>
        </div>
        <Link
          href={`/trips/${tripId}/more/phrases`}
          className="flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {hasPhrases ? "לשיחון המלא" : "ליצירת שיחון"}
        </Link>
      </div>

      {phrasebook && hasPhrases ? (
        <PhraseRows phrasebook={phrasebook} count={2} />
      ) : (
        <p className="text-sm text-muted">
          עוד אין שיחון לטיול הזה. אפשר ליצור אחד במסך השיחון.
        </p>
      )}
    </div>
  );
}
