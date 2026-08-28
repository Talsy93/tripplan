import Link from "next/link";
import { CredentialsForm, GoogleButton, login, safeNext } from "@/features/auth";
import { Banner, Card } from "@/components/ui";

export const metadata = { title: "התחברות · MyTrip" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: requested } = await searchParams;
  // Validated here as well as on submit, so a hostile value never reaches the
  // markup. "/" is the default and means "nothing was asked for".
  const next = safeNext(requested);
  const carry = next === "/" ? null : next;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <CredentialsForm
            action={login}
            title="התחברות"
            submitLabel="התחברות"
            next={carry ?? undefined}
          />

          {error === "oauth" && (
            <Banner tone="danger">
              ההתחברות עם Google נכשלה. נסו שוב.
            </Banner>
          )}

          <div className="flex items-center gap-3 text-caption text-muted">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton next={carry ?? undefined} />

          {/* Below the sign-in options rather than beside the password field:
              somebody who knows their password should not be offered a reset on
              the way to typing it. Until phase K there was no recovery flow at
              all, which meant a forgotten password locked the account for good. */}
          <Link
            href="/reset"
            className="self-center rounded-control text-caption text-muted hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            שכחתם סיסמה?
          </Link>
        </div>

        <p className="border-t border-border bg-surface-2 p-4 text-center text-sm text-muted">
          אין עדיין חשבון?{" "}
          <Link
            href={
              carry ? `/signup?next=${encodeURIComponent(carry)}` : "/signup"
            }
            className="font-semibold text-primary-ink hover:underline"
          >
            הרשמה
          </Link>
        </p>
      </Card>
    </main>
  );
}
