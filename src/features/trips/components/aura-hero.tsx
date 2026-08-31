import Link from "next/link";
import { MapPin } from "lucide-react";
import { AuraField, Glass, glassClasses } from "@/components/ui";
import { cn } from "@/lib/cn";
import { daysUntil, formatCountdown, formatShortDate } from "../domain/trip";
import { cityToneMap } from "../domain/tone";

// The home screen's hero, built from the approved design rather than by adding
// light to the old card.
//
// What makes it that design and not the previous hero:
//
//   * it bleeds to the edges of the viewport and rounds only its bottom, so the
//     content sits under the chrome instead of inside a padded column;
//   * the countdown is 72px against a 12px label — hierarchy from size contrast,
//     not from a box;
//   * the cities are glass chips over the light rather than white pills, which
//     is the one place on this screen where translucency does something an
//     opaque fill cannot;
//   * the light is the trip's own, from domain/aura.ts.
//
// No photo, deliberately. The design is a field of light, and this is the screen
// it was drawn for. CountdownHero still carries the photo treatment and still
// serves the trip's own "today" tab, where a picture of the place earns its
// space.
//
// Presentational: the page resolves the cities and the light, because both need
// the server.
export function AuraHero({
  tripId,
  name,
  startDate,
  cities = [],
  hues = [],
  initial,
  className,
}: {
  tripId: string;
  name: string;
  startDate: string | null;
  cities?: string[];
  hues?: string[];
  // First letter of the signed-in address, for the identity mark. Optional
  // because the hero must render for a session it could not read.
  initial?: string;
  // For the vertical offset that cancels the container top padding. The
  // component owns bleeding to the left and right, because that is part of the
  // design; it does not own knowing what padding sits above it, because that
  // belongs to whoever placed it.
  className?: string;
}) {
  const days = startDate ? daysUntil(startDate) : null;
  // Deduped and in route order — cityToneMap already does both, and a city
  // revisited later in the trip keeps its first position.
  const stops = [...cityToneMap(cities).keys()];

  return (
    // The negative side margins undo AppShell's horizontal padding at each of
    // its three breakpoints. This is the only element in the app that reaches the
    // viewport edge, which is why it is spelled out here rather than turned into
    // a utility nobody else would use.
    //
    // min-h rather than h: 22rem is the height of the approved design, and
    // measured, a one-line trip name comes to almost exactly that. A two-line
    // name or a fourth chip may then push it taller rather than be clipped.
    // Without the floor the hero grew to 520px on a 375px screen and ate the
    // list below it.
    <div
      className={cn(
        "relative -mx-4 flex min-h-[22rem] flex-col overflow-hidden rounded-b-[1.75rem] bg-aura-base md:-mx-6 lg:-mx-8",
        className,
      )}
    >
      <AuraField hues={hues} />

      {/* min-w-0 throughout: the trip name is user-authored, and nothing above
          it may be widened by it. */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-5 px-5 pb-6 pt-7 text-white sm:px-7 sm:pb-8 sm:pt-9">
        <div className="flex min-w-0 items-center justify-between gap-3">
          {/* Tracked, and Latin only. globals.css: letter-spacing damages
              Hebrew, so the wordmark gets it and no Hebrew label does. */}
          <span className="text-caption font-extrabold tracking-latin">
            MYTRIP
          </span>
          {initial && (
            <Glass
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase"
            >
              {initial}
            </Glass>
          )}
        </div>

        {/* mt-auto, so everything below sits on the bottom edge whatever the
            height turns out to be: the identity row stays at the top and the gap
            between them absorbs the difference. */}
        <div className="mt-auto flex min-w-0 flex-col gap-4 pt-8">
          <div className="flex min-w-0 flex-col">
            {/* The departure date belongs on this line, not under the number.
                Below it, it read as an orphan: a third size on its own row,
                attached to nothing. */}
            <span className="min-w-0 text-caption font-extrabold text-white/75">
              {days !== null && days >= 0
                ? `יוצאים בעוד · ${formatShortDate(startDate!)}`
                : "הטיול הקרוב"}
            </span>

            {days === null ? null : days > 0 ? (
              // 72px against the 12px label above it. Measured at 375px: three
              // digits plus the unit come to 165px of the 303px available, so it
              // needs no breakpoint gate.
              <span className="flex items-baseline gap-2">
                <span className="text-mega font-black">{days}</span>
                <span className="text-base font-semibold text-white/80">
                  {days === 1 ? "יום" : "ימים"}
                </span>
              </span>
            ) : (
              <span className="text-display font-black sm:text-hero">
                {formatCountdown(days)}
              </span>
            )}

          </div>

          {/* Clamped to two lines: a hero is a summary, and the full name is the
              title of the page it opens. Measured at 375px, an unclamped long
              name ran to three lines and pushed the label past the top edge.

              It grows when there is no countdown, because then it is the largest
              thing on the hero rather than the caption under it. Before this, a
              dateless trip showed "עוד לא נקבע תאריך" and its own name at the
              same size, one above the other, and neither read as the title. */}
          <p
            className={cn(
              "line-clamp-2 min-w-0 font-bold wrap-anywhere",
              days === null ? "text-display" : "text-heading",
            )}
          >
            {name}
          </p>

          {days === null && (
            <span className="text-caption text-white/70">
              עוד לא נקבע תאריך יציאה
            </span>
          )}

          {stops.length > 0 && (
            // Glass rather than the white pills of the old hero: these sit over
            // the light, so translucency lets them take its colour instead of
            // punching holes in it.
            //
            // A chip cannot break a city name that is one long token, so each is
            // capped and truncates. The full name is on the map and in the
            // itinerary.
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
              {stops.slice(0, 3).map((city) => (
                <span
                  key={city}
                  className={cn(
                    glassClasses("dark"),
                    "min-w-0 max-w-full truncate rounded-full px-3 py-1 text-caption font-medium",
                  )}
                >
                  {city}
                </span>
              ))}
              {stops.length > 3 && (
                <span
                  className={cn(
                    glassClasses("dark"),
                    "shrink-0 rounded-full px-3 py-1 text-caption font-medium text-white/70",
                  )}
                >
                  {/* Words, not "+3": in an RTL paragraph the browser puts the
                      sign after the digit, so "+3" rendered as "3+". */}
                  ועוד {stops.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex min-w-0 items-stretch gap-2 pt-1">
            <Link
              href={`/trips/${tripId}`}
              className="flex min-w-0 flex-1 items-center justify-center rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-foreground shadow-lift transition-transform duration-200 ease-spring hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base"
            >
              פתח את הטיול
            </Link>
            <Link
              href={`/trips/${tripId}/map`}
              aria-label={`המפה של ${name}`}
              className={cn(
                glassClasses("dark"),
                "flex w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 ease-spring hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-aura-base",
              )}
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
