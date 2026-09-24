"use client";

import { useState } from "react";
import { MapPin, MapPinOff, Search } from "lucide-react";
import { Banner, Button, Input, useToast } from "@/components/ui";
import { locatePlace } from "../application/route-actions";

export type UnlocatedPlace = {
  // The schedule entry, when the place is one — the position can then be kept
  // on the entry itself if no saved place stands behind it.
  itemId?: string;
  name: string;
  city: string | null;
};

// The day's places the map could not pin, and a way to pin each one.
//
// Asked for as: "find the location with a search for that specific place, and
// when that fails let me give an address so it shows on the map." So it is two
// steps, in that order: one press searches for the place itself inside its
// city (Wikipedia, then OpenStreetMap — free, no key); only when that finds
// nothing does the row open an address field. Asking for an address first would
// be asking the traveller to do the lookup the app can usually do alone.
//
// Nothing here calls the AI.
export function UnlocatedPlaces({
  tripId,
  places,
  tripName,
}: {
  tripId: string;
  places: UnlocatedPlace[];
  tripName?: string;
}) {
  if (places.length === 0) return null;

  return (
    <section
      aria-labelledby="unlocated-places"
      className="flex flex-col gap-3 rounded-[18px] bg-surface p-4 shadow-card"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-callout-tint text-callout-ink"
        >
          <MapPinOff className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id="unlocated-places" className="text-sm font-bold">
            {places.length === 1
              ? "מקום אחד לא מופיע במפה"
              : `${places.length} מקומות לא מופיעים במפה`}
          </h3>
          <p className="text-caption text-muted">
            נחפש כל אחד בעיר שלו. אם לא נמצא — אפשר לכתוב כתובת.
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {places.map((place) => (
          <li key={place.itemId ?? `${place.city}|${place.name}`} className="py-2.5 first:pt-0 last:pb-0">
            <PlaceRow tripId={tripId} place={place} tripName={tripName} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaceRow({
  tripId,
  place,
  tripName,
}: {
  tripId: string;
  place: UnlocatedPlace;
  tripName?: string;
}) {
  const { showToast } = useToast();
  const [working, setWorking] = useState(false);
  // Opens once the search has missed — the address is the fallback, not the
  // first question.
  const [asking, setAsking] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function locate(withAddress?: string) {
    setWorking(true);
    setError(null);
    const result = await locatePlace(
      tripId,
      {
        name: place.name,
        city: place.city,
        itemId: place.itemId,
        address: withAddress,
      },
      tripName,
    );
    setWorking(false);

    if (result.ok) {
      // The action revalidates the layout: the pin appears and this row leaves
      // the list on the next render. No "done" state of its own to go stale.
      showToast(`${place.name} מופיע עכשיו במפה`);
      return;
    }
    setError(result.message ?? "לא מצאנו.");
    setAsking(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{place.name}</span>
          {place.city && <span className="truncate text-caption text-muted">{place.city}</span>}
        </span>
        {!asking && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={working}
            onClick={() => void locate()}
            className="shrink-0"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            חיפוש מיקום
          </Button>
        )}
      </div>

      {asking && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void locate(address);
          }}
          className="flex min-w-0 flex-col gap-2"
        >
          {error && <Banner tone="info">{error}</Banner>}
          <div className="flex min-w-0 items-center gap-2">
            <Input
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              placeholder="Via dei Vascellari 29"
              dir="auto"
              className="min-w-0 flex-1"
              aria-label={`כתובת של ${place.name}`}
            />
            <Button
              type="submit"
              size="sm"
              loading={working}
              disabled={address.trim().length < 3}
              className="shrink-0"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              הצגה במפה
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
