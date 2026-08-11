import Image from "next/image";
import { routeSummary, type RouteStop } from "../domain/route";

// The banner at the top of the route tab: a photo of the first stop with the
// shape of the trip laid over it. Presentational — the panel resolves the
// image (free, may be null) and passes it in.
//
// Same treatment as UpcomingTripCard on the home screen, so the two hero
// images read as one idea.
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
    <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card sm:h-52">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={`תמונה של ${stops[0]?.city ?? tripName}`}
          fill
          sizes="(max-width: 1024px) 100vw, 896px"
          className="object-cover"
          priority
        />
      )}
      {/* Darken the lower half so the text stays legible over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end gap-1 p-5 text-white">
        <h2 className="text-2xl font-bold drop-shadow-sm sm:text-3xl">
          {tripName}
        </h2>
        <span className="text-sm font-medium text-white/90 drop-shadow-sm">
          {parts.join(" · ")}
        </span>
      </div>
    </div>
  );
}
