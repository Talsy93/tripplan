"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
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
        label="שם הטיול"
        hint="אפשר לשנות אחר כך, וגם להוסיף תאריכים בהמשך."
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
