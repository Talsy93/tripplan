import Link from "next/link";
import { Card } from "@/components/ui";
import { ResetRequestForm } from "@/features/auth";

export const metadata = { title: "איפוס סיסמה · MyTrip" };

export default function ResetPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card padding="none" className="w-full max-w-sm">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <ResetRequestForm />
        </div>

        <p className="border-t border-border bg-surface-2 p-4 text-center text-sm text-muted">
          נזכרתם?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-ink hover:underline"
          >
            חזרה להתחברות
          </Link>
        </p>
      </Card>
    </main>
  );
}
