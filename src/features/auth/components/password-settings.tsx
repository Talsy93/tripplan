import { ChevronDown, KeyRound } from "lucide-react";
import { Card } from "@/components/ui";
import { NewPasswordForm } from "./new-password-form";

// Password settings on the home screen.
//
// Two audiences, and the difference is the whole reason this exists:
//
//   * `hasPassword: false` — the account has only ever signed in with Google, so
//     it has no password at all. Supabase creates no password for a provider
//     sign-in, which is why "email + password" for such an account fails with
//     "wrong credentials" against nothing. This is where they get one.
//   * `hasPassword: true` — an ordinary change.
//
// A <details> rather than a dialog or a separate route: it is rare, it is not
// urgent, and it should not cost a page load to discover. Server component —
// the state lives in the form inside it.
export function PasswordSettings({ hasPassword }: { hasPassword: boolean }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
            aria-hidden="true"
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              {hasPassword ? "שינוי סיסמה" : "קביעת סיסמה"}
            </span>
            <span className="block text-sm text-muted">
              {hasPassword
                ? "אפשר להחליף את הסיסמה בכל רגע"
                : "נכנסתם דרך Google — אין לחשבון סיסמה. כאן קובעים אחת"}
            </span>
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="border-t border-border px-4 pb-4 pt-3">
          <NewPasswordForm mode={hasPassword ? "change" : "add"} />
        </div>
      </details>
    </Card>
  );
}
