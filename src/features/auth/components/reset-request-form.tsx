"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Banner, Button, Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../application/actions";
import type { ResetRequestState } from "../domain/schemas";

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
      <div className="flex flex-col gap-3">
        <h1 className="text-heading font-bold">בדקו את המייל</h1>
        <Banner tone="success">
          <span className="flex items-start gap-2">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            אם קיים חשבון עם הכתובת הזו, שלחנו אליה קישור לקביעת סיסמה חדשה.
            הקישור תקף לזמן מוגבל ולשימוש אחד.
          </span>
        </Banner>
        <p className="text-caption text-muted">
          לא הגיע? בדקו בספאם. השירות החינמי מגביל את מספר המיילים בשעה, כך
          שבקשה חוזרת מיד לא בהכרח תישלח.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <h1 className="text-heading font-bold">איפוס סיסמה</h1>
      <p className="text-sm text-muted">
        נשלח קישור לקביעת סיסמה חדשה. אם נרשמתם דרך Google ואין לכם סיסמה בכלל —
        זו גם הדרך לקבוע אחת בפעם הראשונה.
      </p>

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

      {state?.message && <Banner tone="danger">{state.message}</Banner>}

      <Button type="submit" loading={pending} size="lg" className="w-full">
        שליחת קישור
      </Button>
    </form>
  );
}
