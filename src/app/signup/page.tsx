import Link from "next/link";
import {
  AuthDivider,
  AuthShell,
  CredentialsForm,
  GoogleButton,
  safeNext,
  signup,
} from "@/features/auth";

export const metadata = { title: "הרשמה · MyTrip" };

// Sign-up, in the same frame as sign-in (design/pencil/exports/login-mobile):
// only the tagline, the consent line and the footer link differ.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  // Validated here as well as on submit, so a hostile value never reaches the
  // markup — the hidden field and the "already have an account" link both carry
  // it, and neither should ever hold an absolute URL.
  const next = safeNext(params.next);
  // "/" is the default and means "nothing was asked for", so there is nothing to
  // carry through to the login link.
  const carry = next === "/" ? null : next;

  return (
    <AuthShell
      tagline="חשבון חדש — ומתחילים לתכנן"
      footer={
        <>
          כבר יש לכם חשבון?{" "}
          <Link
            href={carry ? `/login?next=${encodeURIComponent(carry)}` : "/login"}
            className="rounded-full font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            התחברות
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <GoogleButton next={carry ?? undefined} />
          {/* The Google path never sees the checkbox below — it leaves the site
              before any form is submitted, so there is nothing to validate. The
              consent is stated as a consequence of the action instead, which is
              the usual pattern for provider sign-in. Gating the button itself
              would mean lifting the checkbox out of the credentials form and
              sharing its state, and would also block returning users who are
              signing in rather than signing up. */}
          <p className="text-center text-caption text-outline">
            בהמשך דרך Google אתם מאשרים את{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              מדיניות הפרטיות
            </Link>
            .
          </p>
        </div>

        <AuthDivider />

        <CredentialsForm
          action={signup}
          title="הרשמה"
          submitLabel="הרשמה"
          next={carry ?? undefined}
          requirePrivacy
        />
      </div>
    </AuthShell>
  );
}
