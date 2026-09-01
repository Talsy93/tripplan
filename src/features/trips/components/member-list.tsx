"use client";

import { useState } from "react";
import { Clock, Copy, Crown, LogOut, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  ListRow,
  Select,
  useToast,
} from "@/components/ui";
import {
  TRIP_ROLES,
  TRIP_ROLE_ORDER,
  inviteUrl,
  memberLabel,
  splitMembers,
  type TripInvite,
  type TripMember,
  type TripRole,
} from "../domain/membership";
import {
  cancelInvite,
  changeMemberRole,
  revokeMember,
} from "../application/membership-actions";
import { Users } from "lucide-react";

// Who can reach this trip, and who has been asked but has not joined yet.
//
// `isOwner` gates every control rather than being inferred from the rows: only
// the owner can change a role or remove somebody, and a viewer looking at this
// list should see the facts without controls that would be refused. The database
// enforces the same rule — this is presentation, and if the two disagree the
// policy wins.
export function MemberList({
  tripId,
  members,
  invites,
  isOwner,
  currentUserId,
}: {
  tripId: string;
  members: TripMember[];
  invites: TripInvite[];
  isOwner: boolean;
  // So the row for "you" can be labelled, and so a member gets "leave" where the
  // owner gets "remove".
  currentUserId: string | null;
}) {
  const { owner, others } = splitMembers(members);
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [cancelled, setCancelled] = useState<string[]>([]);
  // What the confirm dialog is about, or null when it is closed.
  //
  // Both of these were one tap with no confirmation until T7's pass — revoking
  // somebody's access to a trip, and invalidating a token that may already be
  // sitting in their inbox. Law 05 says a destructive action lives in a dialog,
  // and these two are the ones on this screen that actually destroy something.
  // One piece of state rather than two, because only one can be open.
  const [confirming, setConfirming] = useState<
    | { kind: "member"; member: TripMember; self: boolean }
    | { kind: "invite"; invite: TripInvite }
    | null
  >(null);
  const { showToast } = useToast();

  const visibleOthers = others.filter(
    (member) => !removed.includes(member.member_id),
  );
  const visibleInvites = invites.filter(
    (invite) => !cancelled.includes(invite.token),
  );

  async function setRole(member: TripMember, role: TripRole) {
    setBusy(member.member_id);
    if (await changeMemberRole(tripId, member.member_id, role)) {
      showToast("ההרשאה עודכנה");
    } else {
      showToast("עדכון ההרשאה נכשל. נסו שוב.", "danger");
    }
    setBusy(null);
  }

  async function remove(member: TripMember) {
    const self = member.member_id === currentUserId;
    setRemoved((current) => [...current, member.member_id]);

    if (await revokeMember(tripId, member.member_id)) {
      showToast(self ? "יצאתם מהטיול" : "הגישה הוסרה");
    } else {
      setRemoved((current) => current.filter((id) => id !== member.member_id));
      showToast("ההסרה נכשלה. נסו שוב.", "danger");
    }
  }

  async function drop(invite: TripInvite) {
    setCancelled((current) => [...current, invite.token]);
    if (!(await cancelInvite(tripId, invite.token))) {
      setCancelled((current) => current.filter((t) => t !== invite.token));
      showToast("ביטול ההזמנה נכשל. נסו שוב.", "danger");
    }
  }

  async function copyInvite(invite: TripInvite) {
    try {
      await navigator.clipboard.writeText(
        inviteUrl(window.location.origin, invite.token),
      );
      showToast("הקישור הועתק");
    } catch {
      showToast("לא הצלחנו להעתיק.", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {owner && (
          <li>
            <ListRow
              leading={
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
                  aria-hidden="true"
                >
                  <Crown className="h-4 w-4" />
                </span>
              }
              title={memberLabel(owner)}
              subtitle="יצר את הטיול · גישה מלאה"
              trailing={
                owner.member_id === currentUserId ? (
                  <Badge tone="neutral">אתם</Badge>
                ) : undefined
              }
            />
          </li>
        )}

        {visibleOthers.map((member) => {
          const self = member.member_id === currentUserId;
          return (
            <li key={member.member_id}>
              <ListRow
                title={memberLabel(member)}
                subtitle={
                  member.member_name && member.member_email
                    ? member.member_email
                    : TRIP_ROLES[member.member_role].label
                }
                trailing={
                  <>
                    {self && <Badge tone="neutral">אתם</Badge>}
                    {isOwner ? (
                      <Select
                        value={member.member_role}
                        disabled={busy === member.member_id}
                        onChange={(event) =>
                          void setRole(
                            member,
                            event.currentTarget.value as TripRole,
                          )
                        }
                        aria-label={`הרשאה של ${memberLabel(member)}`}
                        className="w-36"
                      >
                        {TRIP_ROLE_ORDER.map((value) => (
                          <option key={value} value={value}>
                            {TRIP_ROLES[value].label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone="neutral">
                        {TRIP_ROLES[member.member_role].label}
                      </Badge>
                    )}

                    {/* The owner removes anybody; a member can remove only
                        themselves. Both are the same delete, allowed by two
                        different policies — being unable to leave a trip
                        somebody added you to would be a trap, not a safeguard. */}
                    {(isOwner || self) && (
                      <IconButton
                        label={
                          self ? "יציאה מהטיול" : `הסרת ${memberLabel(member)}`
                        }
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setConfirming({ kind: "member", member, self })
                        }
                      >
                        {self ? (
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </IconButton>
                    )}
                  </>
                }
              />
            </li>
          );
        })}
      </ul>

      {visibleOthers.length === 0 && visibleInvites.length === 0 && (
        <EmptyState
          icon={<Users />}
          title="רק אתם על הטיול הזה"
          description={
            isOwner
              ? "הזמינו מישהו למטה, והוא יוכל לפתוח את אותו טיול מהמכשיר שלו."
              : undefined
          }
        />
      )}

      {visibleInvites.length > 0 && (
        <Card padding="none" className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <h4 className="text-sm font-bold">ממתינים להצטרפות</h4>
            <Badge tone="neutral" className="ms-auto">
              {visibleInvites.length}
            </Badge>
          </div>
          <ul className="flex flex-col">
            {visibleInvites.map((invite) => (
              <li
                key={invite.token}
                className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm wrap-anywhere" dir="ltr">
                    {invite.email}
                  </span>
                  <span className="block text-caption text-muted">
                    {TRIP_ROLES[invite.role].label}
                  </span>
                </span>
                <IconButton
                  label={`העתקת הקישור של ${invite.email}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyInvite(invite)}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                {isOwner && (
                  <IconButton
                    label={`ביטול ההזמנה של ${invite.email}`}
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirming({ kind: "invite", invite })}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* One dialog for both actions, and the wording says what each one costs.
          A bare "are you sure?" is the version of this that people learn to
          dismiss without reading. */}
      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={
          confirming === null
            ? ""
            : confirming.kind === "invite"
              ? `לבטל את ההזמנה של ${confirming.invite.email}?`
              : confirming.self
                ? "לצאת מהטיול?"
                : `להסיר את ${memberLabel(confirming.member)} מהטיול?`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              ביטול
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = confirming;
                setConfirming(null);
                if (!target) return;
                if (target.kind === "invite") {
                  void drop(target.invite);
                } else {
                  void remove(target.member);
                }
              }}
            >
              {confirming?.kind === "invite"
                ? "ביטול ההזמנה"
                : confirming?.self
                  ? "יציאה"
                  : "הסרה"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {confirming?.kind === "invite"
            ? "הקישור שנשלח יפסיק לעבוד. אפשר להזמין שוב אחר כך, וייווצר קישור חדש."
            : confirming?.self
              ? "תאבדו את הגישה לטיול הזה. רק מי שיצר אותו יכול להוסיף אתכם בחזרה."
              : "הם יאבדו את הגישה לטיול. אפשר להזמין אותם שוב אחר כך."}
        </p>
      </Dialog>
    </div>
  );
}
