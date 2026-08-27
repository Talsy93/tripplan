"use client";

import { useActionState } from "react";
import { Banner, Button, Field, Input } from "@/components/ui";
import type { AuthFormState } from "../domain/schemas";

type CredentialsFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  title: string;
  submitLabel: string;
  // Where to go after a successful sign-in, for the invite flow. Passed through
  // as a hidden field and validated server-side by safeNext — never trusted as
  // given, because it arrives in a URL.
  next?: string;
};

export function CredentialsForm({
  action,
  title,
  submitLabel,
  next,
}: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <h1 className="text-heading font-bold">{title}</h1>

      {next && <input type="hidden" name="next" value={next} />}

      {/* dir="ltr" and text-left are deliberate: an address and a password are
          Latin content, and letting them follow the page's RTL direction puts
          the caret and the @ on the wrong side. */}
      <Field label="אימייל" error={state?.errors?.email?.join(" ")}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          dir="ltr"
          className="text-left"
          aria-invalid={state?.errors?.email ? true : undefined}
        />
      </Field>

      <Field label="סיסמה" error={state?.errors?.password?.join(" ")}>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="text-left"
          aria-invalid={state?.errors?.password ? true : undefined}
        />
      </Field>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
