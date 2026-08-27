import { NextResponse } from "next/server";
import { exchangeCodeForSession, safeNext } from "@/features/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validated rather than trusted: this value survived a round trip through
  // Google and arrives as a query parameter, which makes it attacker-controlled
  // exactly like the form field. safeNext refuses anything that is not a plain
  // in-app path.
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const { error } = await exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
