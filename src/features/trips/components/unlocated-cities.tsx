"use client";

import { useState } from "react";
import { MapPinOff, Search } from "lucide-react";
import { Banner, Button, Card, Input, useToast } from "@/components/ui";
import { locateCity } from "../application/route-actions";

// The destinations the map could not place, and a way to place them.
//
// This used to be one grey sentence — "לא הצלחנו למקם על המפה: קנזאווה" — with
// nothing to do about it. That was tolerable when the geocoder guessed, because
// it rarely gave up. It stopped being tolerable once the geocoder was fixed to
// verify its answers: a name it cannot confirm now yields no pin instead of a
// confidently wrong one, which is right, but from the map it reads as the
// destination having silently disappeared.
//
// The question asked here is deliberately "what is it called in English or in
// the local script", not "enter its coordinates". "קנזאווה" is indexed by
// neither Wikipedia nor OpenStreetMap; "Kanazawa" resolves at once. The cause is
// the spelling, so the spelling is what the user is asked for — something a
// traveller can actually answer.
//
// The trip goes on calling the city whatever the user called it. Only the
// position is written.
export function UnlocatedCities({
  tripId,
  cities,
  tripName,
}: {
  tripId: string;
  cities: string[];
  tripName?: string;
}) {
  if (cities.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-callout-tint text-callout-ink"
          aria-hidden="true"
        >
          <MapPinOff className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-bold">
            {cities.length === 1
              ? "יעד אחד לא מופיע על המפה"
              : `${cities.length} יעדים לא מופיעים על המפה`}
          </h3>
          <p className="text-caption text-muted">
            לא מצאנו את השם הזה במאגרי המפות. כתבו אותו באנגלית או בשפת המקום
            ונמקם אותו — השם בטיול לא ישתנה.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {cities.map((city) => (
          <li key={city} className="min-w-0">
            <LocateRow tripId={tripId} city={city} tripName={tripName} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LocateRow({
  tripId,
  city,
  tripName,
}: {
  tripId: string;
  city: string;
  tripName?: string;
}) {
  const [value, setValue] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await locateCity(tripId, city, value, tripName);
    if (result.ok) {
      showToast(`${city} מופיע עכשיו על המפה`);
      // No local "done" state: the action revalidates the layout, so this row
      // disappears with the rest of the list on the next render. A row that
      // said "done" and stayed would be a second source of truth.
    } else {
      setError(result.message ?? "לא הצלחנו למקם. נסו שם אחר.");
    }
    setWorking(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-1.5">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <span className="min-w-0 text-sm font-semibold wrap-anywhere sm:w-32 sm:shrink-0">
          {city}
        </span>
        <Input
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          placeholder="Kanazawa"
          dir="ltr"
          className="min-w-0 flex-1 text-left"
          aria-label={`השם של ${city} באנגלית או בשפת המקום`}
          aria-invalid={error ? true : undefined}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          loading={working}
          disabled={value.trim().length < 2}
          className="shrink-0"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          מיקום
        </Button>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}
    </form>
  );
}
