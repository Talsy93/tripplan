"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Compass,
  Copy,
  Globe,
  Heart,
  HouseHeart,
  Languages,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  PlaneTakeoff,
  Share2,
  Ticket,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PrepItem, PrepSuggestion } from "../domain/prep";
import { memberLabel } from "../domain/membership";
import type { Booking } from "../domain/booking";
import type { EmergencyContact } from "../domain/emergency";
import type { GearItem } from "../domain/gear";
import type { TripMember } from "../domain/membership";
import { enableSharing } from "../application/share-actions";
import { AddBookingButton } from "./booking-form";
import { ChecklistCard } from "./checklist-card";
import { DeleteTripButton } from "./delete-trip-button";
import { EmergencyCard } from "./emergency-card";
import { ExpenseSummary } from "./expense-summary";
import { HubBookings } from "./hub-bookings";
import { PushToggle } from "./push-toggle";

// The "מסמכים" tab — the Stitch export's third screen (design/stitch/…/_3),
// copied block for block: the eyebrow and the trip's name with the add pill,
// four filter pills, then "כרטיסי נסיעה ואישורים", "ציוד ורשימת הכנות",
// "שותפים ועדכון משפחה" and "חירום וביטוח". Sizes, colours and spacing are the
// export's own, in the export's Material names mapped onto this app's tokens.
//
// Every value on it is real. The fields the export printed that the app did
// not hold — seat, gate, boarding, bag, stars, breakfast, paid, the emergency
// numbers — arrived in migration 0026 so that the picture could be data. What
// is still not the export, and why, is said where it happens: no Wallet pass
// and no flight status (both paid), no "offline" stamp (nothing is cached), no
// file upload (it needs a storage bucket; the header adds a booking instead).
//
// Below the export's last card, and outside it: the screens that stay screens
// (the guides, the phrasebook, the how-to) and the delete
// row. The export has no room for them, and without them they are unreachable.

// Which sections a pill shows. The emergency card shows under every pill, as
// the export's `data-category="all"` does.
type Filter = "all" | "bookings" | "checklist" | "sharing";

const FILTERS: { key: Filter; label: string; Icon: LucideIcon }[] = [
  { key: "all", label: "הכל", Icon: LayoutGrid },
  { key: "bookings", label: "טיסות ומלונות", Icon: PlaneTakeoff },
  { key: "checklist", label: "ציוד ומשימות", Icon: ListChecks },
  { key: "sharing", label: "שיתוף משפחתי", Icon: Share2 },
];

const ELSEWHERE = [
  { segment: "guides", label: "מדריכי הערים", hint: "אזורי לינה, מסעדות, אטרקציות", Icon: Globe },
  { segment: "phrases", label: "מילים שימושיות", hint: "שיחון בשפת היעד, עם תעתיק", Icon: Languages },
  { segment: "guide", label: "איך זה עובד", hint: "שלבי העבודה, עם קישור לכל מסך", Icon: Compass },
] as const satisfies readonly {
  segment: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[];


// The avatars' colours, by position. The app has no profile photos, so a
// person is an initial on a tinted disc — the tone tokens, not new colours.
const AVATAR_TONES = [
  "bg-sky-tint text-sky-ink",
  "bg-peach-tint text-peach-ink",
  "bg-mint-tint text-mint-ink",
  "bg-lilac-tint text-lilac-ink",
  "bg-rose-tint text-rose-ink",
];

export function TripHub({
  tripId,
  tripName,
  bookings,
  gear,
  prepItems,
  prepSuggestions,
  today,
  members,
  cities,
  // Whether a public view link has been issued. Null when it has not.
  shareToken,
  emergencyContacts,
  // The site's origin, resolved on the server — see ShareTrip for why.
  origin,
  // Stamped by the server, so the alerts cannot disagree between the server
  // render and hydration.
  now,
}: {
  tripId: string;
  tripName: string;
  bookings: Booking[];
  gear: GearItem[];
  // The reminders (trip_prep_items), shown with the gear as one checklist.
  prepItems: PrepItem[];
  prepSuggestions: PrepSuggestion[];
  // YYYY-MM-DD in the trip's zone.
  today: string;
  members: TripMember[];
  cities: string[];
  shareToken: string | null;
  emergencyContacts: EmergencyContact[];
  origin: string;
  now: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shows = (section: Filter) => filter === "all" || filter === section;

  const at = new Date(now);
  // "פעילים": still ahead or under way. A flight that has landed is a record,
  // not something to have ready at a desk.
  const active = bookings.filter(
    (booking) => new Date(booking.ends_at ?? booking.starts_at) >= at,
  ).length;

  return (
    <div className="flex w-full min-w-0 flex-col pb-8">
      {/* No top padding of its own: the layout's <main> already gives the
          export's 16px under the header. */}
      <div className="pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] leading-[14px] font-semibold tracking-wide text-primary">
              מרכז מסמכים ובקרה
            </span>
            <h1 className="text-xl leading-7 font-semibold text-foreground wrap-anywhere">
              {tripName}
            </h1>
          </div>
          <AddBookingButton tripId={tripId} cities={cities} pill />
        </div>
      </div>

      {/* The pills scroll rather than wrap, as in the export. */}
      <div className="-mx-4 w-auto overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-1" role="group" aria-label="סינון">
          {FILTERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-4 py-1 text-xs leading-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-high text-muted-strong",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-6">
        {shows("bookings") && (
          <section className="flex flex-col gap-4">
            <SectionHead
              Icon={Ticket}
              tone="primary"
              title="כרטיסי נסיעה ואישורים"
              meta={
                bookings.length > 0 && (
                  <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] leading-[14px] font-medium tracking-[0.02em] text-success-strong">
                    {active} פעילים
                  </span>
                )
              }
            />
            <HubBookings
              tripId={tripId}
              bookings={bookings}
              cities={cities}
              now={now}
            />
          </section>
        )}

        {/* The money, beside the tickets it is summed from. Moved here from
            "פרטי הטיול" when that page went; `id` so "הוצאות עד כה" on the
            prep page can land on it. */}
        {shows("bookings") && bookings.length > 0 && (
          <section id="expenses" className="flex scroll-mt-20 flex-col gap-4">
            <SectionHead Icon={Wallet} tone="primary" title="הוצאות הטיול" />
            <ExpenseSummary bookings={bookings} />
          </section>
        )}

        {shows("checklist") && (
          <ChecklistCard
            tripId={tripId}
            gear={gear}
            prepItems={prepItems}
            suggestions={prepSuggestions}
            today={today}
          />
        )}

        {shows("sharing") && (
          <SharingSection
            tripId={tripId}
            members={members}
            shareToken={shareToken}
            origin={origin}
          />
        )}

        {/* Per device, not per trip — a push subscription belongs to the
            browser that made it — but this is where a traveller looks for
            "remind me", next to the tickets the reminders are about. */}
        {filter === "all" && (
          // No section heading: the card carries its own title, and the
          // same words twice in a row was the first version of this.
          <section id="device-reminders" className="scroll-mt-20">
            <PushToggle />
          </section>
        )}

        <EmergencyCard tripId={tripId} contacts={emergencyContacts} />

        {filter === "all" && (
          <>
            <nav
              aria-label="עוד בטיול"
              className="overflow-hidden rounded-xl bg-surface shadow-card"
            >
              <ul className="flex flex-col">
                {ELSEWHERE.map(({ segment, label, hint, Icon }) => (
                  <li
                    key={segment}
                    className="border-b border-surface-2 last:border-b-0"
                  >
                    <Link
                      href={`/trips/${tripId}/more/${segment}`}
                      className="group/row flex min-w-0 items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-high text-primary"
                        aria-hidden="true"
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-5 font-medium">
                          {label}
                        </span>
                        <span className="block min-w-0 truncate text-xs leading-[18px] text-muted-strong">
                          {hint}
                        </span>
                      </span>
                      <ChevronLeft
                        className="h-4 w-4 shrink-0 text-border-strong transition-transform group-hover/row:-translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Apart from everything above it, which is law 05: a destructive
                action does not sit at rest among the things you press every
                day. */}
            <div className="overflow-hidden rounded-xl bg-surface shadow-card">
              <DeleteTripButton tripId={tripId} tripName={tripName} variant="row" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The export's section header: a 32px tinted disc, the title, and whatever sits
// at the far end.
function SectionHead({
  Icon,
  tone,
  title,
  meta,
}: {
  Icon: LucideIcon;
  tone: "primary" | "cta";
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            tone === "primary"
              ? "bg-primary-tint text-primary"
              : "bg-cta-tint text-cta-strong",
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="min-w-0 text-lg leading-6 font-semibold text-foreground">
          {title}
        </h2>
      </div>
      {meta}
    </div>
  );
}

// ---- שותפים ועדכון משפחה ----------------------------------------------------

function SharingSection({
  tripId,
  members,
  shareToken,
  origin,
}: {
  tripId: string;
  members: TripMember[];
  shareToken: string | null;
  origin: string;
}) {
  const { showToast } = useToast();
  const [token, setToken] = useState(shareToken);
  const [working, setWorking] = useState(false);
  const shown = members.slice(0, 3);

  // The family link is the trip's public view link. Pressing either button on
  // a trip that has none issues it first — the export's buttons promise a link,
  // and "go to another screen and create one" is not what they say.
  async function ensureUrl(): Promise<string | null> {
    if (token) return `${origin}/share/${token}`;
    setWorking(true);
    const issued = await enableSharing(tripId);
    setWorking(false);
    if (!issued) {
      showToast("יצירת הקישור נכשלה. נסו שוב.", "danger");
      return null;
    }
    setToken(issued);
    return `${origin}/share/${issued}`;
  }

  async function copy() {
    const url = await ensureUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("קישור המעקב למשפחה הועתק");
    } catch {
      showToast("לא הצלחנו להעתיק. אפשר להעתיק ממסך השיתוף.", "danger");
    }
  }

  async function whatsapp() {
    // Opened before the await, inside the press: a window opened after a
    // network round trip is a popup, and Safari blocks it.
    const tab = token ? null : window.open("", "_blank");
    const url = await ensureUrl();
    if (!url) {
      tab?.close();
      return;
    }
    const target = `https://wa.me/?text=${encodeURIComponent(`הלו״ז, המלונות והטיסות של הטיול שלנו, מתעדכן לבד: ${url}`)}`;
    if (tab) tab.location.href = target;
    else window.open(target, "_blank", "noopener");
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHead
        Icon={UserPlus}
        tone="primary"
        title="שותפים ועדכון משפחה"
        meta={
          <span className="shrink-0 text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-primary">
            {members.length === 1 ? "רק אתם" : `${members.length} שותפים פעילים`}
          </span>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-card">
        <div>
          <span className="mb-1 block text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong">
            חברי הנסיעה
          </span>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center -space-x-2 space-x-reverse">
              {shown.map((member, index) => (
                <span
                  key={member.member_id}
                  title={memberLabel(member)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-2 ring-surface",
                    AVATAR_TONES[index % AVATAR_TONES.length],
                  )}
                >
                  {initial(memberLabel(member))}
                </span>
              ))}
              <Link
                href={`/trips/${tripId}/more/members`}
                aria-label="הוספת שותף"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-high text-primary transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
            <Link
              href={`/trips/${tripId}/more/members`}
              className="rounded-full bg-surface-2 px-4 py-1 text-xs leading-4 font-medium text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ניהול הרשאות
            </Link>
          </div>
        </div>

        <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-surface-2 p-4">
          <div className="flex items-start gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta-tint text-cta-strong">
              <HouseHeart className="h-[22px] w-[22px]" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h4 className="text-base leading-[22px] font-semibold text-foreground">
                  קישור שקט למשפחה בבית
                </h4>
                <Heart
                  className="h-4 w-4 shrink-0 fill-current text-cta-strong"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-0.5 text-xs leading-[18px] text-muted-strong">
                דף צפייה חי שמאפשר להורים ולמשפחה לעקוב אחרי הלו״ז, המלונות
                והטיסות — בלי חשבון ובלי אפשרות לשנות. מספרי אישור, כתובות
                מדויקות ומחירים לא מוצגים שם.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void copy()}
              disabled={working}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface px-2 py-2 text-xs leading-4 font-medium text-foreground shadow-sm transition-colors hover:bg-background active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Copy className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              העתקת לינק
            </button>
            <button
              type="button"
              onClick={() => void whatsapp()}
              disabled={working}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-success-strong px-2 py-2 text-xs leading-4 font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquareText className="h-[18px] w-[18px]" aria-hidden="true" />
              שיתוף בוואטסאפ
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function initial(label: string): string {
  return label.trim().charAt(0).toUpperCase() || "?";
}

