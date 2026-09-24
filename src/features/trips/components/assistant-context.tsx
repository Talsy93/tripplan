import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpLeft, Bookmark, CalendarDays, MapPin } from "lucide-react";
import { tripDayCount } from "../domain/trip-days";

// The AI tab's pane on a tablet and a desktop (Pencil PN18, "מה העוזר יודע"):
// what the assistant already knows about this trip, and a few questions worth
// asking it. Beside the conversation, never instead of it — below @4xl the
// pane stacks under the thread, where it is one more thing to scroll past, so
// TwoPane only draws it from there.
//
// The questions are links to `?q=`, which the page puts in the composer as a
// draft. Pressing one never sends anything: the model is only called when the
// traveller presses send, the same as when they type.
export function AssistantContext({
  tripId,
  startDate,
  endDate,
  cities,
  savedCount,
}: {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  cities: string[];
  savedCount: number;
}) {
  const days = tripDayCount(startDate, endDate);
  const facts: { Icon: LucideIcon; title: string; detail: string }[] = [
    {
      Icon: CalendarDays,
      title: days ? `${days} ימים` : "עוד בלי תאריכים",
      detail: startDate && endDate ? `${shortDate(startDate)}–${shortDate(endDate)}` : "אפשר לשאול גם בלי",
    },
    {
      Icon: MapPin,
      title: cities.length > 0 ? cities.slice(0, 3).join(" · ") : "עוד בלי ערים",
      detail: cities.length > 3 ? `ועוד ${cities.length - 3}` : "הערים שבחרתם",
    },
    {
      Icon: Bookmark,
      title: savedCount === 1 ? "מקום אחד שמור" : `${savedCount} מקומות שמורים`,
      detail: "העוזר מציע בהתאם",
    },
  ];

  const first = cities[0] ?? null;
  const questions = [
    first ? `מה לעשות ביום ריק ב${first}?` : "מה כדאי לראות ביום הראשון?",
    "איך מגיעים מהשדה למלון?",
    first ? `מסעדה טובה ב${first} בלי תורים` : "מסעדה טובה בלי תורים",
    "מה לא לפספס בטיול הזה?",
  ];

  return (
    <div className="hidden flex-col gap-5 @4xl:flex">
      <section aria-labelledby="assistant-knows" className="flex flex-col gap-3">
        <h2 id="assistant-knows" className="text-lg font-bold leading-6">
          מה העוזר יודע על הטיול
        </h2>
        <ul className="flex flex-col rounded-[18px] bg-surface px-4 shadow-card">
          {facts.map(({ Icon, title, detail }) => (
            <li
              key={title}
              className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{title}</span>
                <span className="truncate text-caption text-muted">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="assistant-ask" className="flex flex-col gap-2">
        <h2 id="assistant-ask" className="text-base font-bold leading-6">
          אפשר לשאול
        </h2>
        {questions.map((question) => (
          <Link
            key={question}
            href={`/trips/${tripId}/ai?q=${encodeURIComponent(question)}`}
            className="flex min-h-11 items-center gap-2.5 rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">{question}</span>
            <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        ))}
      </section>
    </div>
  );
}

// "11.4" — a calendar date, so formatted in UTC: in the browser's zone it could
// print as the day before.
function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}
