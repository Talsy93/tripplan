import Image from "next/image";
import { AuraField, glassClasses } from "@/components/ui";
import { cn } from "@/lib/cn";
import { daysUntil, formatCountdown, formatShortDate } from "../domain/trip";
import { cityToneMap } from "../domain/tone";
import { dayOfTripLabel, phaseLabel } from "../domain/trip-days";
import type { TripPhase } from "../domain/trip-days";

// The band every trip screen opens with.
//
// It lives in the (tabs) layout, which is the only place in the app where one
// change reaches ten screens — today, days, explore, map, and the six screens
// under "עוד". Before it, the design direction existed on exactly one screen
// (the home hero) and every screen inside a trip looked like the version before
// the redesign, which is a fair description of "I don't see any real change".
//
// It is chrome, not a hero, and the difference is deliberate:
//
//   * it is ~11rem rather than the home hero's 22rem, because it sits above a
//     screen's actual content rather than being the content;
//   * the headline is text-display rather than text-mega for the same reason —
//     size contrast against the 12px caption is still the mechanism, one step
//     down;
//   * it carries no buttons. The actions for a trip screen belong to that
//     screen, and the sticky app bar above already holds back, share and phase.
//
// The photo is the destination's, from Wikipedia, washed in the trip's own light
// — which is what `wash` was built and measured for. This is now the only place
// in the app that shows it: the countdown card on the "today" tab used to, and
// having both meant two dark panels stacked on one screen saying the same thing.
//
// Presentational. The layout resolves the photo, the cities and the light,
// because all three need the server.
export function TripAuraBand({
  name,
  startDate,
  phase,
  dayCount,
  imageUrl,
  cities = [],
  hues = [],
}: {
  name: string;
  startDate: string | null;
  phase: TripPhase;
  dayCount: number;
  imageUrl: string | null;
  cities?: string[];
  hues?: string[];
}) {
  const days = startDate ? daysUntil(startDate) : null;
  const stops = [...cityToneMap(cities).keys()];

  // One headline per band, chosen by where the trip is in its own life. Before
  // it starts, the number of days left is the only thing anyone opens the app
  // for; during it, which day you are on; after it, the name is all that is
  // left to say.
  const counting = phase.kind === "before" && days !== null && days > 0;


  return (
    // Same full-bleed treatment as the home hero, and the negative margins have
    // to match AppShell's padding at each of its three breakpoints. The top
    // offset cancels the shell's pt-5 so the band meets the app bar.
    <div className="relative -mx-4 -mt-5 flex min-h-[11rem] flex-col overflow-hidden rounded-b-[1.75rem] bg-aura-base md:-mx-6 lg:-mx-8">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 900px"
          className="object-cover"
          priority
        />
      )}
      <AuraField hues={hues} variant={imageUrl ? "wash" : "solid"} />

      <div className="relative mt-auto flex min-w-0 flex-col gap-2 px-5 pb-5 pt-8 text-white sm:px-7 sm:pb-6">
        <span className="min-w-0 text-caption font-extrabold text-white/75">
          {phaseLabel(phase)}
          {startDate && ` · ${formatShortDate(startDate)}`}
        </span>

        {counting ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-baseline gap-2">
              <span className="text-display font-black sm:text-hero">
                {days}
              </span>
              <span className="text-sm font-semibold text-white/80">
                {days === 1 ? "יום" : "ימים"}
              </span>
            </span>
            {/* Clamped for the same reason the hero's is: a trip name is
                whatever the user typed, and a three-line one would push the
                caption out of the band. */}
            <p className="line-clamp-2 min-w-0 text-title font-bold wrap-anywhere">
              {name}
            </p>
          </div>
        ) : phase.kind === "during" ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-display font-black">
              {dayOfTripLabel(phase.dayNumber, dayCount, null)}
            </span>
            <p className="line-clamp-2 min-w-0 text-title font-bold wrap-anywhere">
              {name}
            </p>
          </div>
        ) : (
          <p className="line-clamp-2 min-w-0 text-display font-black wrap-anywhere">
            {days !== null && days === 0 ? formatCountdown(days) : name}
          </p>
        )}

        {stops.length > 0 && (
          // Glass, over the light, for the same reason as the home hero: these
          // take the colour behind them instead of punching white holes in it.
          // Three at most — this is a header, and a fourth row of chips would
          // make it taller than the content it introduces.
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 pt-0.5">
            {stops.slice(0, 3).map((city) => (
              <span
                key={city}
                className={cn(
                  glassClasses("dark"),
                  "min-w-0 max-w-full truncate rounded-full px-2.5 py-0.5 text-caption font-medium",
                )}
              >
                {city}
              </span>
            ))}
            {stops.length > 3 && (
              <span
                className={cn(
                  glassClasses("dark"),
                  "shrink-0 rounded-full px-2.5 py-0.5 text-caption font-medium text-white/70",
                )}
              >
                ועוד {stops.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
