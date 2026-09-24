"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Link2, Share2, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui";
import { cn } from "@/lib/cn";

// Sharing, in the app bar of every trip screen.
//
// It used to live at the very bottom of "עוד → פרטי הטיול", under the dates, the
// weather, every booking and the expense summary — reachable only by someone who
// already believed the feature existed and went looking. An app bar is where
// people look for sharing, in every app that has it, so that is where it goes.
//
// The dialog is a signpost rather than a second copy of the panel: two places
// that both manage members would drift, and the real screen has room for the
// list, the roles and the pending invites. What belongs here is "who can see
// this" at a glance and one tap to the screen that changes it.
export function ShareButton({
  tripId,
  memberCount,
  isShared,
}: {
  tripId: string;
  // People with access besides the owner. Drives the badge, so the bar answers
  // "is this trip shared" without being opened.
  memberCount: number;
  // Whether the anonymous read-only link is currently issued.
  isShared: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = memberCount > 0 || isShared;

  return (
    <>
      {/* One button (2026-09-25): "sharing the trip and the journey can be one
          share button". It was two — who is on the trip, and share — opening
          the same window, beside a third copy on "היום" and a fourth in
          Documents. The count of people rides on this one as a badge. */}
      <button
        type="button"
        aria-label={
          isShared
            ? "שיתוף הטיול — קישור פעיל"
            : memberCount > 0
              ? `שיתוף הטיול — ${memberCount} שותפים`
              : "שיתוף הטיול"
        }
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-muted hover:text-foreground",
        )}
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
        {memberCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute start-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[0.625rem] font-bold text-cta-foreground"
          >
            {memberCount}
          </span>
        )}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="שיתוף הטיול">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {memberCount > 0
              ? `${memberCount} אנשים נוספים יכולים להיכנס לטיול הזה מהמכשיר שלהם.`
              : "אף אחד חוץ מכם לא יכול להיכנס לטיול הזה."}
            {isShared && " בנוסף, יש קישור פומבי פעיל לצפייה בלבד."}
          </p>

          <div className="flex flex-col gap-2">
            <Row
              href={`/trips/${tripId}/more/members`}
              Icon={UserPlus}
              title="מי בא איתנו"
              hint="הזמנה לפי אימייל, צפייה או עריכה, הרשאות והזמנות שממתינות."
              onNavigate={() => setOpen(false)}
            />
            <Row
              href={`/trips/${tripId}/more/share`}
              Icon={Link2}
              title={isShared ? "הקישור לצפייה פעיל" : "קישור לצפייה בלבד"}
              hint="למשפחה ולחברים, בלי חשבון — בלי מחירים, קודים וכתובות מדויקות."
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Row({
  href,
  Icon,
  title,
  hint,
  onNavigate,
}: {
  href: string;
  Icon: typeof Share2;
  title: string;
  hint: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
        aria-hidden="true"
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-caption text-muted">{hint}</span>
      </span>
      <ArrowLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}
