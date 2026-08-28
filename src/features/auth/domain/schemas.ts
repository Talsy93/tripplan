import * as z from "zod";

export const credentialsSchema = z.object({
  email: z.email({ error: "יש להזין כתובת אימייל תקינה." }).trim(),
  password: z.string().min(8, { error: "הסיסמה חייבת להכיל לפחות 8 תווים." }),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

// ---- Password recovery ----------------------------------------------------
//
// Two separate steps, and they are deliberately not the same schema. Asking for
// a reset needs only an address and must succeed identically whether or not that
// address is registered; setting the new password needs a session that only the
// emailed link can produce.

export const resetRequestSchema = z.object({
  email: z.email({ error: "יש להזין כתובת אימייל תקינה." }).trim(),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "הסיסמה חייבת להכיל לפחות 8 תווים." }),
    confirm: z.string(),
  })
  // A confirmation field rather than a "show password" toggle: this is the one
  // form in the app where a typo cannot be discovered by trying again — the
  // recovery link is single-use, and a mistyped password locks the account until
  // another email is requested.
  .refine((values) => values.password === values.confirm, {
    error: "שתי הסיסמאות לא זהות.",
    path: ["confirm"],
  });

export type NewPassword = z.infer<typeof newPasswordSchema>;

export type ResetRequestState =
  | {
      errors?: { email?: string[] };
      // Present on success. Worded so it says the same thing for a registered
      // address and an unregistered one — see requestPasswordReset.
      sent?: boolean;
      message?: string;
    }
  | undefined;

export type NewPasswordState =
  | {
      errors?: { password?: string[]; confirm?: string[] };
      message?: string;
      done?: boolean;
    }
  | undefined;
