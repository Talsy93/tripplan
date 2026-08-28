"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import {
  credentialsSchema,
  newPasswordSchema,
  resetRequestSchema,
  signupSchema,
  type AuthFormState,
  type NewPasswordState,
  type ResetRequestState,
} from "../domain/schemas";
import { OAUTH_NEXT_COOKIE, safeNext } from "../domain/redirect";
import {
  hasPasswordIdentity,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from "../infrastructure/auth-service";

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

// Supabase auth errors arrive in English; surface Hebrew to the user.
function toHebrewAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "אימייל או סיסמה שגויים.";
  }
  if (normalized.includes("already registered")) {
    return "כתובת האימייל כבר רשומה במערכת.";
  }
  if (normalized.includes("email not confirmed")) {
    return "יש לאמת את כתובת האימייל לפני ההתחברות.";
  }
  if (normalized.includes("email") && normalized.includes("invalid")) {
    return "כתובת האימייל אינה תקינה.";
  }
  return "אירעה שגיאה. נסו שוב.";
}

export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    // An unticked checkbox is absent from FormData, so presence is the value.
    // Mapped here rather than in the schema so the schema stays a statement
    // about the domain and not about how HTML forms serialise.
    acceptedPrivacy: formData.get("acceptedPrivacy") !== null,
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { error, needsEmailConfirmation } = await signUpWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { message: toHebrewAuthError(error) };
  }

  // The account exists but cannot be used until the address is confirmed.
  // Returned as its own flag with the address echoed back, so the form can
  // replace itself with "check your mail" rather than leaving someone staring at
  // a form that looks like it did nothing.
  //
  // Whether this happens at all is a Supabase project setting
  // (Authentication → Providers → Email → Confirm email). The code handles both
  // states, so turning it on or off needs no deploy.
  if (needsEmailConfirmation) {
    return { awaitingConfirmation: parsed.data.email };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { error } = await signInWithPassword(parsed.data);

  if (error) {
    return { message: toHebrewAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

// Takes FormData because it is used as a form action, and that form carries the
// invite's ?next= in a hidden field.
//
// The destination travels in a short-lived cookie, **not** on the callback URL.
// The first version of this appended `?next=…` to the redirectTo, which broke
// Google sign-in in production: Supabase validates redirectTo against the
// project's Redirect URLs allow-list, and the configured entry is the bare
// `/auth/callback` with no wildcard. A URL carrying a query string does not
// match it, so Supabase fell back to the Site URL — which never exchanges the
// code for a session, so the visitor arrived back logged out and any protected
// page bounced them to /login. It looked exactly like "I sign in and it returns
// me to the login page".
//
// A cookie avoids the allow-list entirely, and keeps the redirect target off a
// URL that gets logged by two other parties on its way through Google.
export async function loginWithGoogle(formData?: FormData) {
  const origin = await getRequestOrigin();
  const next = safeNext(formData?.get("next"));

  // Only written when there is somewhere specific to go, so the ordinary
  // sign-in path sets no cookie at all.
  if (next !== "/") {
    const cookieStore = await cookies();
    cookieStore.set(OAUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Long enough to pick a Google account, short enough that a stale value
      // cannot resurface on an unrelated sign-in days later.
      maxAge: 600,
    });
  }

  const { url, error } = await signInWithGoogle(`${origin}/auth/callback`);

  if (error || !url) {
    redirect("/login?error=oauth");
  }

  redirect(url);
}

export async function logout() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ---- Password recovery ----------------------------------------------------

// Asks Supabase to email a recovery link.
//
// **Always reports the same outcome**, whether or not the address is registered.
// Reporting "no such user" would turn this form into a way to test whether any
// given person has an account here, which is exactly what an enumeration oracle
// is. The one exception is the rate limit, which is a fact about the caller's own
// request rather than about somebody else's account — and staying silent there
// would leave them re-submitting a form that cannot work yet.
export async function requestPasswordReset(
  _state: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const origin = await getRequestOrigin();
  const { error } = await sendPasswordReset(
    parsed.data.email,
    `${origin}/reset/confirm`,
  );

  // Supabase's built-in mailer allows only a few messages an hour on the free
  // tier, so this is a state real users will hit rather than a theoretical one.
  if (error && /rate limit|too many/i.test(error)) {
    return {
      message:
        "נשלחו יותר מדי בקשות. השירות החינמי מגביל את מספר המיילים בשעה — נסו שוב בעוד כמה דקות.",
    };
  }

  if (error) console.error("requestPasswordReset failed:", error);

  return { sent: true };
}

// Sets the new password. Requires a session, which the recovery link creates
// when /reset/confirm exchanges its code — so an unauthenticated caller here has
// no link, and gets told to start over rather than being handed a form to fill.
export async function setNewPassword(
  _state: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  // A Google account has no password, and is not given one here.
  //
  // Checked at this point and not on the request form: on the form it would be
  // an oracle — type any address and learn whether that person has an account
  // and how they sign in. Here the caller has already proved control of the
  // mailbox by following the emailed link, so telling them how their own account
  // works discloses nothing they could not already see, and is the only useful
  // thing to say. Somebody who forgot they signed up with Google is otherwise
  // stuck at a form that keeps failing.
  if (!(await hasPasswordIdentity())) {
    return {
      message:
        "החשבון הזה נכנס דרך Google ואין לו סיסמה. חזרו לדף ההתחברות ובחרו ״המשך עם Google״.",
    };
  }

  const { error } = await updatePassword(parsed.data.password);

  if (error) {
    // The most common real failure is an expired or already-used link, which
    // reaches here as a missing session rather than as a password problem.
    if (/session|jwt|token/i.test(error)) {
      return {
        message:
          "הקישור פג או שכבר נעשה בו שימוש. בקשו קישור חדש ונסו שוב.",
      };
    }
    if (/should be different|same as/i.test(error)) {
      return { message: "הסיסמה החדשה זהה לקודמת. בחרו סיסמה אחרת." };
    }
    return { message: "עדכון הסיסמה נכשל. נסו שוב." };
  }

  revalidatePath("/", "layout");
  return { done: true };
}
