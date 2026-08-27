import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OAUTH_NEXT_COOKIE,
  exchangeCodeForSession,
  safeNext,
} from "@/features/auth";

// Where Google sends the visitor back.
//
// The post-sign-in destination arrives in a cookie, not in the query string.
// It used to be `?next=…` on this URL, which broke Google sign-in entirely:
// Supabase validates the `redirectTo` it is given against the project's Redirect
// URLs allow-list, and that list holds the bare `/auth/callback`. A URL carrying
// a query string did not match, so Supabase redirected to the Site URL instead —
// which is not this route, so the code was never exchanged for a session and the
// visitor arrived back logged out.
//
// `?next=` is still read as a fallback, because a Supabase project configured
// with a wildcard entry may legitimately deliver it that way, and because a link
// minted by the previous deployment may still be in flight.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  // Validated even though this app wrote it: an httpOnly cookie is not
  // attacker-controlled in the usual sense, but safeNext is cheap and the
  // guarantee should not depend on where the value came from.
  const next = safeNext(
    cookieStore.get(OAUTH_NEXT_COOKIE)?.value ?? searchParams.get("next"),
  );

  if (code) {
    const { error } = await exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      const destination =
        isLocalEnv || !forwardedHost
          ? `${origin}${next}`
          : `https://${forwardedHost}${next}`;

      const response = NextResponse.redirect(destination);
      // Single-use: it has been spent, and leaving it set would silently
      // redirect an unrelated sign-in ten minutes later.
      response.cookies.delete(OAUTH_NEXT_COOKIE);
      return response;
    }
  }

  const failed = NextResponse.redirect(`${origin}/login?error=oauth`);
  failed.cookies.delete(OAUTH_NEXT_COOKIE);
  return failed;
}
