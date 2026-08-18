"use client";

import { Button, Card, SectionHeading, Surface } from "@/components/ui";
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
      <Surface tone="quiet" className="flex flex-col items-start gap-2">
        <p className="text-base font-semibold">עוד אין מספיק בשיחה</p>
        <p className="text-sm text-muted">
          השיחה עדיין לא הגיעה ליעדים מוגדרים. המשיכו לדבר ונסו שוב.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          סגירה
        </Button>
      </Surface>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading level="sub" description={plan.summary}>
        מה שנבנה מהשיחה
      </SectionHeading>

      <div className="grid gap-3 sm:grid-cols-2">
        {plan.cities.map((city) => (
          <div key={city.name} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{city.name}</span>
            <span className="text-caption text-muted">{city.intro}</span>
            <ul className="flex flex-col gap-0.5 border-s-2 border-border ps-3 text-sm">
              {city.items.map((item) => (
                <li key={item.name} className="flex flex-wrap gap-x-2">
                  <span>{item.name}</span>
                  <span className="text-caption text-muted">
                    {categoryLabel(item.category)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onApply} loading={applying} size="sm">
          {`הוספה לטיול (${cities} יעדים, ${items} פריטים)`}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          ביטול
        </Button>
      </div>

      {/* Says plainly that this only adds — the reassurance that makes the
          button safe to press. */}
      <p className="text-caption text-muted">
        ההוספה לא מוחקת כלום ממה שכבר בחרתם, וכל פריט ניתן להסרה בטאב התכנון.
      </p>
    </Card>
  );
}
