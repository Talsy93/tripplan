import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without an authenticated session.
//
// `/share` is the read-only public view of a trip (migration 0015). It is
// authenticated by the token in its own URL rather than by a session, and it
// must stay reachable without one — redirecting it to /login would defeat the
// entire feature. The page itself reads through a redacting service and
// renders nothing a stranger should not see; see infrastructure/share-service.ts.
//
// `/invite` is an invitation to join a trip (migration 0018), and it exists
// precisely for someone who does not have an account yet. Sending it to /login
// would show them a sign-in form with no explanation of what they were invited
// to — so the page states what the invitation is for first, then sends them on
// with ?next= pointing back at itself. It discloses only the trip's name and the
// offered role, and only to someone already holding a 128-bit token.
//
// `/reset` is password recovery, which by definition belongs to somebody who
// cannot sign in. `/reset/confirm` is under it and must stay public too: it
// arrives with a code in the URL and mints its own session by exchanging it, so
// at the moment the request hits this middleware there is genuinely no session
// yet — sending it to /login would break the flow one step before it works.
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/auth",
  "/share",
  "/invite",
  "/reset",
  "/privacy",
];

function isPublicRoute(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(): getUser()
  // refreshes the auth token and writes the refreshed cookies onto
  // supabaseResponse. Anything in between risks dropping the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // API routes enforce their own auth and return JSON status codes — never
  // redirect them to the HTML login page. Session refresh above still applies.
  if (!user && !isPublicRoute(pathname) && !pathname.startsWith("/api")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
