"use client";

import { useState } from "react";
import { Copy, LogOut, Mail, Trash2, Users } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  Select,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
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

// Pencil's role colours, one per kind of access, used for the avatar and the
// pill so the two agree: the owner in the brand teal, an editor in green, a
// viewer in quiet grey. The pill words are short and ungendered — the long
// labels in TRIP_ROLES stay as the row's subtitle, where there is room.
const ROLE_LOOK = {
  owner: {
    pill: "bg-primary-tint text-primary-ink",
    avatar: "bg-primary text-primary-foreground",
    short: "בעלים",
  },
  editor: {
    pill: "bg-success-tint text-success-ink",
    avatar: "bg-success text-white",
    short: "עריכה",
  },
  viewer: {
    pill: "bg-surface-2 text-muted",
    avatar: "bg-cat-hidden-ink text-white",
    short: "צפייה",
  },
} as const;

// The first letter of whatever the row is called — a name or an email.
function initial(label: string): string {
  return Array.from(label.trim())[0]?.toUpperCase() ?? "?";
}

function Avatar({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold",
        tone,
      )}
    >
      {initial(label)}
    </span>
  );
}

function RolePill({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Who can reach this trip, and who has been asked but has not joined yet.
//
// `isOwner` gates every control rather than being inferred from the rows: only
// the owner can change a role or remove somebody, and a viewer looking at this
// list should see the facts without controls that would be refused. The database
// enforces the same rule — this is presentation, and if the two disagree the
// policy wins.
//
// Drawn to the Pencil export (members-mobile): one white card of rows with an
// initial avatar and a role pill, then the pending invitations under their own
// small heading with a red "cancel".
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
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col rounded-[20px] bg-surface px-4 shadow-card">
        {owner && (
          <li className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0">
            <Avatar label={memberLabel(owner)} tone={ROLE_LOOK.owner.avatar} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-semibold text-foreground">
                {memberLabel(owner)}
              </span>
              <span className="block truncate text-xs text-muted">
                יצר את הטיול · גישה מלאה
              </span>
            </span>
            {owner.member_id === currentUserId && (
              <Badge tone="neutral">אתם</Badge>
            )}
            <RolePill className={ROLE_LOOK.owner.pill}>
              {ROLE_LOOK.owner.short}
            </RolePill>
          </li>
        )}

        {visibleOthers.map((member) => {
          const self = member.member_id === currentUserId;
          const look = ROLE_LOOK[member.member_role];
          return (
            <li
              key={member.member_id}
              className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <Avatar label={memberLabel(member)} tone={look.avatar} />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-foreground wrap-anywhere">
                  {memberLabel(member)}
                </span>
                <span className="block text-xs text-muted wrap-anywhere">
                  {member.member_name && member.member_email
                    ? member.member_email
                    : TRIP_ROLES[member.member_role].label}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {self && <Badge tone="neutral">אתם</Badge>}
                {isOwner ? (
                  // The owner's pill is the role switch itself: the same
                  // native select as before, dressed as the pill a member sees.
                  <Select
                    value={member.member_role}
                    disabled={busy === member.member_id}
                    onChange={(event) =>
                      void setRole(member, event.currentTarget.value as TripRole)
                    }
                    aria-label={`הרשאה של ${memberLabel(member)}`}
                    className={cn(
                      "h-10 w-auto rounded-full ps-3 pe-8 text-xs font-semibold",
                      look.pill,
                    )}
                  >
                    {TRIP_ROLE_ORDER.map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LOOK[value].short}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <RolePill className={look.pill}>{look.short}</RolePill>
                )}

                {/* The owner removes anybody; a member can remove only
                    themselves. Both are the same delete, allowed by two
                    different policies — being unable to leave a trip
                    somebody added you to would be a trap, not a safeguard. */}
                {(isOwner || self) && (
                  <IconButton
                    label={self ? "יציאה מהטיול" : `הסרת ${memberLabel(member)}`}
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-danger"
                    onClick={() => setConfirming({ kind: "member", member, self })}
                  >
                    {self ? (
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </IconButton>
                )}
              </span>
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
        <section className="flex flex-col gap-2">
          <h4 className="px-1 text-sm font-semibold text-muted">
            ממתינים לאישור
            <span className="ms-1.5 font-normal text-outline">
              {visibleInvites.length}
            </span>
          </h4>
          <ul className="flex flex-col rounded-[20px] bg-surface px-4 shadow-card">
            {visibleInvites.map((invite) => (
              <li
                key={invite.token}
                className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
                >
                  <Mail className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[0.9375rem] font-semibold wrap-anywhere"
                    dir="ltr"
                  >
                    {invite.email}
                  </span>
                  <span className="block text-xs text-muted">
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
                  <button
                    type="button"
                    aria-label={`ביטול ההזמנה של ${invite.email}`}
                    onClick={() => setConfirming({ kind: "invite", invite })}
                    className="flex min-h-11 shrink-0 items-center rounded-full px-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ביטול
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
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
