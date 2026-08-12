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
    <div className="relative h-72 overflow-hidden rounded-tile bg-gradient-to-br from-primary to-accent shadow-card sm:h-80">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 900px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority
        />
      )}
      {/* Dark enough, everywhere, that white text survives any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-5 py-6 text-center text-white">
        <p className="font-display text-2xl drop-shadow-sm sm:text-3xl">
          {name} מחכה לנו
        </p>

        {days === null ? (
          <p className="mt-2 text-sm text-white/80">
            עוד לא נקבע תאריך יציאה
          </p>
        ) : days < 0 ? (
          <p className="mt-3 font-display text-4xl drop-shadow-sm">
            {formatCountdown(days)}
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-white/75">
              עד ההמראה · {formatShortDate(startDate!)}
            </p>
            {days === 0 ? (
              <p className="font-display text-4xl drop-shadow-sm sm:text-5xl">
                {formatCountdown(days)}
              </p>
            ) : (
              <p className="flex items-baseline gap-2 drop-shadow-sm">
                <span className="font-display text-hero leading-none">
                  {days}
                </span>
                <span className="text-lg font-semibold text-white/90">
                  {days === 1 ? "יום" : "ימים"}
                </span>
              </p>
            )}
          </>
        )}

        {tones.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
            {[...tones.keys()].map((city, i) => (
              <span
                key={city}
                className={cn("flex items-center gap-1.5", toneClass(
                  tones.get(city)!,
                ))}
              >
                {i > 0 && (
                  <span aria-hidden="true" className="text-xs text-white/60">
                    ←
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-tone-ink">
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
