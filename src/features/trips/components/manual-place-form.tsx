"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createManualPlace } from "../application/place-actions";
import { PLACE_CATEGORIES } from "../domain/place";
import type { ManualPlaceResult } from "../application/place-actions";
import type { PlaceCategory } from "../domain/place";

const CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[];

type Feedback = { kind: "added" | "existed" | "error"; text: string };

export function ManualPlaceForm({
  tripId,
  // Cities already on the trip, offered as suggestions. Deliberately a plain
  // text input with a datalist rather than a select: on a brand-new trip this
  // list is empty, and a select with no options would be a dead end — this form
  // is often the very thing that creates the trip's first city.
  cities,
}: {
  tripId: string;
  cities: string[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState(cities[0] ?? "");
  const [category, setCategory] = useState<PlaceCategory>("restaurants");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ManualPlaceResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const listId = useId();
  const nameId = useId();
  const cityId = useId();
  const addressId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    const outcome = await createManualPlace(tripId, {
      name,
      city,
      category,
      // An empty address is "not given", not an empty string — the schema takes
      // it as optional and the service leaves the column alone.
      address: address.trim() || undefined,
    });
    setResult(outcome);
    setSaving(false);

    if (!outcome.ok) {
      if (outcome.message) {
        setFeedback({ kind: "error", text: outcome.message });
      }
      return;
    }

    setFeedback(
      outcome.existed
        ? { kind: "existed", text: `${name} כבר היה בטיול — סומן כנבחר.` }
        : { kind: "added", text: `${name} נוסף ל${city}.` },
    );
    // The city stays, so adding several places in one city is a short loop.
    setName("");
    setAddress("");
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="self-start"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוסיפו מקום בעצמכם
        </Button>
        {feedback && feedback.kind !== "error" && (
          <p className="text-sm text-success-ink">{feedback.text}</p>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">הוספת מקום</h3>
          <p className="text-sm text-muted">
            למקום שהחיפוש לא מכיר — המלצה מחבר, משהו שראיתם ברשת.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="סגירה"
          className="shrink-0 text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              שם המקום
            </label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="לדוגמה: אפאיה שינג׳וקו"
              maxLength={200}
              aria-invalid={Boolean(result?.errors?.name)}
              aria-describedby={
                result?.errors?.name ? `${nameId}-error` : undefined
              }
            />
            {result?.errors?.name && (
              <p id={`${nameId}-error`} className="text-sm text-danger-ink">
                {result.errors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={cityId} className="text-sm font-medium">
              עיר
            </label>
            <Input
              id={cityId}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="לדוגמה: טוקיו"
              maxLength={120}
              list={cities.length > 0 ? listId : undefined}
              aria-invalid={Boolean(result?.errors?.city)}
              aria-describedby={
                result?.errors?.city ? `${cityId}-error` : undefined
              }
            />
            {cities.length > 0 && (
              <datalist id={listId}>
                {cities.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
            {result?.errors?.city && (
              <p id={`${cityId}-error`} className="text-sm text-danger-ink">
                {result.errors.city}
              </p>
            )}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">קטגוריה</legend>
          {/* Radio inputs rather than a select: six options with an emoji each
              read faster as chips, and they stay reachable by keyboard. */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((key) => {
              const meta = PLACE_CATEGORIES[key];
              const active = key === category;
              return (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:border-primary",
                  )}
                >
                  <input
                    type="radio"
                    name="manual-place-category"
                    value={key}
                    checked={active}
                    onChange={() => setCategory(key)}
                    className="sr-only"
                  />
                  <span aria-hidden="true">{meta.emoji}</span>
                  {meta.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={addressId} className="text-sm font-medium">
            כתובת <span className="font-normal text-muted">(לא חובה)</span>
          </label>
          <Input
            id={addressId}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="רחוב, שכונה, או איך למצוא"
            maxLength={300}
            aria-invalid={Boolean(result?.errors?.address)}
            aria-describedby={
              result?.errors?.address ? `${addressId}-error` : undefined
            }
          />
          {result?.errors?.address && (
            <p id={`${addressId}-error`} className="text-sm text-danger-ink">
              {result.errors.address}
            </p>
          )}
        </div>

        {feedback && (
          <p
            className={cn(
              "text-sm",
              feedback.kind === "error"
                ? "text-danger-ink"
                : "text-success-ink",
            )}
          >
            {feedback.text}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            הוסיפו לטיול
          </Button>
          <p className="text-xs text-muted">
            המקום ייכנס ל״מה שבחרתם״ ולבניית הלו״ז.
          </p>
        </div>
      </form>
    </Card>
  );
}
