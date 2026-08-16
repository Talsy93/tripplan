import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets:
     * - _next/static, _next/image (build output)
     * - favicon and common image files
     * - manifest.json and sw.js — the two files that make the app installable
     *   and able to receive push notifications.
     *
     * The last two are not a convenience. Both are fetched by the browser
     * itself, with no session attached, so without this they were answered with
     * a 307 to /login: the service worker never registered and the app was not
     * installable, which on iOS means push cannot work at all. It failed
     * silently — the redirect looks like a normal response until you check the
     * status. Verified with curl; both now return 200.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
