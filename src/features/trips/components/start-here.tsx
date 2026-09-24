import Link from "next/link";
import { ChevronLeft, Compass, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

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
//
// Styled as the Pencil empty home (design/pencil/exports/home-empty): an icon
// disc, a bold line, and white rows with a tinted icon tile each.
export function StartHere({ tripId }: { tripId: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 px-4 pb-1 pt-2 text-center">
        <span
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-tint text-primary"
          aria-hidden="true"
        >
          <Compass className="h-8 w-8" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[22px] font-bold leading-tight">בואו נתחיל מהמקום</h2>
          {/* max-w-sm caps the measure; the text stays centred because it is two
              lines under a centred icon, which is the one place in this app
              where centring a paragraph is not fighting the reader. */}
          <p className="mx-auto max-w-sm text-sm text-muted">
            ספרו לאן בא לכם ולכמה זמן, ונציע יעדים שמתאימים. אפשר גם להוסיף ערים
            בעצמכם, אם כבר ידוע לכם לאן.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        <li>
          <StartRow
            href={`/trips/${tripId}/explore`}
            title="בקשו הצעות"
            hint="תארו מה מעניין אתכם"
            tile="bg-cat-hidden-tint text-cat-hidden-ink"
            icon={<Sparkles className="h-5 w-5" />}
          />
        </li>
        <li>
          <StartRow
            href={`/trips/${tripId}/explore`}
            title="הוסיפו עיר בעצמכם"
            hint="אם כבר ידוע לכם לאן"
            tile="bg-cat-nature-tint text-cat-nature-ink"
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
  tile,
  icon,
}: {
  href: string;
  title: string;
  hint: string;
  tile: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-[18px] bg-surface p-4 shadow-card transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]",
          tile,
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="block min-w-0 truncate text-[13px] text-muted">{hint}</span>
      </span>
      {/* RTL: "forward" points left. */}
      <ChevronLeft className="h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
    </Link>
  );
}
