import * as z from "zod";

export const credentialsSchema = z.object({
  email: z.email({ error: "יש להזין כתובת אימייל תקינה." }).trim(),
  password: z.string().min(8, { error: "הסיסמה חייבת להכיל לפחות 8 תווים." }),
});

export type Credentials = z.infer<typeof credentialsSchema>;

// Signing up additionally requires accepting the privacy policy.
//
// A separate schema rather than an optional field on credentialsSchema, because
// the requirement applies to signup and not to signing in — an existing user is
// not asked again every time they log in, and a shared schema with an optional
// flag would make it possible to forget the check on the one path that needs it.
//
// The checkbox is validated **server-side**. `required` on the input is a
// convenience for the person filling the form; it is not a control. A Server
// Action is an HTTP endpoint, so the consent has to be verified where it cannot
// be skipped.
export const signupSchema = credentialsSchema.extend({
  // An unticked checkbox is simply absent from FormData, so the action maps
  // presence to true before parsing. Literal `true` and not `boolean`: `false`
  // must fail, not pass through.
  acceptedPrivacy: z.literal(true, {
    error: "יש לאשר את מדיניות הפרטיות כדי להירשם.",
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export type AuthFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
        acceptedPrivacy?: string[];
      };
      message?: string;
      // Set when signup succeeded but the address still has to be confirmed.
      // A distinct flag rather than a message, so the form can replace itself
      // with instructions instead of showing a red error under the fields.
      awaitingConfirmation?: string;
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
