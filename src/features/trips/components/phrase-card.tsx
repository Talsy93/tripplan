import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { speechLangFor } from "../domain/phrasebook";
import type { AiPhrasebook } from "../domain/phrasebook";
import { SpeakButton } from "./speak-button";

// Stitch's "שיחון מיידי" on the היום tab (v6): two phrases from the trip's own
// phrasebook, each with its Hebrew meaning, the local words in the
// destination's script, and a speaker. The browser's own speech voice —
// free and offline, no request anywhere.
//
// With no phrasebook yet, a link to where one is made. Never built from here:
// building one asks the AI, and that is the owner's call on its own screen.
export function PhraseCard({
  tripId,
  phrasebook,
}: {
  tripId: string;
  phrasebook: AiPhrasebook | null;
}) {
  const phrases = phrasebook?.sections.flatMap((section) => section.phrases).slice(0, 2) ?? [];
  const lang = phrasebook ? speechLangFor(phrasebook.language_english) : null;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <MessagesSquare className="h-5 w-5 text-success" aria-hidden="true" />
          <h4 className="text-base leading-[1.375rem] font-semibold text-foreground">
            שיחון {phrasebook?.language ?? "מיידי"}
          </h4>
        </div>
        <Link
          href={`/trips/${tripId}/more/phrases`}
          className="text-[0.625rem] leading-[0.875rem] font-semibold text-success hover:underline"
        >
          {phrases.length > 0 ? "לשיחון המלא" : "ליצירת שיחון"}
        </Link>
      </div>

      {phrases.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1">
          {phrases.map((phrase) => (
            <li
              key={phrase.he}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-background p-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold text-foreground">
                  &quot;{phrase.he}&quot;
                </span>
                <span className="truncate font-serif text-xs text-primary italic" dir="auto">
                  {phrase.local}
                  {phrase.pronunciation !== phrase.local && ` · ${phrase.pronunciation}`}
                </span>
              </div>
              {lang && (
                <SpeakButton text={phrase.local} lang={lang} label={`השמעת ${phrase.he}`} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">
          עוד אין שיחון לטיול הזה. אפשר ליצור אחד במסך השיחון.
        </p>
      )}
    </div>
  );
}
