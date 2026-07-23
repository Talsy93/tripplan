import Link from "next/link";
import { CredentialsForm, GoogleButton, signup } from "@/features/auth";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <CredentialsForm action={signup} title="הרשמה" submitLabel="הרשמה" />
      <div className="flex w-full max-w-sm items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        או
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <GoogleButton />
      <p className="text-sm text-gray-500">
        כבר יש חשבון?{" "}
        <Link href="/login" className="underline">
          התחברות
        </Link>
      </p>
    </main>
  );
}
