import Image from "next/image";
import { routeSummary, type RouteStop } from "../domain/route";

// The banner at the top of the route tab: a photo of the first stop with the
// shape of the trip laid over it. Presentational — the panel resolves the
// image (free, may be null) and passes it in.
//
// Same treatment as CountdownHero on the home screen, so the two hero images
// read as one idea. Phase D made that true rather than aspirational: the two
// used to disagree on their radius (rounded-2xl here, rounded-tile there) and
// on their scrim stops, both of which are tokens now.
export function RouteHero({
  tripName,
  stops,
  imageUrl,
}: {
  tripName: string;
  stops: RouteStop[];
  imageUrl: string | null;
}) {
  const { stopCount, dayCount, nights } = routeSummary(stops);

  const parts = [
    stopCount === 1 ? "תחנה אחת" : `${stopCount} תחנות`,
    dayCount > 0 && (dayCount === 1 ? "יום אחד" : `${dayCount} ימים`),
    nights > 0 && (nights === 1 ? "לילה אחד" : `${nights} לילות`),
  ].filter(Boolean);

  return (
    <div className="relative h-40 overflow-hidden rounded-tile bg-brand sm:h-48 lg:h-56">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={`תמונה של ${stops[0]?.city ?? tripName}`}
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover"
          priority
        />
      )}
      {/* Darken the lower half so the text stays legible over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-scrim-strong via-scrim-soft to-transparent" />

      {/* min-w-0 on the overlay and wrap-anywhere on the name: this is the trip
          name as the user typed it, and a single long token used to push the
          whole hero wider than the screen. The overlay is absolutely positioned,
          so nothing above it could absorb that. */}
      <div className="absolute inset-0 flex min-w-0 flex-col justify-end gap-1 p-5 text-white">
        <h2 className="min-w-0 text-title font-bold wrap-anywhere sm:text-heading">
          {tripName}
        </h2>
        <span className="text-sm font-semibold text-white/90">
          {parts.join(" · ")}
        </span>
      </div>
    </div>
  );
}
