import { notFound } from "next/navigation";
import { Banner, SectionHeading } from "@/components/ui";
import { getCurrentUser } from "@/features/auth";
import {
  InviteForm,
  MemberList,
  MoreBackLink,
  ShareTrip,
  getShareToken,
  getTrip,
  isTripOwner,
  listMembers,
  listOpenInvites,
} from "@/features/trips";

export const metadata = { title: "שיתוף" };

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const [user, owner, members, invites, shareToken] = await Promise.all([
    getCurrentUser(),
    isTripOwner(id),
    listMembers(id),
    // Owner-only by RLS, so a member simply gets an empty list rather than an
    // error — which is the right shape for a section that then does not render.
    listOpenInvites(id),
    getShareToken(id),
  ]);

  return (
    <>
      <MoreBackLink tripId={trip.id} />
      <SectionHeading
        level="page"
        description="שתי דרכים נפרדות: הזמנה של אדם מסוים לחשבון שלו, או קישור פומבי לצפייה בלבד."
      >
        שיתוף הטיול
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
          <InviteForm tripId={trip.id} tripName={trip.name} />
        </section>
      ) : (
        <Banner tone="info">
          רק מי שיצר את הטיול יכול להזמין אנשים או לשנות הרשאות.
        </Banner>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading
          level="section"
          description="בלי חשבון ובלי סיסמה. מספרי אישור, כתובות מדויקות ומחירים לא מוצגים שם — בשונה ממי שהזמנתם בשמו."
        >
          קישור פומבי לצפייה
        </SectionHeading>
        <ShareTrip tripId={trip.id} initialToken={shareToken} />
      </section>
    </>
  );
}
