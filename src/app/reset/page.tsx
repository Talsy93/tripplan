import Link from "next/link";
import { AuthShell, ResetRequestForm } from "@/features/auth";

export const metadata = { title: "איפוס סיסמה · MyTrip" };

export default function ResetPage() {
  return (
    <AuthShell
      footer={
        <>
          נזכרתם?{" "}
          <Link
            href="/login"
            className="rounded-full font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            חזרה להתחברות
          </Link>
        </>
      }
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
