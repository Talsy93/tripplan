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
  // Development-only harness; the pages themselves 404 outside development.
  "/preview",
];

function isPublicRoute(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

// How much life a token must have left for this middleware to trust it without
// asking Supabase. A minute covers the render that follows: a token expiring
// inside it would be refused by PostgREST halfway through the page, and it is
// better to refresh here, once, than to have half a screen come back empty.
const MIN_TOKEN_LIFETIME_SECONDS = 60;

// What the request's cookies say about the session, without asking anybody:
//
//   none     — no auth cookie at all, so there is certainly no session
//   unknown  — a cookie in a shape this file cannot read; assume nothing
//   token    — a stored token, with the seconds left on it
type SessionState =
  | { kind: "none" }
  | { kind: "unknown" }
  | { kind: "token"; expiresIn: number };

// Supabase stores the session in `sb-<project-ref>-auth-token`, split across
// `.0`, `.1`, … when it outgrows one cookie. The chunks are numbered, so
// sorting by name puts them back in order.
function readSessionCookie(request: NextRequest): string | null {
  const chunks = request.cookies
    .getAll()
    .filter(({ name }) => /^sb-.+-auth-token(\.\d+)?$/.test(name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (chunks.length === 0) return null;
  return chunks.map(({ value }) => value).join("");
}

function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    // atob yields one character per byte; the session carries the account's own
    // metadata, which is UTF-8 and does not survive being read as latin-1.
    return new TextDecoder().decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

// The `exp` claim of a JWT, read without verifying it. The fallback for the
// older cookie shape, which stored the access token alone rather than the whole
// session object.
function jwtExpiry(token: string): number | null {
  const parts = token.replace(/^"|"$/g, "").split(".");
  if (parts.length !== 3) return null;

  const payload = decodeBase64(parts[1]);
  if (!payload) return null;

  try {
    const exp = (JSON.parse(payload) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

// Reads the stored session's expiry out of the cookie. It verifies no signature
// and trusts no claim — see the note in `updateSession` for why that is the
// right amount of work here.
function readSessionState(request: NextRequest): SessionState {
  const raw = readSessionCookie(request);
  if (!raw) return { kind: "none" };

  const json = raw.startsWith("base64-") ? decodeBase64(raw.slice(7)) : raw;
  if (!json) return { kind: "unknown" };

  let expiresAt: number | null = null;
  try {
    const stored = (JSON.parse(json) as { expires_at?: unknown }).expires_at;
    expiresAt = typeof stored === "number" ? stored : null;
  } catch {
    expiresAt = jwtExpiry(json);
  }

  if (expiresAt === null) return { kind: "unknown" };
  return {
    kind: "token",
    expiresIn: expiresAt - Math.floor(Date.now() / 1000),
  };
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = readSessionState(request);

  // The fast path, and the reason this file is shaped the way it is.
  //
  // This runs on *every* request the app makes: each navigation, each `<Link>`
  // prefetch, each Server Action, each API call. Calling
  // `supabase.auth.getUser()` in all of them is a round trip to Supabase's auth
  // server before the page has begun rendering, every single time — the fixed
  // cost that sat under every tab switch in the trip workspace.
  //
  // What this middleware actually decides is one thing: whether to send an
  // anonymous visitor to /login. That is a routing decision, not an
  // authorisation one — reaching a page discloses nothing. The data on it comes
  // back through PostgREST, which verifies the JWT's signature itself and
  // answers an expired or forged one with nothing, and through RLS, which
  // scopes every row to the account named in that JWT. Server Actions and the
  // /api routes call `getUser()` themselves before they write.
  //
  // So a live-looking token is enough to let the request through, and its
  // expiry can be read out of the cookie without leaving the machine. Someone
  // who signed out on another device keeps reaching the app's chrome until
  // their token expires — and finds nothing in it, because the database will
  // not serve them a row.
  if (
    session.kind === "token" &&
    session.expiresIn > MIN_TOKEN_LIFETIME_SECONDS
  ) {
    return NextResponse.next({ request });
  }

  // No cookie at all is the other answer this file can give on its own: there is
  // no session to refresh and nobody to ask about. An anonymous visitor to a
  // private page is redirected without a network call, and the share and invite
  // links — read by people who have no account, by design — stop paying for an
  // auth lookup that was always going to come back empty.
  if (session.kind === "none") {
    if (isPublicRoute(pathname) || pathname.startsWith("/api")) {
      return NextResponse.next({ request });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // The slow path: a token about to expire, or a cookie this file could not
  // read. Here the round trip is the point — `getUser()` refreshes the session
  // and writes the new cookies back.
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

  // API routes enforce their own auth and return JSON status codes — never
  // redirect them to the HTML login page. Session refresh above still applies.
  if (!user && !isPublicRoute(pathname) && !pathname.startsWith("/api")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
