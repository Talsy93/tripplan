import Image from "next/image";
import Link from "next/link";
import { AuraField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { daysUntil, formatCountdown, formatShortDate } from "../domain/trip";
import { cityToneMap, toneClass } from "../domain/tone";

// The countdown, as the loudest thing on the screen.
//
// Presentational: the page resolves the photo (free, may be null), the route
// cities and the trip's light, because all three need the server.
export function CountdownHero({
  tripId,
  name,
  startDate,
  imageUrl,
  cities = [],
  // The trip's light, from domain/aura.ts. Empty for a trip with no
  // destinations chosen yet, which renders as the bare deep base — a trip has
  // no light until it has somewhere to go.
  hues = [],
  href,
}: {
  tripId: string;
  name: string;
  startDate: string | null;
  imageUrl: string | null;
  cities?: string[];
  hues?: string[];
  // Omitted when the hero already sits on the trip's own page.
  href?: string;
}) {
  const days = startDate ? daysUntil(startDate) : null;
  const tones = cityToneMap(cities);

  const body = (
    <div className="relative h-72 overflow-hidden rounded-tile bg-aura-base lg:h-80">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 900px"
          className="object-cover transition-transform duration-500 ease-snap group-hover:scale-105"
          priority
        />
      )}

      {/* This used to be from-scrim-strong via-scrim to-scrim-soft — a neutral
          dark wash, which meant every trip's hero was the same colour whatever
          it was a trip to. The aura does the same job (white text has to survive
          any photo underneath) while carrying light of this trip's own, from the
          deep counterparts of the same six-hue palette the cities use. Which hue
          goes where is decided differently — see domain/aura.ts for why a trip
          cannot borrow the city rule.

          Two variants because there are two cases and one set of values cannot
          serve both — `wash` keeps the photo visible above the text, `solid`
          paints the whole box when there is no photo. Still tokens, not raw
          black, for the reason the old comment gave: raw black is what breaks a
          dark theme. */}
      <AuraField hues={hues} variant={imageUrl ? "wash" : "solid"} />

      {/* Same reasoning as RouteHero: user-authored names sit here over a
          photo, and the overlay cannot be widened by anything above it. */}
      <div className="absolute inset-0 flex min-w-0 flex-col items-start justify-end gap-2 p-5 text-white sm:p-6">
        {days !== null && days >= 0 && (
          <p className="text-caption font-semibold text-white/85">
            עד ההמראה · {formatShortDate(startDate!)}
          </p>
        )}

        {days === null ? (
          <>
            <p className="min-w-0 text-title font-bold wrap-anywhere sm:text-heading">
              {name}
            </p>
            <p className="text-sm text-white/85">עוד לא נקבע תאריך יציאה</p>
          </>
        ) : (
          <>
            {days > 0 ? (
              // Size contrast is the hierarchy here: the number is four steps
              // up the ramp from its own unit. text-mega is 72px and exists for
              // this one place, at every width — an sm: gate left phones on 48px,
              // which is the one screen where the contrast had to land.
              //
              // Width is not the constraint: measured at 375px, three digits plus
              // the unit come to 165px in the 303px available. Height was — the
              // extra 24px of number is why the box is h-72 rather than h-64.
              <p className="flex items-baseline gap-2">
                <span className="text-mega font-black">
                  {days}
                </span>
                <span className="text-base font-semibold text-white/90">
                  {days === 1 ? "יום" : "ימים"}
                </span>
              </p>
            ) : (
              <p className="text-display font-bold sm:text-hero">
                {formatCountdown(days)}
              </p>
            )}
            {/* Clamped: measured at 375px, the longest fixture name ran to three
                lines and pushed "עד ההמראה" 12px past the top edge. A hero is a
                summary — the full name is the page title behind it. */}
            <p className="line-clamp-2 min-w-0 text-title font-bold wrap-anywhere">
              {name}
            </p>
          </>
        )}

        {tones.size > 0 && (
          // `flex-wrap` moves whole chips onto the next line but cannot break
          // one that is wider than the row on its own — and a city name here is
          // whatever the user or the AI called the place. So the chip itself is
          // capped and its label truncates. Truncation rather than wrapping is
          // right for a chip specifically: it is a compact marker in a row of
          // markers, and one grown to three lines would break the rhythm the
          // colour coding depends on. The full name is on the map and in the
          // itinerary.
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-2">
            {[...tones.keys()].map((city, i) => (
              <span
                key={city}
                className={cn(
                  "flex min-w-0 max-w-full items-center gap-1.5",
                  toneClass(tones.get(city)!),
                )}
              >
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-caption text-white/60"
                  >
                    ←
                  </span>
                )}
                <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-tone-dot" />
                  <span className="min-w-0 truncate">{city}</span>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      aria-label={`פתיחת הטיול ${name}`}
      className="group block rounded-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      key={tripId}
    >
      {body}
    </Link>
  );
}
