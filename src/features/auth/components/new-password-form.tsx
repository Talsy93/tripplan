"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Banner, Button, Field, Input, buttonClasses } from "@/components/ui";
import { setNewPassword } from "../application/actions";
import type { NewPasswordState } from "../domain/schemas";

// Setting a password.
//
// Serves two situations that are the same form and different sentences: arriving
// from a recovery link, and adding a password to an account that has only ever
// signed in with Google. `mode` picks the wording; the action is identical.
export function NewPasswordForm({
  mode,
  onDoneHref,
}: {
  mode: "recover" | "add" | "change";
  // Where to go afterwards. The recovery flow sends people into the app; the
  // in-app version stays where it is and just confirms.
  onDoneHref?: string;
}) {
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
            {mode === "add"
              ? "הסיסמה נקבעה. מעכשיו אפשר להיכנס גם עם אימייל וסיסמה, וגם דרך Google."
              : "הסיסמה עודכנה."}
          </span>
        </Banner>
        {onDoneHref && (
          <Link
            href={onDoneHref}
            className={buttonClasses("primary", "md", "self-start")}
          >
            להמשיך לאפליקציה
          </Link>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      {mode === "recover" && (
        <>
          <h1 className="text-heading font-bold">סיסמה חדשה</h1>
          <p className="text-sm text-muted">
            בחרו סיסמה חדשה. הקישור שהגעתם דרכו תקף לשימוש אחד.
          </p>
        </>
      )}
      {mode === "add" && (
        <p className="text-sm text-muted">
          נרשמתם דרך Google, ולכן אין לחשבון סיסמה. קביעת סיסמה כאן תוסיף דרך
          כניסה שנייה — Google ימשיך לעבוד בדיוק כמו עד עכשיו.
        </p>
      )}

      <Field
        label={mode === "add" ? "סיסמה חדשה" : "סיסמה"}
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

      <Button
        type="submit"
        loading={pending}
        size={mode === "recover" ? "lg" : "md"}
        className={mode === "recover" ? "w-full" : "self-start"}
      >
        {mode === "add" ? "קביעת סיסמה" : "עדכון הסיסמה"}
      </Button>
    </form>
  );
}
