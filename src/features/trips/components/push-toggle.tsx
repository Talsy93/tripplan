"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import { Button, Card } from "@/components/ui";
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
  | { kind: "error"; message: string };

// VAPID's public key travels to the browser and is safe there — it is the
// identity a push service checks the signature against, not a secret.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// The Push API wants the key as bytes; it is published as base64url.
function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
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
      setState({ kind: "error", message: "התראות לא הוגדרו בשרת." });
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
    try {
      // Must be called from the click itself — iOS rejects a permission request
      // that is not tied to a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "blocked" } : { kind: "off" });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required to be true by every browser: a push must always be visible
        // to the user, never silent background work.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
      });

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
        setState({ kind: "error", message: result.message ?? "ההפעלה נכשלה." });
        return;
      }
      setState({ kind: "on" });
    } catch (error) {
      // Say what actually went wrong. A bare "it failed" here was the same
      // mistake C1 was about: the reason existed and was thrown away, leaving
      // nothing to act on. The browser's own message names the cause —
      // an unreachable push service, a key mismatch, a revoked permission.
      console.error("[push] enable failed:", error);
      const detail =
        error instanceof Error && error.message
          ? `${error.name}: ${error.message}`
          : String(error);
      setState({ kind: "error", message: `ההפעלה נכשלה — ${detail}` });
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
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          {state.kind === "on" ? "🔔" : "🔕"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-display text-lg">תזכורות למכשיר</h3>
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
        <div className="flex flex-col gap-2 rounded-control bg-surface-2 p-3 text-sm">
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
        </div>
      )}

      {state.kind === "unsupported" && (
        <p className="text-sm text-muted">
          הדפדפן הזה לא תומך בהתראות. ההתראות ימשיכו להופיע בתוך האפליקציה.
        </p>
      )}

      {state.kind === "blocked" && (
        <p className="text-sm text-danger-ink">
          חסמתם התראות לאתר הזה. כדי להפעיל צריך לאשר אותן מחדש בהגדרות הדפדפן —
          מכאן אי אפשר לבקש שוב.
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-sm text-danger-ink">{state.message}</p>
      )}

      {(state.kind === "off" || state.kind === "error") && (
        <Button
          type="button"
          onClick={() => void enable()}
          loading={busy}
          className="self-start"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          הפעילו תזכורות
        </Button>
      )}

      {state.kind === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-success-ink">
            ✓ תזכורות פעילות במכשיר הזה
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
            כבו
          </Button>
        </div>
      )}
    </Card>
  );
}
