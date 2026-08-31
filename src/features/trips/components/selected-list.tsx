"use client";

import { useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import {
  EmptyState,
  IconButton,
  iconButtonClasses,
  ListRow,
  SectionHeading,
  ToneDot,
} from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
import { setSelected } from "../application/guide-actions";
import { categoryLabel } from "../domain/place";
import { cityToneMap, toneClass } from "../domain/tone";
import type { SelectedItem } from "../domain/ai-suggestion";
import { MapPin } from "lucide-react";

function keyOf(item: SelectedItem) {
  return `${item.city}|${item.category}|${item.name}`;
}

export function SelectedList({
  tripId,
  items: initialItems,
}: {
  tripId: string;
  items: SelectedItem[];
}) {
  const [items, setItems] = useState<SelectedItem[]>(initialItems);

  function remove(item: SelectedItem) {
    setItems((prev) => prev.filter((it) => keyOf(it) !== keyOf(item)));
    void setSelected(tripId, item.city, item.category, item.name, false);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="עדיין לא הוספתם פריטים"
        description="חפשו מקום למעלה, או היכנסו לעיר מתוך ״גילוי יעדים״ והוסיפו המלצות לטיול."
      />
    );
  }

  const byCity = new Map<string, SelectedItem[]>();
  for (const item of items) {
    const list = byCity.get(item.city) ?? [];
    list.push(item);
    byCity.set(item.city, list);
  }

  // Cities are coloured in the order they appear here, which is the order the
  // user added them — the same ordering the hero falls back to.
  const tones = cityToneMap([...byCity.keys()]);

  return (
    // Cities side by side once there is room. A single column of full-width
    // rows was the whole screen at every width before phase D.
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      {[...byCity.entries()].map(([city, list]) => (
        // A grid track is minmax(auto, 1fr), and that auto floors the column at
        // the min-content of its item. Without min-w-0 here, one long place
        // name in the list below held the column open past the phone's width.
        <div
          key={city}
          className={`flex min-w-0 flex-col gap-2 ${toneClass(tones.get(city)!)}`}
        >
          <SectionHeading level="sub" leading={<ToneDot />}>
            {city}
            <span className="font-normal text-muted"> · {list.length}</span>
          </SectionHeading>

          <ul className="flex min-w-0 flex-col gap-2">
            {list.map((item) => (
              <li key={keyOf(item)} className="min-w-0">
                <ListRow
                  accent="tone"
                  title={item.name}
                  // One truncated line of context under the name. For a
                  // hand-typed place this is the address that was entered —
                  // without it the address would be stored and never shown.
                  // For a guide item it's the start of the AI's description.
                  // Truncated rather than wrapped so a long description can't
                  // turn the list into paragraphs.
                  subtitle={
                    item.description ?? categoryLabel(item.category)
                  }
                  trailing={
                    <>
                      <a
                        href={googleMapsSearchUrl(`${item.name} ${item.city}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="פתיחה ב-Google Maps"
                        title="Google Maps"
                        className={iconButtonClasses("ghost", "sm")}
                      >
                        <MapIcon className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <IconButton
                        label="הסרה מהטיול"
                        size="sm"
                        variant="danger"
                        onClick={() => remove(item)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
