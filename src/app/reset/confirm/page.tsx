import Link from "next/link";
import { Link2Off } from "lucide-react";
import { Banner, buttonClasses } from "@/components/ui";
import {
  AuthNotice,
  AuthShell,
  authSubmit,
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
    <AuthShell>
      {user ? (
        <NewPasswordForm />
      ) : (
        <AuthNotice icon={<Link2Off />} title="הקישור לא תקף">
          <Banner tone="danger" className="text-start">
            {error_description
              ? error_description
              : "הקישור פג, כבר נעשה בו שימוש, או שנפתח בדפדפן אחר מזה שביקש אותו. בקשו קישור חדש."}
          </Banner>
          <Link
            href="/reset"
            className={buttonClasses("primary", "lg", `${authSubmit} mt-2`)}
          >
            בקשת קישור חדש
          </Link>
        </AuthNotice>
      )}
    </AuthShell>
  );
}
