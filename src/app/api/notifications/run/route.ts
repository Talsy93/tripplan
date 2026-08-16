import { NextResponse } from "next/server";
import {
  APP_TIME_ZONE,
  bookingSchema,
  dueReminders,
  todayIn,
} from "@/features/trips";
import { subscriptionsForUser } from "@/features/trips/infrastructure/push-service";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/features/trips";

// The nightly reminder job. Called by Vercel Cron (see vercel.json), never by a
// browser.
//
// Node runtime, not edge: web-push signs with Node crypto.
export const runtime = "nodejs";
// Nothing here may be cached — the whole point is that today's answer differs
// from yesterday's.
export const dynamic = "force-dynamic";

// Only bookings that could possibly be due are fetched, so the job stays a small
// query regardless of how much history the database holds.
const CANDIDATE_COLUMNS =
  "id, trip_id, kind, title, origin, destination, city, starts_at, ends_at, address, confirmation, note, created_at, free_cancellation_until, book_by, booked, reminder_days_before, cancel_notified_at, book_by_notified_at";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  // Vercel Cron sends this header when CRON_SECRET is set. Without the check the
  // endpoint would let anyone on the internet spend the push quota and burn
  // every user's one-shot reminders.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[reminders] CRON_SECRET is not configured; refusing to run");
    return unauthorized();
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const admin = createAdminClient();
  const today = todayIn(APP_TIME_ZONE, new Date());

  // Deliberately crosses users — this is the one job that must. Rows with
  // neither deadline can never produce a reminder, so they are filtered in SQL.
  const { data, error } = await admin
    .from("trip_bookings")
    .select(CANDIDATE_COLUMNS)
    .or("free_cancellation_until.not.is.null,book_by.not.is.null");

  if (error) {
    console.error("[reminders] failed to read bookings:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // A row whose shape the app no longer understands is skipped rather than
  // allowed to abort the run for everyone else.
  const bookings: Booking[] = [];
  for (const row of data ?? []) {
    const parsed = bookingSchema.safeParse(row);
    if (parsed.success) bookings.push(parsed.data);
  }

  const due = dueReminders(bookings, today);
  if (due.length === 0) {
    return NextResponse.json({ today, checked: bookings.length, sent: 0 });
  }

  // A booking belongs to a trip, and a trip to a user — the reminder has to
  // reach the owner, and the booking row does not name them.
  const tripIds = [...new Set(bookings.map((booking) => booking.trip_id))];
  const { data: trips } = await admin
    .from("trips")
    .select("id, user_id")
    .in("id", tripIds);
  const ownerOf = new Map((trips ?? []).map((t) => [t.id, t.user_id as string]));

  const targetsByUser = new Map<
    string,
    Awaited<ReturnType<typeof subscriptionsForUser>>
  >();
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    const booking = bookings.find((b) => b.id === reminder.bookingId);
    const userId = booking ? ownerOf.get(booking.trip_id) : undefined;
    if (!userId) continue;

    if (!targetsByUser.has(userId)) {
      targetsByUser.set(userId, await subscriptionsForUser(admin, userId));
    }
    const targets = targetsByUser.get(userId) ?? [];

    // No registered device is not a failure: the reminder simply has nowhere to
    // go. Crucially the row is NOT marked as notified, so it will fire on the
    // first run after a device is registered rather than being lost.
    if (targets.length === 0) continue;

    const results = await Promise.all(
      targets.map((target) =>
        sendPush(target, {
          title: reminder.title,
          body: reminder.body,
          url: booking ? `/trips/${booking.trip_id}/more/trip` : "/",
          tag: `${reminder.kind}-${reminder.bookingId}`,
        }).then((result) => ({ target, result })),
      ),
    );

    // Dead subscriptions are removed rather than retried nightly forever.
    const dead = results
      .filter(({ result }) => !result.ok && result.gone)
      .map(({ target }) => target.id);
    if (dead.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", dead);
    }

    const delivered = results.some(({ result }) => result.ok);
    if (!delivered) {
      failed += 1;
      // Left unmarked on purpose: a reminder nobody received is a reminder
      // still owed, and tomorrow's run should try again.
      continue;
    }

    // Marking is what makes this fire once. It happens only after a successful
    // send, so a push failure cannot silently consume the single reminder the
    // user asked for.
    const column =
      reminder.kind === "cancellation"
        ? "cancel_notified_at"
        : "book_by_notified_at";
    const { error: markError } = await admin
      .from("trip_bookings")
      .update({ [column]: new Date().toISOString() })
      .eq("id", reminder.bookingId);

    if (markError) {
      console.error("[reminders] failed to mark as sent:", markError.message);
    }
    sent += 1;
  }

  return NextResponse.json({
    today,
    checked: bookings.length,
    due: due.length,
    sent,
    failed,
  });
}
