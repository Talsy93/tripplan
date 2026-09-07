"use client";

import { Fragment, useState } from "react";
import { ArrowDown, ChevronDown, Pencil, Plane, X } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Glyph,
  IconButton,
  REVEALED_ACTION,
  SegmentedControl,
  SwipeAction,
  type SegmentedItem,
} from "@/components/ui";
import {
  BOOKING_KINDS,
  bookingAlert,
  bookingNights,
  bookingTodoAlert,
  bookingStops,
  bookingWhere,
  cancellationAlert,
  doubleBookedLodgingIds,
  durationMinutesLabel,
  findConnections,
  flightRoute,
  isStandby,
  layoverLabel,
  stopsLabel,
} from "../domain/booking";
import { cn } from "@/lib/cn";
import { formatInZone } from "@/lib/datetime";
import { formatMoney } from "../domain/expenses";
import { APP_TIME_ZONE } from "../domain/weather";
import { removeBooking } from "../application/booking-actions";
import { BookingForm } from "./booking-form";
import type {
  Booking,
  BookingAlert,
  BookingKind,
  RouteLeg,
  RouteStop,
} from "../domain/booking";
import { DomainIcon } from "./domain-icon";
import { AirlineChip } from "./airline-chip";
import { Luggage } from "lucide-react";

const ALERT_TONE: Record<BookingAlert["urgency"], "warning" | "action" | "neutral"> =
  {
    now: "warning",
    soon: "action",
    upcoming: "neutral",
  };

type Filter = "all" | BookingKind;

export function BookingList({
  tripId,
  bookings: initial,
  cities,
  // Passed in from the server render so both sides agree on what "now" is
  // instead of disagreeing across hydration.
  now,
}: {
  tripId: string;
  bookings: Booking[];
  // For the edit dialog's "יעד בטיול" field — the same list BookingForm
  // already gets when adding.
  cities: string[];
  now: string;
}) {
  // The prop is the source of truth, and only pending deletions are held
  // locally.
  //
  // This used to be `useState(initial)`, which snapshotted the list at mount —
  // so a booking added by the form did not appear even though the Server Action
  // revalidated the route: the server sent new props and useState ignored them.
  // It only showed up after a manual reload, which looked like the save had
  // failed.
  const [removed, setRemoved] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Booking | null>(null);
  // Deleting a booking used to happen on the first tap of a permanently visible
  // ✕ — no confirmation, and the row was gone. The optimistic update below even
  // made it look instantaneous. A booking is a thing with a confirmation code
  // that was paid for; it gets asked about first.
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const asOf = new Date(now);

  const bookings = initial.filter((booking) => !removed.includes(booking.id));

  async function remove(id: string) {
    setRemoving(id);
    // Optimistic: hide it now, put it back if the delete did not take.
    setRemoved((current) => [...current, id]);

    if (!(await removeBooking(tripId, id))) {
      setRemoved((current) => current.filter((entry) => entry !== id));
    }
    setRemoving(null);
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Luggage />}
        title="עדיין אין הזמנות"
        description="הוסיפו טיסה, רכבת או לינה, והן יופיעו כאן ובמסך ״היום״ לפי התאריך."
      />
    );
  }

  const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.kind] = (acc[booking.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Only the kinds actually present get a tab — an empty "trains" filter is a
  // dead end, not a feature.
  const segments: SegmentedItem[] = [
    { id: "all", label: "הכול", count: bookings.length },
    ...(Object.keys(BOOKING_KINDS) as BookingKind[])
      .filter((kind) => counts[kind])
      .map((kind) => ({
        id: kind,
        label: BOOKING_KINDS[kind].label,
        count: counts[kind],
      })),
  ];

  const shown =
    filter === "all"
      ? bookings
      : bookings.filter((booking) => booking.kind === filter);

  // Computed over every booking, not just the visible ones: two hotels clash
  // whether or not a filter happens to be showing both of them.
  const doubleBooked = doubleBookedLodgingIds(bookings, APP_TIME_ZONE);

  // Same reasoning: two flights connect whether or not the current filter
  // shows both. The layover is rendered between them only when they are
  // actually adjacent on screen, which the map below checks per row.
  //
  // 0023 took the "קונקשן" badge off these rows and left the strip. The badge
  // was on *both* halves of every connecting journey — reported as "why is
  // there a connection badge on every flight card" — and it was answering a
  // question the ticket itself now answers: a journey with a stop is one card
  // with one badge saying how many stops (see stopsLabel). What survives here
  // is the case that is genuinely two tickets, where the only honest thing to
  // say is how long the gap between them is.
  const connections = findConnections(bookings);
  const layoverAfter = new Map(
    connections.map((connection) => [connection.from.id, connection]),
  );

  return (
    <div className="flex flex-col gap-4">
      {doubleBooked.size > 0 && (
        <Banner tone="callout">
          יש לכם {doubleBooked.size} לינות שחופפות באותם לילות. אם הזמנתם שתי
          אפשרויות כדי להחליט אחר כך — כדאי לבטל אחת מהן לפני שמועד הביטול
          החינם עובר.
        </Banner>
      )}
      {segments.length > 2 && (
        <SegmentedControl
          items={segments}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
          aria-label="סינון הזמנות"
        />
      )}

      {/* Two abreast at xl. A boarding-pass card is wide but not 1200px wide,
          and a trip with six bookings was six full-width bands before.

          `min-w-0` on the items is what actually keeps this inside the viewport.
          A `1fr` track is `minmax(auto, 1fr)`, and that `auto` floors the column
          at the item's min-content width — so one un-breakable string in one
          card sized the whole track, and measuring showed a 744px column inside
          a 320px phone. Removing the floor lets the track take the space it is
          given; `wrap-anywhere` below is what then makes the text fit into it.
          Both halves are needed, and neither is sufficient alone. */}
      <ul className="grid gap-3 xl:grid-cols-2">
        {shown.map((booking, index) => {
          const kind = BOOKING_KINDS[booking.kind];
          const nights = bookingNights(booking);
          const clashing = doubleBooked.has(booking.id);
          // 0023. How many times this one ticket touches down on the way.
          const stopCount = bookingStops(booking).length;

          // The layover strip is drawn only when the connecting leg is the
          // very next card on screen. Under a filter that hides it, a strip
          // saying "3 hours' wait" would point at whatever happened to follow.
          const connection = layoverAfter.get(booking.id);
          const nextShown = shown[index + 1];
          const layover =
            connection && nextShown?.id === connection.to.id
              ? connection.layoverMinutes
              : null;

          // Three alerts can apply at once — a hotel can be starting soon, be
          // cancellable until Thursday, and clash with another. They are
          // rendered together rather than one winning, because they are
          // different facts and hiding any of them loses information.
          const alerts = [
            bookingAlert(booking, asOf),
            cancellationAlert(booking, asOf),
            bookingTodoAlert(booking, asOf),
          ].filter((entry): entry is BookingAlert => entry !== null);

          return (
            <li key={booking.id} className="min-w-0">
              {/* The remove action is reached by a swipe or a hold on the card,
                  or by the button in the header that appears only once the card
                  is hovered or that button is focused. Every route opens the
                  same confirm dialog: a booking carries a confirmation code and
                  a price, and a gesture is not a reason to skip asking. */}
              <SwipeAction
                icon={<X className="h-4 w-4" aria-hidden="true" />}
                disabled={removing === booking.id}
                onAction={() => setConfirming(booking)}
                className="h-full"
              >
                <Card padding="none" className="h-full overflow-hidden">
                  <div className="flex items-start gap-3 p-4 pb-2">
                    {/* The kind glyph leads the card as its own tile rather than
                        sitting inline before the title. Inline it moved with the
                        text: on a phone the badges wrapped and the glyph ended up
                        wherever the wrap left it, so no two cards in a list
                        started the same way. */}
                    <Glyph size="md">
                      <DomainIcon name={kind.icon} />
                    </Glyph>

                    {/* Wraps rather than squeezing: an alert like "departing in
                        2 hours" is wider than the title on a phone, and a
                        truncated flight number is worse than a second line. */}
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
                      {/* `min-w-0` is not optional on a truncating flex child.
                          Without it the item keeps its automatic minimum size —
                          the full width of the un-wrapped string, because
                          `truncate` sets `white-space: nowrap` — so it refuses to
                          shrink, pushes the row past the card, and widens the
                          page instead of ellipsing. The parent having `min-w-0`
                          does not help: the constraint has to be on the item that
                          cannot wrap. */}
                      <span className="min-w-0 truncate text-base font-semibold">
                        {booking.title}
                      </span>
                      {/* Beside the title rather than in the meta row below:
                          which carrier it is belongs with what the flight is
                          called, and the row underneath is where the times and
                          the duration live. Renders nothing when the booking
                          has no airline, which is most of them. */}
                      <AirlineChip code={booking.airline} className="shrink-0" />
                      {/* 0022. Before the clash badge, because it explains
                          it: a held booking is the reason an overlap is fine,
                          and reading "double lodging" first and "standby"
                          second is reading them in the wrong order. Both show
                          together — the clash badge is what remembers that a
                          room still has to be cancelled. */}
                      {isStandby(booking) && (
                        <Badge tone="neutral" className="shrink-0">
                          סטנד-ביי
                        </Badge>
                      )}
                      {clashing && (
                        <Badge tone="warning" className="shrink-0">
                          לינה כפולה
                        </Badge>
                      )}
                      {/* 0023. One badge for the whole journey, on the one
                          card that is the whole journey. */}
                      {stopCount > 0 && (
                        <Badge
                          tone="action"
                          className="shrink-0"
                          title="הכרטיס כולל קונקשן — המסלול המלא בתוך הכרטיס"
                        >
                          {stopsLabel(stopCount)}
                        </Badge>
                      )}
                      {alerts.map((alert) => (
                        <Badge
                          key={alert.message}
                          tone={ALERT_TONE[alert.urgency]}
                          className="shrink-0"
                          suppressHydrationWarning
                        >
                          {alert.message}
                        </Badge>
                      ))}
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      <IconButton
                        label={`עריכת ${kind.label}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(booking)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      {/* Revealed by hovering the card or by focusing this
                          button, never at rest — the finger uses the swipe
                          and the hold instead. */}
                      <IconButton
                        label={`הסר ${kind.label}`}
                        variant="danger"
                        size="sm"
                        className={REVEALED_ACTION}
                        disabled={removing === booking.id}
                        onClick={() => setConfirming(booking)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </span>
                  </div>

                  {kind.isTransport ? (
                    <TransportLeg booking={booking} />
                  ) : (
                    <StayLeg booking={booking} nights={nights} />
                  )}

                  {(booking.confirmation ||
                    booking.note ||
                    booking.free_cancellation_until ||
                    booking.cost_amount !== null ||
                    (!booking.booked && booking.book_by)) && (
                    // `wrap-anywhere` on the container rather than on each line:
                    // overflow-wrap is inherited, and every field here is a string
                    // the provider chose — a 36-character confirmation code has no
                    // spaces to break at.
                    <div className="flex flex-col gap-1 border-t border-dashed border-border px-4 py-3 text-caption text-muted wrap-anywhere">
                      {booking.confirmation && (
                        <span dir="ltr" className="tabular-nums">
                          קוד הזמנה: {booking.confirmation}
                        </span>
                      )}
                      {booking.cost_amount !== null &&
                        booking.cost_currency && (
                          <span dir="ltr" className="tabular-nums">
                            עלות:{" "}
                            {formatMoney(
                              booking.cost_amount,
                              booking.cost_currency,
                            )}
                          </span>
                        )}
                      {/* Shown even when no alert is active, so the deadline that
                          was entered is visible rather than only surfacing days
                          later when it becomes urgent. */}
                      {booking.free_cancellation_until && (
                        <span>
                          ביטול חינם עד {formatDay(booking.free_cancellation_until)}
                        </span>
                      )}
                      {!booking.booked && booking.book_by && (
                        <span>להזמין עד {formatDay(booking.book_by)}</span>
                      )}
                      {booking.note && <span>{booking.note}</span>}
                    </div>
                  )}
                </Card>
              </SwipeAction>

              {/* The wait between two legs of one journey. Inside the same
                  <li> as the leg it follows, so the grid keeps the pair in
                  one cell and a two-column layout cannot split a connection
                  across columns. */}
              {layover !== null && (
                <div className="flex items-center gap-2 px-4 pt-2 text-caption text-muted">
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {layoverLabel(layover)}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `עריכת ${BOOKING_KINDS[editing.kind].label}` : ""}
      >
        {/* Keyed so switching which booking is being edited without the
            dialog ever fully closing still remounts the form against the new
            defaults, instead of reusing the old one's local state. */}
        {editing && (
          <BookingForm
            key={editing.id}
            tripId={tripId}
            cities={cities}
            booking={editing}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={
          confirming
            ? `להסיר את ${BOOKING_KINDS[confirming.kind].label} "${confirming.title}"?`
            : ""
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
                if (target) void remove(target.id);
              }}
            >
              הסרה
            </Button>
          </>
        }
      >
        <p className="text-sm">
          ההזמנה תיעלם גם מהלו״ז של היום שלה. אין דרך לשחזר — אבל אפשר להוסיף
          אותה מחדש.
        </p>
      </Dialog>
    </div>
  );
}

// A flight or train, laid out the way a ticket is: where you leave, where you
// land, and the line between them. Forced LTR because origin → destination
// reads left to right on every ticket in the world, including Hebrew ones.
// A flight or train, laid out the way a ticket is: where you leave, where you
// land, and the line between them. Forced LTR because origin → destination
// reads left to right on every ticket in the world, including Hebrew ones.
//
// The endpoints are `basis-0 flex-1`, not auto-width. An airport written out in
// full ("Ben Gurion International Airport") is far wider than a phone, and an
// auto-width flex item is floored at its own min-content — so the row grew, the
// grid column grew with it, and the whole page went wider than the viewport.
// That was the report: one long flight card widening every screen on mobile.
// Equal flexible thirds instead, each free to shrink and wrap its own text.
function TransportLeg({ booking }: { booking: Booking }) {
  const kind = BOOKING_KINDS[booking.kind];
  // 0023. The stops in the middle of this ticket. The summary row above stays
  // exactly what it was — where you leave and where you land — because that is
  // what a boarding pass leads with; the legs are one press away.
  const stops = bookingStops(booking);
  const [open, setOpen] = useState(false);

  // The endpoints row carries no `dir="ltr"`. It did, and it was the bug: with
  // it the origin sits on the left and the destination on the right, which is
  // correct for someone reading "TLV → NRT" and backwards for everyone reading
  // this app. The names are Hebrew — "נתב״ג", "הנדה, טוקיו" — so a Hebrew reader
  // starts at the right and reads the destination first. Reported as "in Hebrew
  // the route looks reversed", which is exactly what it was.
  //
  // Following the document instead puts the origin on the start edge, and a
  // Latin name inside it still renders left-to-right on its own — that is what
  // `dir="auto"` on each name is for.
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-start gap-2 px-4 pb-4 sm:gap-3">
        <Endpoint place={booking.origin} when={booking.starts_at} />

        {/* Never the part that gives way: the connector is decorative, so it
          shrinks to its icon before either place name loses a character. */}
        <div className="flex min-w-8 shrink flex-col items-center gap-1 pt-1.5">
          <div className="flex w-full items-center gap-1">
            <span className="h-px flex-1 border-t border-dashed border-border" />
            {/* Mirrored, because the glyph points somewhere. Lucide draws the
              plane nose-up-right, which in an RTL row points back at the origin
              — the same reversal the container had. */}
            <Plane
              className="h-4 w-4 shrink-0 -scale-x-100 text-primary"
              aria-hidden="true"
            />
            <span className="h-px flex-1 border-t border-dashed border-border" />
          </div>
          {/* The ticket's own figure, never a computed one. `starts_at` and
            `ends_at` are both stored by reading the typed wall clock in one
            zone, so their difference on this flight is 18h45m against a real
            11h25m — see migration 0020. A booking without it shows nothing
            here rather than a number that is wrong by the offset between two
            countries. */}
          {/* `typeof`, not `!== null`. listBookings *casts* its rows rather than
            parsing them, so on a database where 0020 has not been run the column
            is simply absent and this field is `undefined` — which `!== null`
            waves through, and durationMinutesLabel then renders "NaNש׳ NaNד׳".
            The type says `number | null` and the runtime disagrees; the check
            has to answer to the runtime. */}
          {typeof booking.duration_minutes === "number" && (
            <span className="whitespace-nowrap text-caption tabular-nums text-muted">
              {durationMinutesLabel(booking.duration_minutes)}
            </span>
          )}
        </div>

        <Endpoint
          place={booking.destination}
          when={booking.ends_at}
          align="end"
        />

        <span className="sr-only">
          {kind.label} מ{booking.origin ?? "מקור לא ידוע"} ל
          {booking.destination ?? "יעד לא ידוע"}
          {stops.length > 0 &&
            `, דרך ${stops.map((stop) => stop.place).join(", ")}`}
        </span>
      </div>

      {/* 0023. The full route, folded away. A direct booking renders none of
          this and is byte-for-byte the card it always was.

          `type="button"` is not decoration: this sits inside the list's card,
          which is inside a form nowhere — but a bare <button> in a future one
          would submit it, and the same omission has already cost this codebase
          a bug in the route editor. */}
      {stops.length > 0 && (
        <>
          {/* Which airport, on its own full-width line rather than in the
              connector column above. That column is deliberately the part of
              the row that gives way first (see the comment on TransportLeg),
              and "Dubai International" in it would size the grid track the
              whole card sits in — the bug that made one long flight widen
              every screen on a phone. Here it can simply wrap. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-3">
            <span
              dir="auto"
              className="min-w-0 text-caption text-muted wrap-anywhere"
            >
              דרך {stops.map((stop) => stop.place).join(" · ")}
            </span>
            <button
              type="button"
              onClick={() => setOpen((was) => !was)}
              aria-expanded={open}
              className="flex shrink-0 items-center gap-1 rounded-control text-caption text-primary"
            >
              {open ? "סגירת המסלול" : "המסלול המלא"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </div>
          {open && <RouteDetails booking={booking} />}
        </>
      )}
    </div>
  );
}

// The ticket unfolded: every leg with its own flight number, and every stop
// with the wait on the ground.
//
// Drawn as one vertical line rather than as repeated origin→destination rows.
// Two stacked ticket rows read as two bookings, which is the exact confusion
// 0023 exists to end; a single line down the side says "this is one journey"
// before a word of it is read.
function RouteDetails({ booking }: { booking: Booking }) {
  const route = flightRoute(booking);

  return (
    <ol className="flex flex-col border-t border-dashed border-border px-4 py-3">
      <RoutePoint place={booking.origin} at={booking.starts_at} />
      {route.legs.map((leg, index) => (
        <Fragment key={index}>
          <RouteLegRow leg={leg} />
          {index < route.stops.length ? (
            <RouteStopRow stop={route.stops[index]} />
          ) : (
            <RoutePoint place={leg.to} at={leg.arrivesAt} />
          )}
        </Fragment>
      ))}
    </ol>
  );
}

// An end of the journey: a filled dot, the place, and the time.
function RoutePoint({
  place,
  at,
}: {
  place: string | null;
  at: string | null;
}) {
  return (
    <li className="flex min-w-0 items-baseline gap-2">
      <span
        className="mt-1 h-2 w-2 shrink-0 self-start rounded-full bg-primary"
        aria-hidden="true"
      />
      <span
        dir="auto"
        className="min-w-0 flex-1 text-sm font-semibold wrap-anywhere"
      >
        {place ?? "—"}
      </span>
      {at && (
        <span
          dir="ltr"
          className="shrink-0 text-caption tabular-nums text-muted"
          suppressHydrationWarning
        >
          {formatWhen(at)}
        </span>
      )}
    </li>
  );
}

// A stop: a hollow dot — you are not staying — the two times, and the wait.
function RouteStopRow({ stop }: { stop: RouteStop }) {
  return (
    <li className="flex min-w-0 items-baseline gap-2">
      <span
        className="mt-1 h-2 w-2 shrink-0 self-start rounded-full border-2 border-primary bg-surface"
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span dir="auto" className="text-sm font-semibold wrap-anywhere">
          {stop.place}
        </span>
        {stop.layoverMinutes !== null && (
          <span className="text-caption text-muted">
            {layoverLabel(stop.layoverMinutes)}
          </span>
        )}
      </span>
      {(stop.arrivesAt || stop.departsAt) && (
        <span
          dir="ltr"
          className="shrink-0 text-caption tabular-nums text-muted"
          suppressHydrationWarning
        >
          {stop.arrivesAt ? formatWhen(stop.arrivesAt) : "—"}
          {" → "}
          {stop.departsAt ? formatWhen(stop.departsAt) : "—"}
        </span>
      )}
    </li>
  );
}

// The line between two points, carrying the number of the flight that flies it.
//
// The dashed border sits on a fixed-width box aligned with the dots above and
// below rather than on the row itself, so the line runs *through* the middle of
// the list instead of framing it.
function RouteLegRow({ leg }: { leg: RouteLeg }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="flex w-2 justify-center self-stretch" aria-hidden="true">
        <span className="my-0.5 w-px border-s border-dashed border-border-strong" />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 py-1.5 text-caption text-muted">
        <Plane
          className="h-3.5 w-3.5 shrink-0 -scale-x-100"
          aria-hidden="true"
        />
        {leg.flight && (
          <span dir="auto" className="wrap-anywhere">
            {leg.flight}
          </span>
        )}
        <AirlineChip code={leg.airline} />
      </span>
    </li>
  );
}

function Endpoint({
  place,
  when,
  align = "start",
}: {
  place: string | null;
  when: string | null;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        // basis-0 so the two endpoints split the row evenly regardless of how
        // long either name is, and min-w-0 so `break-words` below is actually
        // allowed to take effect.
        "min-w-0 flex-1 basis-0",
        // Logical, not physical. These were `text-right`/`text-left`, which only
        // read correctly because the row was forced to LTR; with the row
        // following the document they would put both names on the wrong edges.
        align === "end" ? "text-end" : "text-start",
      )}
    >
      {/* Wraps rather than truncates. A half-shown airport name is not a
          smaller version of the information — "Ben Gurion Internat…" and
          "Ben Gurion" are both fine to read, but an ellipsis on a two-word
          city name loses which city it is.

          `wrap-anywhere`, not `break-words`. They look interchangeable and are
          not: `overflow-wrap: break-word` permits a mid-word break to avoid
          overflow, but leaves the element's *min-content contribution* at the
          width of its longest word — so the grid track above still sized itself
          to the whole unbroken string. `overflow-wrap: anywhere` is the one that
          reduces min-content, which is the property this layout depends on. */}
      {/* dir="auto": the row follows the document now, so an airport code or a
          Latin city name has to render left-to-right inside its own box while
          the two boxes stay laid out start-to-end. */}
      <p dir="auto" className="text-title font-bold wrap-anywhere hyphens-auto">
        {place ?? "—"}
      </p>
      {when && (
        <p
          // A date and a time around a comma is an LTR run; left to the RTL
          // document the punctuation moves.
          dir="ltr"
          className="text-caption tabular-nums text-muted"
          suppressHydrationWarning
        >
          {formatWhen(when)}
        </p>
      )}
    </div>
  );
}

function StayLeg({
  booking,
  nights,
}: {
  booking: Booking;
  nights: number | null;
}) {
  const where = bookingWhere(booking);
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 pb-4">
      {/* min-w-0 for the same reason as the title: `truncate` sets nowrap, and a
          nowrap flex item without it keeps the full address as its minimum. */}
      {where && (
        <span className="min-w-0 truncate text-sm text-muted">{where}</span>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        {/* Times render in the viewer's timezone and locale, which the server
            doesn't share — the first client render can legitimately differ. */}
        <span dir="ltr" className="tabular-nums" suppressHydrationWarning>
          {formatWhen(booking.starts_at)}
          {booking.ends_at && ` → ${formatWhen(booking.ends_at)}`}
        </span>
        {nights !== null && (
          <span>{nights === 1 ? "לילה אחד" : `${nights} לילות`}</span>
        )}
      </div>
    </div>
  );
}

// A deadline is stored as a plain YYYY-MM-DD (a `date` column), so it is
// reformatted by splitting the string rather than by parsing it into a Date —
// `new Date("2026-09-10")` is UTC midnight and would print the 9th for any
// reader west of Greenwich.
function formatDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

// Rendered in the trip's zone, not the reader's.
//
// It used to be a bare toLocaleString, which uses whatever zone the browser is
// in — so the same booking read differently on a laptop abroad, and the value
// never matched what was typed into the form. A departure happens at the time
// it happens where it happens; that is the only reading that is stable.
function formatWhen(value: string) {
  return formatInZone(value, APP_TIME_ZONE);
}
