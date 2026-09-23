"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Share2, UserPlus, Users } from "lucide-react";
import { Dialog, IconButton } from "@/components/ui";
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
      {/* Stitch's two round actions: who is on the trip (with a count in
          terracotta), and share. Both open the same signpost dialog. */}
      <button
        type="button"
        aria-label={
          memberCount > 0 ? `שותפים לטיול: ${memberCount}` : "שותפים לטיול"
        }
        onClick={() => setOpen(true)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Users className="h-5 w-5" aria-hidden="true" />
        {memberCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute start-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[0.625rem] font-bold text-cta-foreground"
          >
            {memberCount}
          </span>
        )}
      </button>
      <IconButton
        label={isShared ? "שיתוף הטיול — קישור פעיל" : "שיתוף הטיול"}
        onClick={() => setOpen(true)}
        className={cn("h-11 w-11", active && "text-primary")}
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </IconButton>

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
              href={`/trips/${tripId}/more/share`}
              Icon={UserPlus}
              title="הזמנת אדם לטיול"
              hint="לפי אימייל, עם צפייה בלבד או עם עריכה. הקישור נשלח בוואטסאפ, ב-SMS או במייל."
              onNavigate={() => setOpen(false)}
            />
            <Row
              href={`/trips/${tripId}/more/share`}
              Icon={Users}
              title="מי יכול להיכנס"
              hint="הרשאות, הסרת גישה, והזמנות שממתינות."
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
      className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
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
