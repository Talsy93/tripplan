"use client";

import { useState } from "react";
import { Check, Copy, Globe, Link2Off } from "lucide-react";
import { Banner, Button, Card, Input, useToast } from "@/components/ui";
import { disableSharing, enableSharing } from "../application/share-actions";

export function ShareTrip({
  tripId,
  initialToken,
  origin,
}: {
  tripId: string;
  // The token the trip already has, or null when it is not shared.
  initialToken: string | null;
  // The site's own origin, resolved on the server from the request. See below
  // for why this is not read from `window`.
  origin: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  // 🐞 This used to be `window.location.origin`, and it crashed the page.
  //
  // A "use client" component is still rendered on the server for the initial
  // HTML, and this expression sits in the component body rather than in an
  // event handler — so it ran during SSR, where `window` does not exist, and
  // threw `ReferenceError: window is not defined`.
  //
  // It never showed up in testing because of the `token ?` in front of it: with
  // no share link issued the branch is never evaluated. It broke for exactly
  // the users who *had* already shared a trip — the ones for whom this screen
  // matters — and it broke on load, not on click.
  //
  // The origin now comes from the request on the server, which keeps the
  // property the old comment was protecting: the link is right on localhost, on
  // a preview deployment and in production, with nothing to configure.
  const url = token ? `${origin}/share/${token}` : null;

  async function enable() {
    setWorking(true);
    const issued = await enableSharing(tripId);
    if (issued) {
      setToken(issued);
      showToast("הקישור נוצר");
    } else {
      showToast("יצירת הקישור נכשלה. נסו שוב.", "danger");
    }
    setWorking(false);
  }

  async function disable() {
    setWorking(true);
    if (await disableSharing(tripId)) {
      setToken(null);
      setCopied(false);
      showToast("הקישור בוטל");
    } else {
      showToast("ביטול הקישור נכשל. נסו שוב.", "danger");
    }
    setWorking(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("הקישור הועתק");
    } catch {
      // Clipboard access can be refused (an insecure origin, or a permission
      // the user denied). The field below is selectable either way, so this
      // says so instead of failing silently.
      showToast("לא הצלחנו להעתיק. סמנו את הקישור והעתיקו ידנית.", "danger");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      {!token ? (
        <>
          <p className="text-sm text-muted">
            יצירת קישור לצפייה בלבד — מי שיקבל אותו יראה את הלו״ז, התחנות
            והטיסות, אבל לא יוכל לשנות כלום.
          </p>
          <Button
            type="button"
            onClick={() => void enable()}
            loading={working}
            className="self-start"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            יצירת קישור שיתוף
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={url ?? ""}
              dir="ltr"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1"
              aria-label="קישור השיתוף"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy()}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "הועתק" : "העתקה"}
            </Button>
          </div>

          {/* Said plainly, because the person deciding to send this link is
              the only one who can judge whether that is acceptable. */}
          <Banner tone="info">
            כל מי שיש לו הקישור יכול לצפות, בלי סיסמה. מספרי אישור, כתובות
            מדויקות ומחירים לא מוצגים שם.
          </Banner>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void disable()}
            loading={working}
            className="self-start"
          >
            <Link2Off className="h-4 w-4" aria-hidden="true" />
            ביטול הקישור
          </Button>
        </>
      )}
    </Card>
  );
}
