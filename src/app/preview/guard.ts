import { notFound } from "next/navigation";

// The preview harness must not exist outside development.
//
// It renders real screens with fabricated data and no session, so in production
// it would be a way to see the app's chrome without an account — and, worse, a
// surface that changes as components change while nobody is looking at it.
//
// `notFound()` rather than a redirect: in production the route should be
// indistinguishable from one that was never written.
//
// This is checked in every entry point rather than in the middleware alone. The
// middleware decides whether a request is allowed through; this decides whether
// the page exists at all, and the two failing independently is the point.
export function developmentOnly() {
  if (process.env.NODE_ENV !== "development") notFound();
}
