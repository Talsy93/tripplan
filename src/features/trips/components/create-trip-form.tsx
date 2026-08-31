"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Clock, Plus, Sparkles } from "lucide-react";
import { Banner, Button, Dialog, Field, Input } from "@/components/ui";
import { createTrip } from "../application/actions";
import type { TripFormState } from "../domain/trip";

export function CreateTripForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<TripFormState, FormData>(
    createTrip,
    undefined,
  );

  // createTrip returns undefined on success and a state object on failure, and
  // the initial state is also undefined — so "undefined" alone cannot tell the
  // two apart. The ref records that a submit actually happened.
  const submitted = useRef(false);

  useEffect(() => {
    if (!pending && submitted.current && !state) {
      submitted.current = false;
      onSuccess?.();
    }
  }, [pending, state, onSuccess]);

  return (
    <form
      action={action}
      onSubmit={() => {
        submitted.current = true;
      }}
      className="flex flex-col gap-4"
    >
      <Field
        label="איך נקרא לטיול?"
        error={state?.errors?.name?.join(" ")}
      >
        <Input
          name="name"
          placeholder="למשל: איטליה בסתיו"
          required
          autoFocus
          aria-invalid={state?.errors?.name ? true : undefined}
        />
      </Field>

      {/* Dates, at creation rather than three screens later.
          Almost everything in this app derives from them — the day count, the
          countdown, which day "today" is, whether a forecast can exist at all —
          so a trip created without them opens into a version of the app where
          most of it has nothing to say. Asking here costs two taps.

          Optional, though, and that is deliberate: "I know I want to go to
          Japan" is a real place to start, and a form that refuses to create a
          trip without a date turns a decision into a blocker. The schema
          normalises the empty string a blank date input submits. */}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">מתי?</legend>
        <div className="flex min-w-0 gap-2">
          <Field label="יציאה" className="min-w-0 flex-1">
            <Input
              type="date"
              name="start_date"
              aria-invalid={state?.errors?.start_date ? true : undefined}
            />
          </Field>
          <Field
            label="חזרה"
            className="min-w-0 flex-1"
            error={state?.errors?.end_date?.join(" ")}
          >
            <Input
              type="date"
              name="end_date"
              aria-invalid={state?.errors?.end_date ? true : undefined}
            />
          </Field>
        </div>
        <p className="flex items-center gap-1.5 text-caption text-muted">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          אפשר לדלג ולהוסיף אחר כך — ואפשר לשנות בכל שלב.
        </p>
      </fieldset>
      {/* Said plainly rather than hidden behind a disclosure. This used to be a
          <details> labelled "מה עושים אחרי זה?" — a question the person filling
          in the form has not asked yet. They asked what the button does. */}
      <div className="flex min-w-0 items-start gap-3 rounded-card bg-primary-tint p-4">
        <span className="shrink-0 text-primary-ink" aria-hidden="true">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="min-w-0 text-sm text-primary-ink">
          <span className="block font-bold">רוצים שנציע יעדים?</span>
          אחרי היצירה אפשר לתאר מה מעניין אתכם, ונרכיב מסלול ראשוני להתחיל ממנו.
        </p>
      </div>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} className="self-start">
        יצירת הטיול
      </Button>
    </form>
  );
}

// The form used to sit permanently open in the middle of the home screen, above
// the trip list — the single clearest "unfinished interface" tell in the app.
// It is an occasional action, so it lives behind a button.
export function NewTripButton({
  variant = "primary",
}: {
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        טיול חדש
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="טיול חדש"
      >
        <CreateTripForm onSuccess={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
