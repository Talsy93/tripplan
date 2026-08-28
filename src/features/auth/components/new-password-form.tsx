"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Banner, Button, Field, Input, buttonClasses } from "@/components/ui";
import { setNewPassword } from "../application/actions";
import type { NewPasswordState } from "../domain/schemas";

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
      <div className="flex flex-col gap-3">
        <Banner tone="success">
          <span className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            הסיסמה עודכנה. אפשר להיכנס איתה מעכשיו.
          </span>
        </Banner>
        <Link
          href="/profile"
          className={buttonClasses("primary", "md", "self-start")}
        >
          להמשיך לאפליקציה
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <h1 className="text-heading font-bold">סיסמה חדשה</h1>
      <p className="text-sm text-muted">
        בחרו סיסמה חדשה. הקישור שהגעתם דרכו תקף לשימוש אחד.
      </p>

      <Field
        label="סיסמה"
        hint="לפחות 8 תווים."
        error={state?.errors?.password?.join(" ")}
      >
        <Input
          name="password"
          type="password"
          // "new-password" and not "current-password": it tells a password
          // manager to offer a generated one rather than autofilling the old.
          autoComplete="new-password"
          required
          dir="ltr"
          className="text-left"
          aria-invalid={state?.errors?.password ? true : undefined}
        />
      </Field>

      <Field label="שוב, לאימות" error={state?.errors?.confirm?.join(" ")}>
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          className="text-left"
          aria-invalid={state?.errors?.confirm ? true : undefined}
        />
      </Field>

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className="w-full">
        עדכון הסיסמה
      </Button>
    </form>
  );
}
