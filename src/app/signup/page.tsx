import Link from "next/link";
import { CredentialsForm, GoogleButton, signup } from "@/features/auth";
import { Card } from "@/components/ui";

export const metadata = { title: "הרשמה · MyTrip" };

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <CredentialsForm action={signup} title="הרשמה" submitLabel="הרשמה" />

          <div className="flex items-center gap-3 text-caption text-muted">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton />
        </div>

        <p className="border-t border-border bg-surface-2 p-4 text-center text-sm text-muted">
          כבר יש חשבון?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-ink hover:underline"
          >
            התחברות
          </Link>
        </p>
      </Card>
    </main>
  );
}
