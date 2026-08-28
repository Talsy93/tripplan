import { createClient } from "@/lib/supabase/server";
import type { Credentials } from "../domain/schemas";

export async function signUpWithPassword(credentials: Credentials) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials);

  return {
    error: error?.message ?? null,
    // When email confirmation is enabled, signUp succeeds without a session.
    needsEmailConfirmation: !error && data.session === null,
  };
}

export async function signInWithPassword(credentials: Credentials) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  return { error: error?.message ?? null };
}

export async function signInWithGoogle(redirectTo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  return { url: data.url ?? null, error: error?.message ?? null };
}

export async function exchangeCodeForSession(code: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  return { error: error?.message ?? null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return data.user;
}

// ---- Password recovery ----------------------------------------------------

// Sends the recovery email. `redirectTo` must be registered in the Supabase
// project's Redirect URLs allow-list, or Supabase silently falls back to the
// Site URL — the same trap that broke Google sign-in in phase K.
export async function sendPasswordReset(email: string, redirectTo: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  return { error: error?.message ?? null };
}

// Sets a password on the current session's user.
//
// This is the only way a Google account gains a password: signing in with a
// provider creates a user with no password at all, so "email + password" for
// that account has nothing to compare against until this runs.
export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  return { error: error?.message ?? null };
}

// Whether the caller has a password identity, so the UI can say "set a password"
// to a Google-only account and "change password" to one that already has one.
//
// Read from the identities array rather than from a column: Supabase does not
// expose "has a password" directly, but an email/password account always carries
// an identity with provider "email".
export async function hasPasswordIdentity() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const identities = data.user?.identities ?? [];
  return identities.some((identity) => identity.provider === "email");
}
