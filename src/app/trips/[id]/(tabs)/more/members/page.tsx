import { notFound } from "next/navigation";
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
export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [user, owner, members, invites, origin] = await Promise.all([
    getCurrentUser(),
    isTripOwner(id),
    listMembers(id),
    // Owner-only by RLS, so a member simply gets an empty list rather than an
    // error — which is the right shape for a section that then does not render.
    listOpenInvites(id),
    requestOrigin(),
  ]);

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="חשבון מזומן רואה את הטיול כמו שהבעלים רואה אותו — בלי צנזור."
      >
        מי בא איתנו
      </SectionHeading>

      <section className="flex flex-col gap-3">
        <SectionHeading level="section">מי יכול להיכנס</SectionHeading>
        <MemberList
          tripId={trip.id}
          members={members}
          invites={invites}
          isOwner={owner}
          currentUserId={user?.id ?? null}
        />
      </section>

      {owner ? (
        <section className="flex flex-col gap-3">
          <SectionHeading
            level="section"
            description="הם ייכנסו לאותו טיול מהמכשיר שלהם, עם החשבון שלהם."
          >
            הזמנת אדם
          </SectionHeading>
          <InviteForm tripId={trip.id} tripName={trip.name} origin={origin} />
        </section>
      ) : (
        <Banner tone="info">
          רק מי שיצר את הטיול יכול להזמין אנשים או לשנות הרשאות.
        </Banner>
      )}
    </>
  );
}
