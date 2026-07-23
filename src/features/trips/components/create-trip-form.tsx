"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createTrip } from "../application/actions";
import type { TripFormState } from "../domain/trip";

export function CreateTripForm() {
  const [state, action, pending] = useActionState<TripFormState, FormData>(
    createTrip,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="name" placeholder="שם הטיול" required className="sm:flex-1" />
        <Button type="submit" disabled={pending}>
          {pending ? "שומר…" : "טיול חדש"}
        </Button>
      </div>
      {state?.errors?.name && (
        <p className="text-sm text-red-600">{state.errors.name.join(" ")}</p>
      )}
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
