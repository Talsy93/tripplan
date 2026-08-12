import Image from "next/image";
import Link from "next/link";
import { daysUntil, formatCountdown, type Trip } from "../domain/trip";

// The hero "next trip" card for the home screen: a photo of the destination
// with the countdown to departure laid over it. Presentational — the page
// resolves the image (free, may be null) and passes it in.
export function UpcomingTripCard({
  trip,
  imageUrl,
}: {
  trip: Trip;
  imageUrl: string | null;
}) {
  const days = trip.start_date ? daysUntil(trip.start_date) : 0;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
    >
      <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card sm:h-64">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={`תמונה של ${trip.name}`}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority
          />
        )}
        {/* Darken the lower half so the text stays legible over any photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end gap-1 p-5 text-white">
          <span className="text-sm font-medium text-white/80">הטיול הקרוב</span>
          <h2 className="font-display text-2xl drop-shadow-sm sm:text-3xl">
            {trip.name}
          </h2>
          <span className="text-lg font-semibold drop-shadow-sm">
            {formatCountdown(days)}
          </span>
        </div>
      </div>
    </Link>
  );
}
