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
