import Link from "next/link";
import { Banner, Card, buttonClasses } from "@/components/ui";
import {
  NewPasswordForm,
  exchangeCodeForSession,
  getCurrentUser,
} from "@/features/auth";

export const metadata = { title: "סיסמה חדשה · MyTrip" };

// Where the recovery email lands.
//
// This route does its own code exchange rather than going through
// /auth/callback, and that is deliberate. The callback would have to be told
// "this is a recovery, send them to the password form afterwards", and the only
// place to put that is a query parameter on the URL Supabase redirects to — the
// exact thing that broke Google sign-in in phase K, because Supabase matches
// that URL against the project's Redirect URLs allow-list and an entry with no
// wildcard does not match a URL carrying a query string.
//
// **This URL must therefore be in that allow-list itself.** Supabase dashboard →
// Authentication → URL Configuration → Redirect URLs, one entry per origin:
//   https://tripplan-ten.vercel.app/reset/confirm
//   http://localhost:3000/reset/confirm
// Without it Supabase drops the visitor on the Site URL with no session, and the
// form below correctly refuses to render.
//
// A cookie could not carry the intent here the way it does for OAuth: the email
// is very often opened on a different device from the one that asked for it, and
// a cookie set in one browser is not present in the other.
export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error_description?: string }>;
}) {
  const { code, error_description } = await searchParams;

  // The link's code becomes a session — a short-lived one that authorises
  // exactly this: changing the password. It is consumed on first use, which is
  // why the form below warns that the link is single-use.
  if (code) await exchangeCodeForSession(code);

  const user = await getCurrentUser();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          {user ? (
            <NewPasswordForm mode="recover" onDoneHref="/profile" />
          ) : (
            <>
              <h1 className="text-heading font-bold">הקישור לא תקף</h1>
              <Banner tone="danger">
                {error_description
                  ? error_description
                  : "הקישור פג, כבר נעשה בו שימוש, או שנפתח בדפדפן אחר מזה שביקש אותו. בקשו קישור חדש."}
              </Banner>
              <Link
                href="/reset"
                className={buttonClasses("primary", "md", "self-start")}
              >
                בקשת קישור חדש
              </Link>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
