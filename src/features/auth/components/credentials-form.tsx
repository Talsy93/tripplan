"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Lock, Mail, MailCheck } from "lucide-react";
import { Banner, Button, Field, Input } from "@/components/ui";
import type { AuthFormState } from "../domain/schemas";
import { AuthNotice, authField, authFieldIcon, authSubmit } from "./auth-shell";

type CredentialsFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  // Read by screen readers only: the Pencil screens carry the wordmark as their
  // visible heading, and the submit label already says which form this is.
  title: string;
  submitLabel: string;
  // Where to go after a successful sign-in, for the invite flow. Passed through
  // as a hidden field and validated server-side by safeNext — never trusted as
  // given, because it arrives in a URL.
  next?: string;
  // Signup only: the privacy consent checkbox. The server rejects a signup
  // without it regardless of what this renders (see signupSchema) — this is the
  // affordance, not the control.
  requirePrivacy?: boolean;
  // Sign-in only: the "שכחתי סיסמה" link, under the password as the design
  // draws it.
  forgotHref?: string;
};

export function CredentialsForm({
  action,
  title,
  submitLabel,
  next,
  requirePrivacy = false,
  forgotHref,
}: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  // The account was created but cannot be used until the address is confirmed.
  // The form is replaced rather than annotated: there is nothing left to fill
  // in, and leaving the fields on screen invites a second submission that will
  // only fail with "already registered".
  if (state?.awaitingConfirmation) {
    return (
      <AuthNotice icon={<MailCheck />} title="אמתו את כתובת המייל">
        <p>
          שלחנו הודעה ל
          <span dir="ltr" className="mx-1 font-semibold text-foreground wrap-anywhere">
            {state.awaitingConfirmation}
          </span>
          . לחצו על הקישור שבה כדי להשלים את ההרשמה — עד אז אי אפשר להתחבר.
        </p>
        <p className="rounded-[14px] bg-surface-2 p-3.5 text-caption">
          לא הגיע? בדקו בספאם. השירות החינמי מגביל את מספר המיילים בשעה, כך
          שהרשמה חוזרת מיד לא בהכרח תשלח הודעה נוספת.
        </p>
      </AuthNotice>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <h1 className="sr-only">{title}</h1>

      {next && <input type="hidden" name="next" value={next} />}

      {/* dir="ltr" and text-left are deliberate: an address and a password are
          Latin content, and letting them follow the page's RTL direction puts
          the caret and the @ on the wrong side. */}
      <Field label="מייל" error={state?.errors?.email?.join(" ")}>
        <span className="relative block">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            dir="ltr"
            className={`${authField(true)} text-left`}
            aria-invalid={state?.errors?.email ? true : undefined}
          />
          <Mail className={authFieldIcon} aria-hidden="true" />
        </span>
      </Field>

      <div className="flex flex-col gap-2">
        <Field label="סיסמה" error={state?.errors?.password?.join(" ")}>
          <span className="relative block">
            <Input
              name="password"
              type="password"
              // "new-password" on signup so a password manager offers to
              // generate one instead of autofilling an existing password.
              autoComplete={requirePrivacy ? "new-password" : "current-password"}
              required
              dir="ltr"
              className={`${authField(true)} text-left`}
              aria-invalid={state?.errors?.password ? true : undefined}
            />
            <Lock className={authFieldIcon} aria-hidden="true" />
          </span>
        </Field>
        {/* Until phase K there was no recovery flow at all, which meant a
            forgotten password locked the account for good. */}
        {forgotHref && (
          <Link
            href={forgotHref}
            className="self-start rounded-full text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            שכחתי סיסמה
          </Link>
        )}
      </div>

      {requirePrivacy && (
        <div className="flex flex-col gap-1.5">
          {/* The input inside its own label, so the text is part of the hit
              target and no htmlFor/id pairing can drift. */}
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="acceptedPrivacy"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              aria-invalid={state?.errors?.acceptedPrivacy ? true : undefined}
            />
            <span className="min-w-0">
              קראתי ואני מאשר/ת את{" "}
              {/* Opens in a new tab on purpose: leaving the page mid-signup
                  would discard the address and password already typed. */}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                מדיניות הפרטיות
              </Link>
              .
            </span>
          </label>
          {state?.errors?.acceptedPrivacy && (
            <p className="text-caption text-danger-ink">
              {state.errors.acceptedPrivacy.join(" ")}
            </p>
          )}
        </div>
      )}

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className={`${authSubmit} mt-1`}>
        {submitLabel}
      </Button>
    </form>
  );
}
