"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LocateFixed, LocateOff } from "lucide-react";
import { Banner, Button } from "@/components/ui";
import { instantToWallClock } from "@/lib/datetime";
import { APP_TIME_ZONE } from "../domain/weather";
import { detectArrival, reflowFromArrival } from "../domain/reflow";
import type { ItineraryDay, ItineraryEntry } from "../domain/ai-suggestion";
import { RescheduleDialog } from "./reschedule-dialog";

const CONSENT_KEY = "mytrip:arrival-watch";
const CONSENT_EVENT = "mytrip:arrival-watch-change";

// The consent lives in localStorage and is read through useSyncExternalStore,
// so the first client render agrees with the server (unknown) and the stored
// answer arrives without an effect setting state.
function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "on";
  } catch {
    return false;
  }
}

function writeConsent(on: boolean) {
  try {
    window.localStorage.setItem(CONSENT_KEY, on ? "on" : "off");
  } catch {
    // Fine — it just will not be remembered.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

const noop = () => () => {};

// Follows the phone while the trip runs and notices when you are standing at
// one of today's places earlier or later than planned. Then it asks — never
// moves the day on its own.
//
// Opt-in, twice over: the browser asks for location, and before that we ask
// whether to watch at all, because a permission prompt with no explanation is
// the fastest way to a "block" that cannot be undone from inside the page.
// The choice is kept in localStorage; it is about this device.
//
// Background delivery is best-effort: a page that is not open cannot read the
// GPS. When the tab is hidden and a notification permission exists, a local
// notification is raised so the phone buzzes; tapping it brings the page back
// with the prompt waiting. Server push for this would need the server to know
// where you are, which it does not and should not.
export function ArrivalWatcher({
  tripId,
  day,
}: {
  tripId: string;
  day: ItineraryDay;
}) {
  // null on the server and during hydration: nothing is drawn until the
  // device has answered whether it consented before.
  const watching = useSyncExternalStore<boolean | null>(
    subscribeConsent,
    readConsent,
    () => null,
  );
  const supported = useSyncExternalStore(
    noop,
    () => "geolocation" in navigator,
    () => true,
  );
  const [arrived, setArrived] = useState<ItineraryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // Places already asked about this session, so a "no" is not re-asked every
  // few seconds while you stand there.
  const asked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!watching || !supported) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const wall = instantToWallClock(new Date().toISOString(), APP_TIME_ZONE);
        const [h, m] = wall.slice(11).split(":").map(Number);
        const nowMinutes = h * 60 + m;
        const entry = detectArrival(
          day,
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          nowMinutes,
        );
        if (!entry || asked.current.has(entry.id)) return;
        if (reflowFromArrival(day, entry.id, nowMinutes).length === 0) return;

        asked.current.add(entry.id);
        setArrived(entry);
        notify(entry.title);
      },
      () => setUnavailable(true),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching, supported, day]);

  function enable() {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setUnavailable(false);
    writeConsent(true);
  }

  function disable() {
    writeConsent(false);
    setArrived(null);
  }

  if (watching === null) return null;

  return (
    <>
      {arrived && !dialogOpen && (
        <Banner tone="callout" icon={<LocateFixed className="h-4 w-4" />}>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-0 flex-1">
              זיהינו שהגעתם ל<b>{arrived.title}</b> — מתוכנן ל-{arrived.startLabel}.
              לעדכן את שעות הלו״ז?
            </span>
            <span className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                כן, עדכנו
              </Button>
              <Button size="sm" variant="outline" onClick={() => setArrived(null)}>
                לא עכשיו
              </Button>
            </span>
          </span>
        </Banner>
      )}

      {!watching ? (
        <button
          type="button"
          onClick={enable}
          className="flex w-full items-center gap-3 rounded-card border border-dashed border-border-strong px-4 py-3 text-start text-sm transition-colors hover:border-primary hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LocateFixed className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">לעדכן את הלו״ז לפי המיקום</span>
            <span className="block text-caption text-muted">
              כשתגיעו למקום מוקדם או מאוחר, נשאל אם להזיז את השעות. המיקום נשאר
              בטלפון.
            </span>
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 text-caption text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            {unavailable || !supported ? (
              <>
                <LocateOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                אין גישה למיקום — בדקו את הרשאות הדפדפן
              </>
            ) : (
              <>
                <LocateFixed className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden="true" />
                עוקבים אחרי המיקום כדי לעדכן את הלו״ז
              </>
            )}
          </span>
          <button
            type="button"
            onClick={disable}
            className="shrink-0 font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            הפסיקו
          </button>
        </div>
      )}

      {arrived && (
        <RescheduleDialog
          tripId={tripId}
          day={day}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setArrived(null);
          }}
          initialEntryId={arrived.id}
          nowIso={new Date().toISOString()}
        />
      )}
    </>
  );
}

function notify(title: string) {
  if (typeof document === "undefined" || document.visibilityState === "visible") {
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification("הגעתם ל" + title, {
      body: "לעדכן את שעות הלו״ז לפי השעה הנוכחית? פתחו את MyTrip.",
      tag: "mytrip-arrival",
    });
  } catch {
    // Some browsers only allow notifications from a service worker; the
    // in-page banner is still there when the tab comes back.
  }
}
