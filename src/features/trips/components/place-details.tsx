"use client";

import { useEffect, useRef } from "react";
import { googleMapsSearchUrl } from "@/lib/maps";
import type { Place } from "../domain/place";

// Details for one search result, in a modal. OSM data is uneven, so every row
// here is conditional — a place with nothing but a name still opens cleanly.
export function PlaceDetails({
  place,
  city,
  onClose,
}: {
  place: Place;
  city: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // <dialog> only becomes modal — focus trap, backdrop, Esc — when opened
  // through showModal(), which has no declarative equivalent.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const rows = [
    place.brand && { label: "רשת", value: place.brand },
    place.cuisine && { label: "מטבח", value: place.cuisine },
    place.openingHours && { label: "שעות", value: place.openingHours },
    place.address && { label: "כתובת", value: place.address },
    place.phone && { label: "טלפון", value: place.phone },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      dir="rtl"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-lg font-bold">{place.name}</h2>
            {place.localName && (
              // Worth showing: this is what's on the shopfront, and what to
              // hand a taxi driver.
              <span dir="auto" className="text-sm text-muted">
                {place.localName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="סגור"
            className="text-muted transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>

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

        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href={googleMapsSearchUrl(`${place.name} ${city}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            🗺️ פתח ב-Google Maps
          </a>
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              🔗 אתר המקום
            </a>
          )}
        </div>

        <p className="text-xs text-muted">
          המידע מ-OpenStreetMap, נתרם בידי מתנדבים — ייתכן שאינו מעודכן.
        </p>
      </div>
    </dialog>
  );
}
