"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Banner, Button, Field, Input, buttonClasses } from "@/components/ui";
import { setNewPassword } from "../application/actions";
import type { NewPasswordState } from "../domain/schemas";
import { AuthNotice, authField, authFieldIcon, authSubmit } from "./auth-shell";

// Setting a new password, at the end of the emailed recovery link.
//
// This is the *only* way a password changes in this app. There is no
// change-password screen behind a session, and no way to add a password to a
// Google account — both were removed on purpose. The consequence is worth
// stating plainly: every password change is authorised by proving control of the
// mailbox, so a stolen session cannot quietly change the password and lock the
// real owner out.
export function NewPasswordForm() {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(
    setNewPassword,
    undefined,
  );

  if (state?.done) {
    return (
      <AuthNotice icon={<CheckCircle2 />} title="הסיסמה עודכנה" tone="success">
        <p>אפשר להיכנס איתה מעכשיו.</p>
        <Link
          href="/profile"
          className={buttonClasses("primary", "lg", `${authSubmit} mt-2`)}
        >
          להמשיך לאפליקציה
        </Link>
      </AuthNotice>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-[22px] font-bold leading-tight">סיסמה חדשה</h1>
        <p className="text-sm text-muted">
          בחרו סיסמה חדשה. הקישור שהגעתם דרכו תקף לשימוש אחד.
        </p>
      </div>

      <Field
        label="סיסמה"
        hint="לפחות 8 תווים."
        error={state?.errors?.password?.join(" ")}
      >
        <span className="relative block">
          <Input
            name="password"
            type="password"
            // "new-password" and not "current-password": it tells a password
            // manager to offer a generated one rather than autofilling the old.
            autoComplete="new-password"
            required
            dir="ltr"
            className={`${authField(true)} text-left`}
            aria-invalid={state?.errors?.password ? true : undefined}
          />
          <Lock className={authFieldIcon} aria-hidden="true" />
        </span>
      </Field>

      <Field label="שוב, לאימות" error={state?.errors?.confirm?.join(" ")}>
        <span className="relative block">
          <Input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            className={`${authField(true)} text-left`}
            aria-invalid={state?.errors?.confirm ? true : undefined}
          />
          <Lock className={authFieldIcon} aria-hidden="true" />
        </span>
      </Field>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className={`${authSubmit} mt-1`}>
        עדכון הסיסמה
      </Button>
    </form>
  );
}
