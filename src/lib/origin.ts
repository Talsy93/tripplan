import { headers } from "next/headers";

// The site's own origin, from the request.
//
// Exists because reading `window.location.origin` in a client component's body
// crashes: such a component is still server-rendered for the initial HTML, and
// `window` is not defined there. That bug shipped in ShareTrip and only affected
// people who had already created a share link, because the expression sat behind
// a `token ?` guard and was never evaluated otherwise.
//
// Derived from the request rather than from an environment variable on purpose,
// which is the property the original approach was protecting: the link is
// correct on localhost, on a Vercel preview deployment and in production without
// any of the three being configured.
export async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();

  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  // `x-forwarded-host` is what Vercel sets; `host` is what a local dev server
  // sees. The protocol has to be taken from the forwarded header too, or every
  // production link would be built as http.
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
