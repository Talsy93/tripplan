import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { daysUntil, formatCountdown, formatShortDate } from "../domain/trip";
import { cityToneMap, toneClass } from "../domain/tone";

// The countdown, as the loudest thing on the screen.
//
// Presentational: the page resolves the photo (free, may be null) and the route
// cities, because both need the server.
export function CountdownHero({
  tripId,
  name,
  startDate,
  imageUrl,
  cities = [],
  href,
}: {
  tripId: string;
  name: string;
  startDate: string | null;
  imageUrl: string | null;
  cities?: string[];
  // Omitted when the hero already sits on the trip's own page.
  href?: string;
}) {
  const days = startDate ? daysUntil(startDate) : null;
  const tones = cityToneMap(cities);

  const body = (
    <div className="relative h-64 overflow-hidden rounded-tile bg-brand sm:h-72 lg:h-80">
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
      {/* Dark enough, everywhere, that white text survives any photo. Tokens
          rather than from-black/80: raw black is what would break a dark theme,
          and the two heroes in the app used to disagree on their stops. */}
      <div className="absolute inset-0 bg-gradient-to-t from-scrim-strong via-scrim to-scrim-soft" />

      <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 p-5 text-white sm:p-6">
        {days !== null && days >= 0 && (
          <p className="text-caption font-semibold text-white/85">
            עד ההמראה · {formatShortDate(startDate!)}
          </p>
        )}

        {days === null ? (
          <>
            <p className="text-title font-bold sm:text-heading">{name}</p>
            <p className="text-sm text-white/85">עוד לא נקבע תאריך יציאה</p>
          </>
        ) : (
          <>
            {days > 0 ? (
              <p className="flex items-baseline gap-2">
                <span className="text-display font-bold leading-none sm:text-hero">
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
            <p className="text-title font-bold">{name}</p>
          </>
        )}

        {tones.size > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {[...tones.keys()].map((city, i) => (
              <span
                key={city}
                className={cn(
                  "flex items-center gap-1.5",
                  toneClass(tones.get(city)!),
                )}
              >
                {i > 0 && (
                  <span aria-hidden="true" className="text-caption text-white/60">
                    ←
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-foreground">
                  <span className="h-2 w-2 rounded-full bg-tone-dot" />
                  {city}
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
