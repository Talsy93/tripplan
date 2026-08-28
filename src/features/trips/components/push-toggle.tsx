"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Share } from "lucide-react";
import { Banner, Button, Card, Surface } from "@/components/ui";
import {
  isPushRegistered,
  registerPushSubscription,
  unregisterPushSubscription,
} from "../application/push-actions";

// Turning device reminders on and off.
//
// The states are kept explicit rather than derived from Notification.permission
// alone, because permission granted does not mean this device reached the
// database — and a toggle that lies about that is worse than no toggle.
type State =
  | { kind: "loading" }
  // The browser has no Push API at all.
  | { kind: "unsupported" }
  // iOS only allows push from an installed web app. In a Safari tab the API is
  // simply absent, so this is the one case where the honest answer is an
  // instruction rather than a button.
  | { kind: "needs-install" }
  | { kind: "off" }
  | { kind: "on" }
  // Permission was denied. The browser will not ask again from a click, so the
  // only route back is through site settings.
  | { kind: "blocked" }
  // The build has no VAPID public key. Kept apart from "error" because it is not
  // retryable from the device: nothing the user does here can fix it, so no
  // button is offered. Showing one anyway is what let a click run straight into
  // `undefined.padEnd`.
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

// VAPID's public key travels to the browser and is safe there — it is the
// identity a push service checks the signature against, not a secret.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// The Push API wants the key as bytes; it is published as base64url.
//
// Validates rather than trusting: called with an undefined key this used to fail
// as "undefined is not an object (evaluating 'm.padEnd')" — a minified stack
// trace that says nothing about the actual problem, which was a missing
// environment variable. A P-256 public key is always 65 bytes beginning with
// 0x04, so both are checked and named.
function urlBase64ToUint8Array(base64: string | undefined) {
  if (!base64) {
    throw new Error("מפתח VAPID ציבורי חסר בגרסה שנבנתה");
  }
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));

  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error(
      `מפתח VAPID ציבורי פגום (${bytes.length} בייטים, מצפים ל-65)`,
    );
  }
  return bytes;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, older flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushToggle() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async () => {
    if (!PUBLIC_KEY) {
      setState({ kind: "unconfigured" });
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // On an iPhone this is the normal state in a Safari tab, and the fix is
      // installing rather than switching browser — so say that instead.
      setState(isIos() && !isInstalled() ? { kind: "needs-install" } : { kind: "unsupported" });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ kind: "blocked" });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setState({ kind: "off" });
        return;
      }
      // The browser can hold a subscription the server has never heard of —
      // a restored backup, a cleared database. Trust the server's answer.
      setState((await isPushRegistered(existing.endpoint)) ? { kind: "on" } : { kind: "off" });
    } catch {
      setState({ kind: "off" });
    }
  }, []);

  useEffect(() => {
    // Everything runs behind an await so no state is set synchronously while
    // the effect body is still executing, and `cancelled` stops a slow
    // registration from reporting into a component that has gone away.
    let cancelled = false;

    void (async () => {
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch {
          if (!cancelled) setState({ kind: "unsupported" });
          return;
        }
      }
      if (!cancelled) await detect();
    })();

    return () => {
      cancelled = true;
    };
  }, [detect]);

  async function enable() {
    setBusy(true);
    // Which step we are on, so a failure names the step instead of the whole
    // operation. Enabling push touches four separate systems — the permission
    // prompt, the service worker, the browser's push service, and our database
    // — and "it failed" does not distinguish between them. Each fails for
    // completely different reasons and has a completely different fix.
    let stage = "הרשאה";
    try {
      // Must be called from the click itself — iOS rejects a permission request
      // that is not tied to a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "blocked" } : { kind: "off" });
        return;
      }

      stage = "service worker";
      const registration = await navigator.serviceWorker.ready;

      stage = "מנוי בשירות הדחיפה";
      // A subscription already held by this browser may have been created with
      // a different VAPID key — an earlier attempt, or a key that has since been
      // rotated. subscribe() then throws InvalidStateError rather than replacing
      // it, and the only way forward is to drop the old one first. Harmless when
      // there is nothing stale: the server row is keyed by endpoint and gets
      // re-registered below either way.
      const stale = await registration.pushManager.getSubscription();
      if (stale) {
        await stale.unsubscribe().catch(() => {
          // If it will not go quietly, subscribe() will report why.
        });
      }

      const subscription = await registration.pushManager.subscribe({
        // Required to be true by every browser: a push must always be visible
        // to the user, never silent background work.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });

      stage = "שמירה בשרת";
      const json = subscription.toJSON();
      const result = await registerPushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        userAgent: navigator.userAgent,
      });

      if (!result.ok) {
        // Do not leave the browser subscribed to a server that has no record of
        // it — that is a device which can never be reached or turned off.
        await subscription.unsubscribe();
        setState({
          kind: "error",
          message: `נכשל בשלב ״${stage}״: ${result.message ?? "לא ידוע"}`,
        });
        return;
      }
      setState({ kind: "on" });
    } catch (error) {
      // Say what actually went wrong, and where. A bare "it failed" here was
      // the same mistake C1 was about: the reason existed and was thrown away,
      // leaving nothing to act on.
      console.error(`[push] enable failed at stage "${stage}":`, error);
      const detail =
        error instanceof Error && error.message
          ? `${error.name}: ${error.message}`
          : String(error);
      setState({
        kind: "error",
        message: `נכשל בשלב ״${stage}״ — ${detail}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unregisterPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState({ kind: "off" });
    } catch {
      setState({ kind: "error", message: "הכיבוי נכשל. נסו שוב." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        {/* Was an emoji bell sitting inches from the lucide bells on the
            buttons below — the same concept drawn two ways in one card. */}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
          aria-hidden="true"
        >
          {state.kind === "on" ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-base font-semibold">תזכורות למכשיר</h3>
          <p className="text-sm text-muted">
            התראה אחת, בזמן שהגדרתם — לפני שמועד ביטול חינם עובר, או כשצריך
            להזמין משהו מראש.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-muted">בודק…</p>
      )}

      {state.kind === "needs-install" && (
        <Surface tone="sunken" padding="sm" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">באייפון צריך קודם להתקין את האפליקציה</p>
          <p className="flex flex-wrap items-center gap-1 text-muted">
            <span>לחצו על</span>
            <Share className="inline h-4 w-4" aria-hidden="true" />
            <span>״שיתוף״ בסרגל של Safari, ואז ״הוסף למסך הבית״.</span>
          </p>
          <p className="text-muted">
            אחרי שתפתחו את האפליקציה מהמסך הבית, הכפתור להפעלת התראות יופיע כאן.
            זו דרישה של אפל ואי אפשר לעקוף אותה.
          </p>
        </Surface>
      )}

      {state.kind === "unsupported" && (
        <p className="text-sm text-muted">
          הדפדפן הזה לא תומך בהתראות. ההתראות ימשיכו להופיע בתוך האפליקציה.
        </p>
      )}

      {state.kind === "blocked" && (
        <Banner tone="danger">
          חסמתם התראות לאתר הזה. כדי להפעיל צריך לאשר אותן מחדש בהגדרות הדפדפן —
          מכאן אי אפשר לבקש שוב.
        </Banner>
      )}

      {state.kind === "unconfigured" && (
        <Surface tone="sunken" padding="sm" className="flex min-w-0 flex-col gap-1 text-sm">
          <p className="font-semibold text-danger-ink">
            התראות לא הוגדרו בשרת
          </p>
          <p className="text-muted">
            מפתח ה-VAPID הציבורי חסר בגרסה שנבנתה. הוא נצרב בזמן ה-build, ולכן
            הוספה שלו ב-Vercel דורשת build חדש — דיפלוי שמשתמש ב-Build Cache
            ימשיך להשתמש בגרסה הישנה.
          </p>
        </Surface>
      )}

      {state.kind === "error" && (
        <Banner tone="danger">{state.message}</Banner>
      )}

      {(state.kind === "off" || state.kind === "error") && (
        <Button
          type="button"
          onClick={() => void enable()}
          loading={busy}
          className="self-start"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          הפעלת תזכורות
        </Button>
      )}

      {state.kind === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-sm text-success-ink">
            <Check className="h-4 w-4" aria-hidden="true" />
            תזכורות פעילות במכשיר הזה
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void disable()}
            loading={busy}
            className="ms-auto"
          >
            <BellOff className="h-4 w-4" aria-hidden="true" />
            כיבוי
          </Button>
        </div>
      )}
    </Card>
  );
}
