import Link from "next/link";
import { CredentialsForm, GoogleButton, safeNext, signup } from "@/features/auth";
import { Card } from "@/components/ui";
import { PageEnter } from "@/components/layout";

export const metadata = { title: "הרשמה · MyTrip" };

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
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <PageEnter className="gap-4 p-6 sm:p-8">
          <CredentialsForm
            action={signup}
            title="הרשמה"
            submitLabel="הרשמה"
            next={carry ?? undefined}
            requirePrivacy
          />

          <div className="flex items-center gap-3 text-caption text-muted">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton next={carry ?? undefined} />

          {/* The Google path never sees the checkbox above — it leaves the site
              before any form is submitted, so there is nothing to validate. The
              consent is stated as a consequence of the action instead, which is
              the usual pattern for provider sign-in. Gating the button itself
              would mean lifting the checkbox out of the credentials form and
              sharing its state, and would also block returning users who are
              signing in rather than signing up. */}
          <p className="text-caption text-muted">
            בהמשך דרך Google אתם מאשרים את{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary-ink hover:underline"
            >
              מדיניות הפרטיות
            </Link>
            .
          </p>
        </PageEnter>

        <p className="border-t border-border bg-surface-2 p-4 text-center text-sm text-muted">
          כבר יש חשבון?{" "}
          <Link
            href={
              carry ? `/login?next=${encodeURIComponent(carry)}` : "/login"
            }
            className="font-semibold text-primary-ink hover:underline"
          >
            התחברות
          </Link>
        </p>
      </Card>
    </main>
  );
}
