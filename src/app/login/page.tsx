import Link from "next/link";
import { CredentialsForm, GoogleButton, login } from "@/features/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <CredentialsForm action={login} title="התחברות" submitLabel="התחברות" />
      {error === "oauth" && (
        <p className="text-sm text-red-600">
          ההתחברות עם Google נכשלה. נסו שוב.
        </p>
      )}
      <div className="flex w-full max-w-sm items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        או
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <GoogleButton />
      <p className="text-sm text-gray-500">
        אין עדיין חשבון?{" "}
        <Link href="/signup" className="underline">
          הרשמה
        </Link>
      </p>
    </main>
  );
}
