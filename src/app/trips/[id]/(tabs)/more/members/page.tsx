import Link from "next/link";
import { notFound } from "next/navigation";
import { House } from "lucide-react";
import { Banner, SectionHeading } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import { requestOrigin } from "@/lib/origin";
import {
  InviteForm,
  MemberList,
  MoreBackLink,
  getTrip,
  isTripOwner,
  listMembers,
  listOpenInvites,
} from "@/features/trips";

export const metadata = { title: "מי בא איתנו" };

// Split out of /more/share in T5, because the menu the design draws has two
// rows for it and one page cannot be two rows.
//
// The split is not only cosmetic: these are two of the three access mechanisms
// in ARCHITECTURE.md's table and they are deliberately different from each
// other. A named account that sees the trip as the owner sees it is not the same
// thing as an unguessable URL that shows a redacted copy, and putting them under
// one heading is what made people treat them as one feature.
//
// Drawn to the Pencil export (members-mobile): a title with a count line, the
// member card, the pending invitations, the invite card, and at the foot a
// teal-tint row pointing at the other mechanism — the quiet read-only link.
export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The trip joins the wave rather than gating it — see /more/gear for why.
  const [trip, user, owner, members, invites, origin] = await Promise.all([
    getTrip(id),
    getCurrentUser(),
    isTripOwner(id),
    listMembers(id),
    // Owner-only by RLS, so a member simply gets an empty list rather than an
    // error — which is the right shape for a section that then does not render.
    listOpenInvites(id),
    requestOrigin(),
  ]);
  if (!trip) notFound();

  // Pencil's subline: how many are on the trip, and how many are still asked.
  const counts = [
    members.length === 1 ? "מטייל אחד" : `${members.length} מטיילים`,
    invites.length > 0 &&
      (invites.length === 1 ? "הזמנה אחת ממתינה" : `${invites.length} הזמנות ממתינות`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading level="page" description={counts}>
        מי בא איתנו
      </SectionHeading>

      <MemberList
        tripId={trip.id}
        members={members}
        invites={invites}
        isOwner={owner}
        currentUserId={user?.id ?? null}
      />

      {owner ? (
        <InviteForm tripId={trip.id} tripName={trip.name} origin={origin} />
      ) : (
        <Banner tone="info">
          רק מי שיצר את הטיול יכול להזמין אנשים או לשנות הרשאות.
        </Banner>
      )}

      {/* The other mechanism, named rather than merged — the same signpost
          /more/share carries in the other direction. The link itself is
          issued and copied there, where its warning is. */}
      <Link
        href={`/trips/${trip.id}/more/share`}
        className="flex min-w-0 items-center gap-3 rounded-[20px] bg-primary-tint p-4 transition-colors hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <House className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-primary-ink">
            קישור שקט למשפחה
          </span>
          <span className="block text-xs text-muted">
            צפייה בלבד, בלי מחירים וקודים
          </span>
        </span>
        <span className="flex h-10 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
          לקישור
        </span>
      </Link>
    </>
  );
}
