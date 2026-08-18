import Link from "next/link";
import { CredentialsForm, GoogleButton, login } from "@/features/auth";
import { Banner, Card } from "@/components/ui";

export const metadata = { title: "התחברות · TripPlan" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <CredentialsForm
            action={login}
            title="התחברות"
            submitLabel="התחברות"
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

          <GoogleButton />
        </div>

        <p className="border-t border-border bg-surface-2 p-4 text-center text-sm text-muted">
          אין עדיין חשבון?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary-ink hover:underline"
          >
            הרשמה
          </Link>
        </p>
      </Card>
    </main>
  );
}
