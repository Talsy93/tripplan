"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";
import { setSelected } from "../application/guide-actions";
import { categoryLabel } from "../domain/place";
import { cityToneMap, toneClass } from "../domain/tone";
import type { SelectedItem } from "../domain/ai-suggestion";

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
      <p className="text-sm text-muted">
        עדיין לא הוספתם פריטים. היכנסו לעיר והוסיפו המלצות לטיול.
      </p>
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
    <div className="flex flex-col gap-4">
      {[...byCity.entries()].map(([city, list]) => (
        <div
          key={city}
          className={`flex flex-col gap-2 ${toneClass(tones.get(city)!)}`}
        >
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-tone-dot" />
            {city}
          </h3>
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <li key={keyOf(item)}>
                <Card className="flex items-center justify-between gap-3 border-s-4 border-s-tone-dot p-3">
                  <span>{item.name}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">
                      {categoryLabel(item.category)}
                    </span>
                    <a
                      href={googleMapsSearchUrl(`${item.name} ${item.city}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="פתח ב-Google Maps"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      🗺️
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label="הסר מהטיול"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
