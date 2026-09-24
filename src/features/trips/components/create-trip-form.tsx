"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Info, PencilLine, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Banner, Button, Dialog, Field, Input } from "@/components/ui";
import { createTrip } from "../application/actions";
import type { TripFormState } from "../domain/trip";

// The Pencil field: white with a hairline, 52px, corners of 14. Layered on the
// shared Input skin rather than changed in it — the shared skin is used by
// every form in the app.
const FIELD = "h-13 rounded-[14px] border-border bg-surface";
const ICON =
  "pointer-events-none absolute inset-y-0 start-3.5 my-auto h-5 w-5 text-outline";

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
      className="flex flex-col gap-5"
    >
      {/* The sheet of design/pencil/exports/sheet-new-trip: a subtitle under
          the dialog's title, white fields with a hairline and an icon, and one
          terracotta button across the bottom. */}
      <p className="-mt-2 text-sm text-muted">אפשר לשנות הכל אחר כך</p>

      <Field label="איך קוראים לטיול?" error={state?.errors?.name?.join(" ")}>
        <span className="relative block">
          <Input
            name="name"
            placeholder="למשל: איטליה — אביב 2027"
            required
            autoFocus
            aria-invalid={state?.errors?.name ? true : undefined}
            className={cn(FIELD, "ps-11")}
          />
          <PencilLine className={ICON} aria-hidden="true" />
        </span>
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
      <fieldset className="flex min-w-0 flex-col">
        <legend className="sr-only">מתי?</legend>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <Field label="יציאה">
            {/* dir="ltr" like every other date input in the app. Without it
                WebKit lays "dd/mm/yyyy" out in the document's RTL, which puts
                the segments in the wrong order and, on iOS, starts the value
                outside the box. */}
            <Input
              type="date"
              name="start_date"
              dir="ltr"
              aria-invalid={state?.errors?.start_date ? true : undefined}
              className={FIELD}
            />
          </Field>
          <Field label="חזרה" error={state?.errors?.end_date?.join(" ")}>
            <Input
              type="date"
              name="end_date"
              dir="ltr"
              aria-invalid={state?.errors?.end_date ? true : undefined}
              className={FIELD}
            />
          </Field>
        </div>
      </fieldset>

      {/* The design's draft hint, in its quiet box. The "we can suggest
          destinations" note that used to sit here is folded into it: both
          answer the same question — what happens after this button. */}
      <div className="flex min-w-0 items-start gap-2.5 rounded-[14px] bg-surface-2 p-3.5 text-[13px] text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0">
          עוד לא יודעים תאריכים? אפשר להשאיר ריק והטיול יישמר כטיוטה. אחרי
          היצירה אפשר לתאר מה מעניין אתכם, ונציע יעדים להתחיל מהם.
        </p>
      </div>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button
        type="submit"
        loading={pending}
        size="lg"
        className="h-14 w-full rounded-full"
      >
        יצירת הטיול
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Button>
    </form>
  );
}

// The form used to sit permanently open in the middle of the home screen, above
// the trip list — the single clearest "unfinished interface" tell in the app.
// It is an occasional action, so it lives behind a button.
export function NewTripButton({
  variant = "primary",
  className,
  children,
}: {
  // "onLight" for the home rail, which sits on the upcoming trip's light — see
  // Button for why that variant is white rather than the action blue.
  variant?: "primary" | "outline" | "onLight";
  className?: string;
  // A trigger drawn by the caller — the home screen's terracotta button. The
  // button is then a bare <button> carrying only `className`.
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className}
        >
          {children}
        </button>
      ) : (
        <Button
          variant={variant}
          onClick={() => setOpen(true)}
          className={className}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          טיול חדש
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="טיול חדש">
        <CreateTripForm onSuccess={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
