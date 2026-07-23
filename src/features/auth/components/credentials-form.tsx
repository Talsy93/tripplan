"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
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
    <form action={formAction} className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          אימייל
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="text-left"
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email.join(" ")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          סיסמה
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="text-left"
        />
        {state?.errors?.password && (
          <p className="text-sm text-red-600">
            {state.errors.password.join(" ")}
          </p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-muted">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "רגע…" : submitLabel}
      </Button>
    </form>
  );
}
