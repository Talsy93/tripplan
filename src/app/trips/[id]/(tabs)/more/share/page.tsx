import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { SectionHeading } from "@/components/ui";
import { requestOrigin } from "@/lib/origin";
import {
  MoreBackLink,
  ShareTrip,
  getShareToken,
  getTrip,
  listMembers,
} from "@/features/trips";

export const metadata = { title: "שיתוף הטיול" };

// The public link, and only it. Members and invitations moved to /more/members
// in T5 — see the note there for why the two are worth keeping apart.
export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [members, shareToken, origin] = await Promise.all([
    listMembers(id),
    getShareToken(id),
    // Resolved on the server. A "use client" component is still rendered on the
    // server for the initial HTML, so reading `window` in its body throws —
    // which is exactly how ShareTrip crashed for anyone who had already issued a
    // link.
    requestOrigin(),
  ]);

  // The owner is in that list and is not somebody the trip is shared *with*.
  const named = members.filter((member) => !member.is_owner).length;

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="בלי חשבון ובלי סיסמה. מספרי אישור, כתובות מדויקות ומחירים לא מוצגים שם — בשונה ממי שהזמנתם בשמו."
      >
        קישור פומבי לצפייה
      </SectionHeading>

      <ShareTrip tripId={trip.id} initialToken={shareToken} origin={origin} />

      {/* The other mechanism, named rather than merged. Someone who arrives here
          wanting to bring a person along should not have to guess that a
          redacted link is not what they want. */}
      <Link
        href={`/trips/${trip.id}/more/members`}
        className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-soft transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink"
          aria-hidden="true"
        >
          <Users className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">
            {named > 0
              ? `${named} ${named === 1 ? "אדם נוסף" : "אנשים נוספים"} בטיול`
              : "להביא מישהו לטיול"}
          </span>
          <span className="block text-sm text-muted">
            הזמנה לפי אימייל — הם רואים את הטיול לא מצונזר, ואפשר גם לתת הרשאת
            עריכה
          </span>
        </span>
        <ChevronLeft
          className="h-5 w-5 shrink-0 text-muted"
          aria-hidden="true"
        />
      </Link>
    </>
  );
}
