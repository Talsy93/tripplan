import Link from "next/link";
import {
  AuthDivider,
  AuthShell,
  CredentialsForm,
  GoogleButton,
  login,
  safeNext,
} from "@/features/auth";
import { Banner } from "@/components/ui";

export const metadata = { title: "התחברות · MyTrip" };

// Sign-in, as design/pencil/exports/login-mobile lays it out: the wordmark,
// Google first as the outlined pill, "או במייל", the fields with "שכחתי
// סיסמה" under the password, and the one terracotta button.
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
    <AuthShell
      footer={
        <>
          אין לכם חשבון?{" "}
          <Link
            href={carry ? `/signup?next=${encodeURIComponent(carry)}` : "/signup"}
            className="rounded-full font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            הרשמה
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <GoogleButton next={carry ?? undefined} />

        {error === "oauth" && (
          <Banner tone="danger">ההתחברות עם Google נכשלה. נסו שוב.</Banner>
        )}

        <AuthDivider />

        <CredentialsForm
          action={login}
          title="התחברות"
          submitLabel="כניסה"
          next={carry ?? undefined}
          forgotHref="/reset"
        />
      </div>
    </AuthShell>
  );
}
