"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  Compass,
  Copy,
  Heart,
  HouseHeart,
  Languages,
  Luggage,
  MessageSquareText,
  Phone,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PrepItem, PrepSuggestion } from "../domain/prep";
import { memberLabel } from "../domain/membership";
import type { Booking } from "../domain/booking";
import type { EmergencyContact } from "../domain/emergency";
import { costTotalsByCurrency, formatMoney } from "../domain/expenses";
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

// The "מסמכים" tab, as the Pencil design draws it
// (design/pencil/exports/documents-mobile.png): the title with the screen's
// one terracotta pill, four filter chips, the tickets, a two-tile summary of
// the packing list and the money, and a card of links to the rest.
//
// Every value on it is real. What the design prints that the app cannot hold
// is said where it happens: no Wallet pass and no flight status (both paid),
// no file upload (it needs a storage bucket; the header adds a booking).
//
// The two tiles are summaries, not the lists themselves: the checklist and the
// expense breakdown open in place of the overview when a tile is pressed (the
// "ציוד" chip opens the checklist too), and the emergency card opens from its
// row. Nothing the screen held before is gone — it is one press further in.

// Which sections are on screen. The first four are the chips; the last two
// have no chip and are reached from a tile or a row.
type View = "all" | "bookings" | "checklist" | "sharing" | "expenses" | "emergency";

const FILTERS: { key: View; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "bookings", label: "טיסות ומלונות" },
  { key: "checklist", label: "ציוד" },
  { key: "sharing", label: "שיתוף" },
];

// Anchors other screens link to — "הוצאות עד כה" on the prep page lands on
// #expenses, the device-reminder suggestion on #device-reminders — mapped to
// the view that holds them.
const HASH_VIEWS: Record<string, View> = {
  "#expenses": "expenses",
  "#emergency": "emergency",
  "#device-reminders": "all",
};

// The card of links under the summary. A row is either another screen or one
// of the views above that has no chip.
const ELSEWHERE: {
  key: string;
  label: string;
  Icon: LucideIcon;
  to: { segment: string } | { view: View };
}[] = [
  { key: "members", label: "מי בא איתנו", Icon: Users, to: { segment: "members" } },
  { key: "guides", label: "מדריכי הערים", Icon: BookOpen, to: { segment: "guides" } },
  { key: "phrases", label: "מילים שימושיות", Icon: Languages, to: { segment: "phrases" } },
  { key: "emergency", label: "חירום וביטוח", Icon: Phone, to: { view: "emergency" } },
  { key: "guide", label: "איך זה עובד", Icon: Compass, to: { segment: "guide" } },
];

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
  const [view, setView] = useState<View>("all");
  const top = useRef<HTMLDivElement>(null);

  // A link that arrives with an anchor opens the view that holds it, then
  // scrolls to it — the browser's own jump happened before the view existed.
  // Read after mount, never during render: the server has no hash, and a
  // first render that disagreed with it would be a hydration mismatch.
  useEffect(() => {
    function follow() {
      const target = HASH_VIEWS[window.location.hash];
      if (!target) return;
      setView(target);
      requestAnimationFrame(() =>
        document
          .getElementById(window.location.hash.slice(1))
          ?.scrollIntoView({ block: "start" }),
      );
    }
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  // A tile or a row swaps what is below the chips; back to the top so the
  // new view starts where the eye is, not wherever the tile was.
  function open(next: View) {
    setView(next);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const shows = (section: View) => view === "all" || view === section;

  // The gear tile: the packing list and the reminders counted as the one
  // checklist ChecklistCard draws.
  const checklistTotal = gear.length + prepItems.length;
  const checklistDone =
    gear.filter((item) => item.packed).length +
    prepItems.filter((item) => item.done).length;

  // The money tile: the first currency's total, and a count of the rest — a
  // tile has room for one figure, the breakdown behind it has room for all.
  const totals = costTotalsByCurrency(bookings);

  return (
    <div ref={top} className="flex w-full min-w-0 scroll-mt-20 flex-col gap-4 pb-8">
      {/* No top padding of its own: the layout's <main> already gives the
          space under the header. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] leading-8 font-bold text-foreground">
          מסמכים
        </h1>
        <AddBookingButton tripId={tripId} cities={cities} pill />
      </div>

      {/* The chips scroll rather than wrap. */}
      <div className="-mx-4 w-auto overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-2" role="group" aria-label="סינון">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={cn(
                "flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === key
                  ? "bg-foreground text-surface"
                  : "border border-border bg-surface text-foreground hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shows("bookings") && (
        <section aria-label="כרטיסי נסיעה ואישורים" className="flex flex-col gap-3">
          <HubBookings
            tripId={tripId}
            bookings={bookings}
            cities={cities}
            now={now}
          />
        </section>
      )}

      {view === "all" && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryTile
            Icon={Luggage}
            value={
              checklistTotal === 0
                ? "רשימה ריקה"
                : `${checklistDone} מתוך ${checklistTotal}`
            }
            label="ציוד והכנות"
            progress={checklistTotal === 0 ? null : checklistDone / checklistTotal}
            onOpen={() => open("checklist")}
          />
          <SummaryTile
            Icon={Wallet}
            value={
              totals.length === 0
                ? "—"
                : formatMoney(totals[0].total, totals[0].currency)
            }
            valueDir="ltr"
            label={
              totals.length > 1
                ? `הוצאות · ועוד ${totals.length - 1} מטבעות`
                : totals.length === 1
                  ? "הוצאות עד עכשיו"
                  : "הוצאות"
            }
            onOpen={() => open("expenses")}
          />
        </div>
      )}

      {/* The money, beside the tickets it is summed from, under "טיסות
          ומלונות" — and on its own when the tile is pressed. `id` so
          "הוצאות עד כה" on the prep page can land on it. */}
      {(view === "expenses" || (view === "bookings" && bookings.length > 0)) && (
        <section id="expenses" className="flex scroll-mt-20 flex-col gap-3">
          <SectionHead title="הוצאות הטיול" />
          <ExpenseSummary bookings={bookings} />
        </section>
      )}

      {view === "checklist" && (
        <ChecklistCard
          tripId={tripId}
          gear={gear}
          prepItems={prepItems}
          suggestions={prepSuggestions}
          today={today}
        />
      )}

      {view === "sharing" && (
        <SharingSection
          tripId={tripId}
          members={members}
          shareToken={shareToken}
          origin={origin}
        />
      )}

      {view === "emergency" && (
        <section id="emergency" className="scroll-mt-20">
          <EmergencyCard tripId={tripId} contacts={emergencyContacts} />
        </section>
      )}

      {view === "all" && (
        <>
          <nav
            aria-label="עוד בטיול"
            className="overflow-hidden rounded-[18px] bg-surface shadow-card"
          >
            <ul className="flex flex-col px-4">
              {ELSEWHERE.map(({ key, label, Icon, to }) => {
                const row = (
                  <>
                    <Icon
                      className="h-5 w-5 shrink-0 text-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] leading-6 font-medium text-foreground">
                      {label}
                    </span>
                    <ChevronLeft
                      className="h-4 w-4 shrink-0 text-muted transition-transform group-hover/row:-translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                );
                const rowClass =
                  "group/row flex min-h-14 w-full min-w-0 items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
                return (
                  <li key={key} className="border-b border-border last:border-b-0">
                    {"segment" in to ? (
                      <Link
                        href={`/trips/${tripId}/more/${to.segment}`}
                        className={rowClass}
                      >
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => open(to.view)}
                        className={rowClass}
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Per device, not per trip — a push subscription belongs to the
              browser that made it — but this is where a traveller looks for
              "remind me", next to the tickets the reminders are about. */}
          <section id="device-reminders" className="scroll-mt-20">
            <PushToggle />
          </section>

          {/* Apart from everything above it, which is law 05: a destructive
              action does not sit at rest among the things you press every
              day. */}
          <div className="overflow-hidden rounded-[18px] bg-surface shadow-card">
            <DeleteTripButton tripId={tripId} tripName={tripName} variant="row" />
          </div>
        </>
      )}
    </div>
  );
}

// One of the two summary tiles: an icon, one figure, what it counts, and —
// for the checklist — how far along it is. The whole tile opens the list.
function SummaryTile({
  Icon,
  value,
  valueDir,
  label,
  progress,
  onOpen,
}: {
  Icon: LucideIcon;
  value: string;
  valueDir?: "ltr";
  label: string;
  // 0..1, or absent for a tile with no bar.
  progress?: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-col items-start gap-1 rounded-[18px] bg-surface p-4 text-start shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="mb-1 h-5 w-5 text-primary" aria-hidden="true" />
      <span
        dir={valueDir}
        className="max-w-full truncate text-xl leading-7 font-bold text-foreground tabular-nums"
      >
        {value}
      </span>
      <span className="max-w-full truncate text-xs leading-4 text-muted">
        {label}
      </span>
      {typeof progress === "number" && (
        <span
          className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="התקדמות הרשימה"
        >
          <span
            className="block h-full rounded-full bg-success"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </button>
  );
}

// A section's heading in a filtered view: the title, and whatever sits at the
// far end.
function SectionHead({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="min-w-0 text-lg leading-6 font-semibold text-foreground">
        {title}
      </h2>
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
        title="שותפים ועדכון משפחה"
        meta={
          <span className="shrink-0 text-xs font-semibold text-primary">
            {members.length === 1 ? "רק אתם" : `${members.length} שותפים פעילים`}
          </span>
        }
      />

      <div className="flex flex-col gap-4 rounded-[18px] bg-surface p-4 shadow-card">
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

        <div className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-surface-2 p-4">
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
              className="flex flex-1 items-center justify-center gap-1 min-h-11 rounded-[14px] bg-surface px-2 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Copy className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              העתקת לינק
            </button>
            <button
              type="button"
              onClick={() => void whatsapp()}
              disabled={working}
              className="flex flex-1 items-center justify-center gap-1 min-h-11 rounded-[14px] bg-success-strong px-2 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

