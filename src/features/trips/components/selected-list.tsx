import { Card } from "@/components/ui";
import type { SelectedItem } from "../domain/ai-suggestion";

const CATEGORY_LABELS: Record<string, string> = {
  areas: "אזור לינה",
  restaurants: "מסעדה",
  attractions: "אטרקציה",
  experiences: "חוויה",
};

export function SelectedList({ items }: { items: SelectedItem[] }) {
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
            {list.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <span>{item.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
