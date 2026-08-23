import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without an authenticated session.
//
// `/share` is the read-only public view of a trip (migration 0015). It is
// authenticated by the token in its own URL rather than by a session, and it
// must stay reachable without one — redirecting it to /login would defeat the
// entire feature. The page itself reads through a redacting service and
// renders nothing a stranger should not see; see infrastructure/share-service.ts.
const PUBLIC_ROUTES = ["/login", "/signup", "/auth", "/share"];

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
