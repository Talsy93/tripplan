import { redirect } from "next/navigation";

// There is no landing page (2026-09-23): the first page is "הטיולים שלי".
// Someone signed out is sent on from there to /login by the middleware, and
// someone with no trips gets the explanation that used to live here — see
// AppIntro. `/` stays a public route so this redirect is what runs for both.
export default function HomePage() {
  redirect("/profile");
}
