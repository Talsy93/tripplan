"use client";

import { Button, Card } from "@/components/ui";
import { categoryLabel } from "../domain/place";
import { planTotals } from "../domain/trip-plan";
import type { AiTripPlan } from "../domain/trip-plan";

// What the conversation would add to the trip, shown before anything is
// written. The summary sits on top so a misread conversation is obvious
// without reading every item.
export function PlanPreview({
  plan,
  applying,
  onApply,
  onDismiss,
}: {
  plan: AiTripPlan;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { cities, items } = planTotals(plan);

  if (cities === 0) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <p className="font-semibold">עוד אין מספיק בשיחה</p>
        <p className="text-sm text-muted">
          השיחה עדיין לא הגיעה ליעדים מוגדרים. המשיכו לדבר ונסו שוב.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="self-start text-sm text-muted hover:text-foreground"
        >
          סגור
        </button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 border-s-4 border-s-primary p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-bold">מה שנבנה מהשיחה</h3>
        <p className="text-sm text-muted">{plan.summary}</p>
      </div>

      <div className="flex flex-col gap-3">
        {plan.cities.map((city) => (
          <div key={city.name} className="flex flex-col gap-1">
            <span className="font-semibold">{city.name}</span>
            <span className="text-xs text-muted">{city.intro}</span>
            <ul className="flex flex-col gap-0.5 border-s border-border ps-3 text-sm">
              {city.items.map((item) => (
                <li key={item.name} className="flex flex-wrap gap-x-2">
                  <span>{item.name}</span>
                  <span className="text-xs text-muted">
                    {categoryLabel(item.category)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onApply} disabled={applying} size="sm">
          {applying
            ? "מוסיף…"
            : `הוסף לטיול (${cities} יעדים, ${items} פריטים)`}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ביטול
        </button>
      </div>

      {/* Says plainly that this only adds — the reassurance that makes the
          button safe to press. */}
      <p className="text-xs text-muted">
        ההוספה לא מוחקת כלום ממה שכבר בחרתם, וכל פריט ניתן להסרה בטאב התכנון.
      </p>
    </Card>
  );
}
