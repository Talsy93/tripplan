"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { AiPhrasebook } from "../domain/phrasebook";

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
        <h2 className="text-lg font-bold">
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
          disabled={building}
          size="sm"
          className="ms-auto"
        >
          {building ? "בונה…" : phrasebook ? "בנה מחדש" : "בנה שיחון"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!phrasebook && !building && !error && (
        <p className="text-sm text-muted">
          נזהה את שפת היעד לפי הערים בטיול ונבנה שיחון בסיסי, כולל איך להגות כל
          ביטוי.
        </p>
      )}

      {phrasebook?.sections.map((section) => (
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
