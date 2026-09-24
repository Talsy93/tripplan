import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, Eye, Luggage, Mail, PencilLine } from "lucide-react";
import { Banner, buttonClasses } from "@/components/ui";
import { PageEnter } from "@/components/layout";
import { getCurrentUser, logout } from "@/features/auth";
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
//
// Laid out as design/pencil/exports/invite-mobile: the wordmark, a card with
// the teal top, the role box, and the terracotta button at the foot. The
// design's inviter avatar and its three facts (cities, travellers, days) are
// not drawn — peek_trip_invite deliberately returns none of them, and widening
// what an unauthenticated token reveals is not a styling decision.
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
  const role = TRIP_ROLES[invite.role];
  const RoleIcon = invite.role === "editor" ? PencilLine : Eye;
  const back = encodeURIComponent(`/invite/${token}`);

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pb-8 pt-10">
      <PageEnter className="w-full max-w-sm flex-1 gap-6">
        <span className="flex items-center justify-center gap-2 text-lg font-bold text-foreground">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[image:var(--hero-gradient)] text-white"
          >
            <Compass className="h-[18px] w-[18px]" />
          </span>
          MyTrip
        </span>

        <section className="overflow-hidden rounded-3xl bg-surface shadow-card">
          <div className="flex flex-col items-center gap-3 bg-[image:var(--hero-gradient)] px-6 pb-7 pt-6 text-center text-white">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cta ring-[3px] ring-white"
            >
              <Luggage className="h-6 w-6" />
            </span>
            <p className="text-sm text-white/80">הוזמנתם לטיול</p>
            <h1 className="text-[26px] font-bold leading-tight wrap-anywhere">
              {invite.tripName}
            </h1>
          </div>

          <div className="flex flex-col gap-3 p-5">
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                ההזמנה נשלחה ל
                <span dir="ltr" className="ms-1 font-semibold text-foreground wrap-anywhere">
                  {invite.email}
                </span>
              </span>
            </p>
            <div className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 p-3.5 text-sm">
              <RoleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p className="min-w-0 text-muted">
                <span className="block font-semibold text-foreground">{role.label}</span>
                {role.hint}
              </p>
            </div>
          </div>
        </section>

        {user && !rightAccount && (
          <Banner tone="callout">
            אתם מחוברים כ
            <span dir="ltr" className="mx-1 font-semibold">
              {user.email}
            </span>
            , וההזמנה נשלחה לכתובת אחרת. צריך להתחבר עם החשבון שאליו נשלחה
            ההזמנה, או לבקש ממי שהזמין אתכם הזמנה חדשה לכתובת הזו.
          </Banner>
        )}

        {/* The action at the foot, as in the export. */}
        <div className="mt-auto flex flex-col gap-3">
          {rightAccount && <AcceptInvite token={token} />}

          {!user && (
            <>
              <p className="text-center text-sm text-muted">
                כדי להצטרף צריך חשבון עם המייל שאליו נשלחה ההזמנה. אחרי
                ההתחברות תחזרו לכאן.
              </p>
              {/* The token is carried through so the invitee comes back here
                  rather than landing on their (empty) trip list and having to
                  find the original message again. */}
              <Link
                href={`/signup?next=${back}`}
                className={buttonClasses("primary", "lg", "h-14 w-full rounded-full text-base")}
              >
                יצירת חשבון
              </Link>
              <Link
                href={`/login?next=${back}`}
                className={buttonClasses(
                  "outline",
                  "lg",
                  "h-13 w-full rounded-full border border-border bg-surface text-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                יש לי חשבון — התחברות
              </Link>
            </>
          )}

          {user && !rightAccount && (
            <Link
              href="/profile"
              className={buttonClasses(
                "outline",
                "lg",
                "h-13 w-full rounded-full border border-border bg-surface text-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              לטיולים שלי
            </Link>
          )}

          {user && (
            <form
              action={logout}
              className="flex flex-wrap items-center justify-center gap-1 text-caption text-outline"
            >
              <span>
                מחוברים בתור{" "}
                <span dir="ltr" className="wrap-anywhere">
                  {user.email}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="submit"
                className="rounded-full font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                לא אתם?
              </button>
            </form>
          )}
        </div>
      </PageEnter>
    </main>
  );
}
