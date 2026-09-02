"use client";

import { Button, useToast } from "@/components/ui";

// The save confirmation, on demand.
//
// It had no scene, and it is the one piece of feedback in the app that cannot
// be looked at by loading a URL: it appears for three and a half seconds after
// a server action succeeds, and every action that fires one is behind a
// session. So the only way to see it was to save a real booking in a real
// account, which is why it went a long time at a size nobody had looked at.
//
// A client file rather than a registry entry, for the same reason motion-demo
// and swipe-demo are: scenes.tsx is a server module and this needs a button.
export function ToastDemo() {
  const { showToast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => showToast("הטיסה נוספה")}>הצלחה</Button>
      <Button
        variant="outline"
        onClick={() => showToast("הטיסה נמחקה", "info")}
      >
        מידע
      </Button>
      <Button
        variant="outline"
        onClick={() => showToast("השמירה נכשלה. נסו שוב.", "danger")}
      >
        שגיאה
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          showToast(
            "הלו״ז נבנה אבל השמירה נכשלה. הלו״ז הקודם נשמר. נסו שוב.",
          )
        }
      >
        הודעה ארוכה
      </Button>
    </div>
  );
}
