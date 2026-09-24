"use client";

import { useActionState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { Banner, Button, Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../application/actions";
import type { ResetRequestState } from "../domain/schemas";
import { AuthNotice, authField, authFieldIcon, authSubmit } from "./auth-shell";

// "I forgot my password".
//
// On success this deliberately does not say whether the address is registered.
// The confirmation is phrased as "if there is an account, a link is on its way",
// because the alternative — "no such user" — is a way to test whether any given
// person has an account here. The server enforces that too; this is just the
// wording that matches it.
export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state?.sent) {
    return (
      <AuthNotice icon={<MailCheck />} title="בדקו את המייל">
        <p>
          אם קיים חשבון עם הכתובת הזו, שלחנו אליה קישור לקביעת סיסמה חדשה.
          הקישור תקף לזמן מוגבל ולשימוש אחד.
        </p>
        <p className="rounded-[14px] bg-surface-2 p-3.5 text-caption">
          לא הגיע? בדקו בספאם. השירות החינמי מגביל את מספר המיילים בשעה, כך
          שבקשה חוזרת מיד לא בהכרח תישלח.
        </p>
      </AuthNotice>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-[22px] font-bold leading-tight">איפוס סיסמה</h1>
        <p className="text-sm text-muted">
          נשלח קישור לקביעת סיסמה חדשה. זו הדרך היחידה להחליף סיסמה — האישור
          עובר דרך המייל ולא מתוך האפליקציה, כך שגם מי שנכנס לחשבון שלכם לא יכול
          לשנות אותה.
        </p>
      </div>

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

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className={`${authSubmit} mt-1`}>
        שליחת קישור
      </Button>
    </form>
  );
}
