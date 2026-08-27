// Where to go after signing in.
//
// Added for invite links: someone who opens /invite/<token>, has no account, and
// signs up used to land on "/" — with the invitation still unredeemed and the
// original WhatsApp message the only way back to it. The token rides through
// login as ?next=.
//
// A redirect target that arrives in a URL is attacker-controlled, so this is a
// security boundary and not a convenience. The classic bug is an open redirect:
// `/login?next=https://evil.example/login` renders a real login page on the real
// domain that hands the visitor to a copy afterwards, which is exactly the shape
// a phishing link wants. So the value is not sanitised into something safe —
// anything that is not already a plain in-app path is refused outright and
// replaced by the default.

const DEFAULT_DESTINATION = "/";

// The ASCII control block plus the space, by character code rather than by a
// regex character class.
//
// Deliberately not `/[\s-]/`, which was the first attempt and rejected every
// path containing a hyphen — which is most of them. Writing the boundary as a
// number says exactly what is meant and cannot be misread.
//
// Tab, newline and NUL are the ones that matter: browsers, proxies and routers
// disagree about whether to strip them, so a value like "/<TAB>javascript:..."
// can be read two different ways in two places along the same request.
function hasUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x20) return true;
  }
  return false;
}

// Only a path on this site. Rejected, specifically:
//
//   * "https://evil.example/..."  — absolute, another origin
//   * "//evil.example/..."        — protocol-relative; browsers treat this as an
//                                  absolute URL, and it is the case a naive
//                                  `startsWith("/")` check lets through
//   * "/\evil.example"            — some parsers normalise the backslash to a
//                                  slash, making it protocol-relative again
//   * "javascript:..."            — not a path at all
//   * anything not starting with "/"
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_DESTINATION;

  const trimmed = value.trim();
  if (trimmed === "" || !trimmed.startsWith("/")) return DEFAULT_DESTINATION;

  // The second character decides whether this is a path or a disguised origin.
  const second = trimmed[1];
  if (second === "/" || second === "\\") return DEFAULT_DESTINATION;

  if (hasUnsafeCharacter(trimmed)) return DEFAULT_DESTINATION;

  return trimmed;
}

// The cookie that carries the post-sign-in destination across an OAuth round
// trip.
//
// It lives here, and not next to loginWithGoogle, because a `"use server"`
// module may only export async functions — exporting a string constant from one
// is a build error. The callback route reads it too, so a shared module is the
// right home regardless.
//
// Why a cookie at all: the destination used to be appended to the Supabase
// `redirectTo` as `?next=…`, and that broke Google sign-in in production.
// Supabase matches redirectTo against the project's Redirect URLs allow-list,
// whose entry is the bare `/auth/callback`; a URL with a query string does not
// match, so Supabase fell back to the Site URL, the code was never exchanged for
// a session, and the visitor came back signed out.
export const OAUTH_NEXT_COOKIE = "mytrip-oauth-next";
