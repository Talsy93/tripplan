"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { setSelected } from "../application/guide-actions";
import type { SelectedItem } from "../domain/ai-suggestion";

const CATEGORY_LABELS: Record<string, string> = {
  areas: "אזור לינה",
  restaurants: "מסעדה",
  attractions: "אטרקציה",
  experiences: "חוויה",
};

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

  return (
    <div className="flex flex-col gap-4">
      {[...byCity.entries()].map(([city, list]) => (
        <div key={city} className="flex flex-col gap-2">
          <h3 className="font-semibold">{city}</h3>
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <li key={keyOf(item)}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <span>{item.name}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
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
