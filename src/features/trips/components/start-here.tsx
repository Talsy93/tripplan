import Link from "next/link";
import { ChevronLeft, Compass, MapPin, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";

// The home screen when the trip it is featuring has nowhere to go yet.
//
// The hero above this already says why it is dark — a trip with no destinations
// has no light — and asks for the one decision that fixes it. This is the two
// ways of making that decision, because "choose destinations" is not one action:
// either you know where you are going, or you want to be told.
//
// It replaces the trip list's own empty state on this screen only. That one is
// for having no trips at all and points at "create one"; this is for having a
// trip and no idea, which is a different sentence and a different button.
export function StartHere({ tripId }: { tripId: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 px-4 pb-1 pt-2 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-tile bg-surface text-action shadow-soft"
          aria-hidden="true"
        >
          <Compass className="h-8 w-8" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-title font-black">בואו נתחיל מהמקום</h2>
          {/* max-w-sm caps the measure; the text stays centred because it is two
              lines under a centred icon, which is the one place in this app
              where centring a paragraph is not fighting the reader. */}
          <p className="mx-auto max-w-sm text-sm text-muted">
            ספרו לאן בא לכם ולכמה זמן, ונציע יעדים שמתאימים. אפשר גם להוסיף ערים
            בעצמכם, אם כבר ידוע לכם לאן.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        <li className="tone-lilac">
          <StartRow
            href={`/trips/${tripId}/explore`}
            title="בקשו הצעות"
            hint="תארו מה מעניין אתכם"
            icon={<Sparkles className="h-5 w-5" />}
          />
        </li>
        <li className="tone-mint">
          <StartRow
            href={`/trips/${tripId}/explore`}
            title="הוסיפו עיר בעצמכם"
            hint="אם כבר ידוע לכם לאן"
            icon={<MapPin className="h-5 w-5" />}
          />
        </li>
      </ul>
    </section>
  );
}

function StartRow({
  href,
  title,
  hint,
  icon,
}: {
  href: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card variant="interactive" className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-tone text-tone-ink"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{title}</span>
          <span className="block min-w-0 truncate text-sm text-muted">
            {hint}
          </span>
        </span>
        {/* RTL: "forward" points left. */}
        <ChevronLeft
          className="h-5 w-5 shrink-0 text-border-strong"
          aria-hidden="true"
        />
      </Card>
    </Link>
  );
}
