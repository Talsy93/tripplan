"use client";

import { useActionState } from "react";
import { createTrip } from "../application/actions";
import type { TripFormState } from "../domain/trip";

export function CreateTripForm() {
  const [state, action, pending] = useActionState<TripFormState, FormData>(
    createTrip,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="name"
          placeholder="שם הטיול"
          required
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "שומר…" : "טיול חדש"}
        </button>
      </div>
      {state?.errors?.name && (
        <p className="text-sm text-red-600">{state.errors.name.join(" ")}</p>
      )}
      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
