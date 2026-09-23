import Link from "next/link";
import { MessageCircle, Sparkles, Wand2 } from "lucide-react";

// The top of "עוזר AI" (v6): Stitch's "MyTrip AI Concierge" card — the one
// lit surface on the screen, the maritime gradient with a glyph in a frosted
// circle and a row of quick chips under the title.
//
// The chips are the two ways into the AI this app actually has: the free chat
// (/more/chat) and the destination discovery further down this screen. No
// chip here calls the model — they are links; the model is only reached from
// the screens they open, with the same buttons as before.
export function AiConcierge({ tripId }: { tripId: string }) {
  return (
    <section
      aria-label="העוזר החכם"
      className="relative isolate overflow-hidden rounded-card bg-[image:var(--hero-gradient)] p-4 text-white shadow-lift sm:p-5"
    >
      <Sparkles
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -start-6 -z-10 h-40 w-40 text-white/10"
      />
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-md"
        >
          <Sparkles className="h-6 w-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-300"
              aria-hidden="true"
            />
            העוזר החכם של הטיול
          </h1>
          <p className="text-sm text-white/80">
            הצעות יעדים, בניית ימים ושיחה חופשית — הכול במקום אחד
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`/trips/${tripId}/more/chat`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          שיחה עם העוזר
        </Link>
        <a
          href="#discover"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          גילוי יעדים
        </a>
      </div>
    </section>
  );
}
