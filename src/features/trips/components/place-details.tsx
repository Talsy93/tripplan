"use client";

import { ExternalLink, Map as MapIcon } from "lucide-react";
import { Dialog } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
import type { Place } from "../domain/place";

// Details for one search result, in a modal. OSM data is uneven, so every row
// here is conditional — a place with nothing but a name still opens cleanly.
//
// The <dialog> mechanics (showModal, the cancel event, backdrop clicks landing
// on the dialog element) moved into the Dialog primitive in phase D. They were
// correct here; they were just correct in exactly one place.
export function PlaceDetails({
  place,
  city,
  onClose,
}: {
  place: Place;
  city: string;
  onClose: () => void;
}) {
  const rows = [
    place.brand && { label: "רשת", value: place.brand },
    place.cuisine && { label: "מטבח", value: place.cuisine },
    place.openingHours && { label: "שעות", value: place.openingHours },
    place.address && { label: "כתובת", value: place.address },
    place.phone && { label: "טלפון", value: place.phone },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <span className="flex flex-col">
          {place.name}
          {place.localName && (
            // Worth showing: this is what's on the shopfront, and what to
            // hand a taxi driver.
            <span dir="auto" className="text-sm font-normal text-muted">
              {place.localName}
            </span>
          )}
        </span>
      }
    >
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">{row.label}</dt>
              <dd className="min-w-0 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">
          אין פרטים נוספים על המקום הזה ב-OpenStreetMap.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href={googleMapsSearchUrl(`${place.name} ${city}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-semibold text-primary-ink hover:underline"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          פתיחה ב-Google Maps
        </a>
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-semibold text-primary-ink hover:underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            אתר המקום
          </a>
        )}
      </div>

      <p className="text-caption text-muted">
        המידע מ-OpenStreetMap, נתרם בידי מתנדבים — ייתכן שאינו מעודכן.
      </p>
    </Dialog>
  );
}
