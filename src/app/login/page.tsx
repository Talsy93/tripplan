import Link from "next/link";
import { CredentialsForm, GoogleButton, login } from "@/features/auth";
import { Card } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="flex w-full max-w-sm flex-col gap-4 p-6 sm:p-8">
        <CredentialsForm action={login} title="התחברות" submitLabel="התחברות" />
        {error === "oauth" && (
          <p className="text-sm text-red-600">
            ההתחברות עם Google נכשלה. נסו שוב.
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          או
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton />
        <p className="text-center text-sm text-muted">
          אין עדיין חשבון?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            הרשמה
          </Link>
        </p>
      </Card>
    </main>
  );
}
