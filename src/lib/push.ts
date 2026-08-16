import webpush from "web-push";

// Web Push, behind a small abstraction — the same shape src/lib/ai uses.
//
// There is no paid service here: VAPID is a browser standard, the keys are
// generated locally, and the thing that actually delivers the message is the
// push service run by the browser vendor (Google, Apple, Mozilla) at no cost.
// What this file needs is only the identity to sign with.

export type PushPayload = {
  title: string;
  body: string;
  // Where clicking the notification should land.
  url?: string;
  // Groups repeats of one reminder instead of stacking them.
  tag?: string;
};

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Sending is the outcome the caller has to branch on, so it is a value rather
// than an exception. "gone" is the one that matters: it means the subscription
// is dead and its row should be deleted, not retried tomorrow and every day
// after.
export type PushResult =
  | { ok: true }
  | { ok: false; gone: boolean; message: string };

let configured = false;

function configure() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@tripplan.app";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  configure();

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      // A reminder that arrives a day late is worse than useless, so the push
      // service is told to stop trying after 12 hours rather than the default
      // four weeks.
      { TTL: 12 * 60 * 60 },
    );
    return { ok: true };
  } catch (error) {
    // 404 and 410 are the push service saying this subscription no longer
    // exists — the app was uninstalled, or permission was revoked. Anything
    // else is transient and worth keeping the row for.
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
    const gone = status === 404 || status === 410;

    console.error(
      `[push] send failed (status ${status ?? "unknown"}, gone=${gone}):`,
      error instanceof Error ? error.message : error,
    );
    return {
      ok: false,
      gone,
      message: error instanceof Error ? error.message : "unknown push error",
    };
  }
}
