"use client";

import { useState } from "react";
import { Check, Plus, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addMoreCities } from "../application/guide-actions";

// The chips under "ערים פופולריות ב<מדינה>". A press adds the city to the
// trip's cities (the same list the AI's suggestions go to), and the page
// re-renders with it: its guide one press away, and the search able to look
// there. Added chips stay, ticked, until the server's list replaces this one.
export function PopularCityChips({
  tripId,
  country,
  cities,
}: {
  tripId: string;
  country: string;
  cities: string[];
}) {
  const { showToast } = useToast();
  const [added, setAdded] = useState<string[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  async function add(city: string) {
    setWorking(city);
    await addMoreCities(tripId, [
      { name: city, description: `עיר ב${country}` },
    ]);
    setWorking(null);
    // An empty answer is a city the trip already had — it is in either way.
    setAdded((current) => [...current, city]);
    showToast(`${city} נוספה לטיול`);
  }

  return (
    <section
      aria-labelledby="popular-cities"
      className="flex min-w-0 flex-col gap-3 rounded-[22px] bg-primary-tint p-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <h2 id="popular-cities" className="min-w-0 text-base font-bold leading-6 text-primary-ink">
          ערים פופולריות ב{country}
        </h2>
      </div>
      <p className="-mt-1 text-sm text-primary-ink/80">
        בחרו מאיפה להתחיל — אפשר להוסיף עוד ולהוריד אחר כך.
      </p>
      <ul className="flex flex-wrap gap-2">
        {cities.map((city) => {
          const isAdded = added.includes(city);
          return (
            <li key={city}>
              <button
                type="button"
                onClick={() => void add(city)}
                disabled={isAdded || working !== null}
                aria-pressed={isAdded}
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isAdded
                    ? "bg-success text-white"
                    : "bg-surface text-primary-ink hover:bg-surface-2",
                  working === city && "opacity-60",
                )}
              >
                {isAdded ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {city}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
