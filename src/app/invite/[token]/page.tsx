import Link from "next/link";
import { notFound } from "next/navigation";
import { Plane } from "lucide-react";
import { Banner, Card, buttonClasses } from "@/components/ui";
import { PageEnter } from "@/components/layout";
import { getCurrentUser } from "@/features/auth";
import {
  AcceptInvite,
  TRIP_ROLES,
  isShareToken,
  peekInvite,
} from "@/features/trips";

export const metadata = { title: "הזמנה לטיול · MyTrip" };

// Where an invite link lands.
//
// Reachable without a session (see PUBLIC_ROUTES in lib/supabase/middleware.ts):
// the whole point is that the recipient probably has no account yet, and sending
// them to /login with no explanation asks them to trust an unexplained URL. So
// this page says what the invitation is for *before* asking for anything, using
// peek_trip_invite — which returns the trip's name, the offered role and the
// invited email, and nothing else about the trip.
//
// Four states, and they are genuinely different:
//   * bad or spent token          → 404, indistinguishable from a wrong guess
//   * not signed in               → what this is, then sign in / sign up
//   * signed in as the wrong user → say which account is needed, and which is in
//                                   use, because otherwise this is unsolvable
//   * signed in as the right user → one button
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Shape-checked before the database is touched, and a malformed token gets the
  // same 404 as a well-formed one that does not exist — the two must not be
  // distinguishable, or the response becomes an oracle for guessing.
  if (!isShareToken(token)) notFound();

  const [invite, user] = await Promise.all([peekInvite(token), getCurrentUser()]);
  if (!invite) notFound();

  const signedInEmail = user?.email?.toLowerCase() ?? null;
  const invitedEmail = invite.email.toLowerCase();
  const rightAccount = signedInEmail !== null && signedInEmail === invitedEmail;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-md">
        <PageEnter className="gap-4 p-6 sm:p-8">
          <span className="flex items-center gap-1.5 font-bold text-brand">
            <Plane className="h-5 w-5" aria-hidden="true" />
            MyTrip
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-title font-bold wrap-anywhere">
              הוזמנתם לטיול ״{invite.tripName}״
            </h1>
            <p className="text-sm text-muted">
              {TRIP_ROLES[invite.role].hint}
            </p>
          </div>

          <p className="text-sm text-muted">
            ההזמנה נשלחה ל
            <span dir="ltr" className="mx-1 font-semibold wrap-anywhere">
              {invite.email}
            </span>
            .
          </p>

          {rightAccount && <AcceptInvite token={token} />}

          {!user && (
            <>
              <Banner tone="info">
                כדי להצטרף צריך חשבון עם האימייל שאליו נשלחה ההזמנה. אחרי
                ההתחברות תחזרו לכאן.
              </Banner>
              <div className="flex flex-wrap gap-2">
                {/* The token is carried through so the invitee comes back here
                    rather than landing on their (empty) trip list and having to
                    find the original message again. */}
                <Link
                  href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className={buttonClasses("primary", "md")}
                >
                  יצירת חשבון
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className={buttonClasses("outline", "md")}
                >
                  התחברות
                </Link>
              </div>
            </>
          )}

          {user && !rightAccount && (
            <>
              <Banner tone="callout">
                אתם מחוברים כ
                <span dir="ltr" className="mx-1 font-semibold">
                  {user.email}
                </span>
                , וההזמנה נשלחה לכתובת אחרת. צריך להתחבר עם החשבון שאליו נשלחה
                ההזמנה, או לבקש ממי שהזמין אתכם הזמנה חדשה לכתובת הזו.
              </Banner>
              <Link
                href="/profile"
                className={buttonClasses("outline", "md", "self-start")}
              >
                לטיולים שלי
              </Link>
            </>
          )}
        </PageEnter>
      </Card>
    </main>
  );
}
