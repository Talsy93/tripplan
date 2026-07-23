import Link from "next/link";
import { CredentialsForm, GoogleButton, signup } from "@/features/auth";
import { Card } from "@/components/ui";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="flex w-full max-w-sm flex-col gap-4 p-6 sm:p-8">
        <CredentialsForm action={signup} title="הרשמה" submitLabel="הרשמה" />
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          או
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton />
        <p className="text-center text-sm text-muted">
          כבר יש חשבון?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            התחברות
          </Link>
        </p>
      </Card>
    </main>
  );
}
