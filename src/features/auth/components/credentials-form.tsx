"use client";

import { useActionState } from "react";
import type { AuthFormState } from "../domain/schemas";

type CredentialsFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  title: string;
  submitLabel: string;
};

export function CredentialsForm({
  action,
  title,
  submitLabel,
}: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="rounded border border-gray-300 px-3 py-2 text-left"
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email.join(" ")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="rounded border border-gray-300 px-3 py-2 text-left"
        />
        {state?.errors?.password && (
          <p className="text-sm text-red-600">
            {state.errors.password.join(" ")}
          </p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-gray-700">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "רגע…" : submitLabel}
      </button>
    </form>
  );
}
