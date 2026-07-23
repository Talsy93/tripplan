"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { credentialsSchema, type AuthFormState } from "../domain/schemas";
import {
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
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
  const parsed = parseCredentials(formData);

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { error, needsEmailConfirmation } = await signUpWithPassword(
    parsed.data,
  );

  if (error) {
    return { message: toHebrewAuthError(error) };
  }

  if (needsEmailConfirmation) {
    return { message: "נשלח אליכם מייל לאישור הכתובת. בדקו את תיבת הדואר." };
  }

  revalidatePath("/", "layout");
  redirect("/");
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
  redirect("/");
}

export async function loginWithGoogle() {
  const origin = await getRequestOrigin();
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
