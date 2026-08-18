"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Banner,
  Button,
  Card,
  ChipRadio,
  Field,
  IconButton,
  Input,
  SectionHeading,
} from "@/components/ui";
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
          <Banner tone="success">{feedback.text}</Banner>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading
        level="sub"
        description="למקום שהחיפוש לא מכיר — המלצה מחבר, משהו שראיתם ברשת."
        actions={
          <IconButton label="סגירה" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        }
      >
        הוספת מקום
      </SectionHeading>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="שם המקום" error={result?.errors?.name}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="לדוגמה: אפאיה שינג׳וקו"
              maxLength={200}
              aria-invalid={Boolean(result?.errors?.name)}
            />
          </Field>

          <Field label="עיר" error={result?.errors?.city}>
            <>
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="לדוגמה: טוקיו"
                maxLength={120}
                list={cities.length > 0 ? listId : undefined}
                aria-invalid={Boolean(result?.errors?.city)}
              />
              {cities.length > 0 && (
                <datalist id={listId}>
                  {cities.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              )}
            </>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">קטגוריה</legend>
          {/* Radio inputs rather than a select: six options with an emoji each
              read faster as chips, and they stay reachable by keyboard. The
              pill markup used to be copied by hand here and twice in
              booking-form; ChipRadio is now the one copy. */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((key) => {
              const meta = PLACE_CATEGORIES[key];
              return (
                <ChipRadio
                  key={key}
                  name="manual-place-category"
                  value={key}
                  checked={key === category}
                  onChange={() => setCategory(key)}
                  label={
                    <>
                      <span aria-hidden="true">{meta.emoji}</span>
                      {meta.label}
                    </>
                  }
                />
              );
            })}
          </div>
        </fieldset>

        <Field
          label={
            <>
              כתובת <span className="font-normal text-muted">(לא חובה)</span>
            </>
          }
          error={result?.errors?.address}
        >
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="רחוב, שכונה, או איך למצוא"
            maxLength={300}
            aria-invalid={Boolean(result?.errors?.address)}
          />
        </Field>

        {feedback && (
          <Banner tone={feedback.kind === "error" ? "danger" : "success"}>
            {feedback.text}
          </Banner>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            הוספה לטיול
          </Button>
          <p className="text-caption text-muted">
            המקום ייכנס ל״מה שבחרתם״ ולבניית הלו״ז.
          </p>
        </div>
      </form>
    </Card>
  );
}
