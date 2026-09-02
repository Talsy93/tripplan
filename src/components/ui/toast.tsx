"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "danger" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, typeof Info> = {
  success: CircleCheck,
  danger: CircleAlert,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success-ink",
  danger: "text-danger-ink",
  info: "text-action-ink",
};

const VISIBLE_MS = 3_500;

// A corner card that confirms something just happened — "the flight was
// added" — and clears itself without being asked. Distinct from Banner, which
// stays on screen until the user or the page moves on: a toast is only ever
// good news about an action just taken, never something that needs a
// decision, so it doesn't earn a place in the layout.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Bottom of the screen, and on the *end* edge from sm up.

          It was `top-4` + `sm:start-4`, which in RTL is the inline start —
          the right — and that is exactly where the 248px desktop rail is.
          Measured at 1440: 100% of the toast landed on the rail, a white card
          over the dark navigation for 3.5s. Reported as bookings saving with
          no confirmation at all, and that is a fair reading of it.

          Bottom rather than top because the top of a trip screen is the app
          bar and the trip's light band, and the end edge because the rail owns
          the start edge on every screen that has one.

          The phone offset clears the floating bottom bar — the same
          6rem + safe-area AppShell's main uses, measured against that bar. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-stretch gap-2 md:bottom-6 sm:inset-x-auto sm:end-4 sm:items-start">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  // Mounted just after paint, so the enter transition actually plays instead
  // of the card appearing at its resting state on the first frame.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const Icon = TONE_ICON[toast.tone];

  return (
    <div
      role="status"
      className={cn(
        // max-w-96 and p-4, up from max-w-72 and p-3.
        //
        // It was sized as an aside and read as one: 288px of 14px text in the
        // corner, gone in three and a half seconds, on a screen where the thing
        // it is confirming has just disappeared from. The confirmation that a
        // booking saved is the only feedback that action gets, so it has to be
        // able to catch the eye from wherever the eye actually was.
        //
        // 384px is still comfortably under what the phone container leaves at
        // 375px, so the cap keeps doing its job there — it just stops being the
        // binding constraint on a desktop, where there was no reason for a
        // confirmation to be narrower than a form field.
        //
        // The min-width is what actually resized the common case, and finding
        // that out took measuring rather than reading. From sm up the row is
        // `items-start`, so the card shrinks to its content and the max-width
        // never binds: "הטיסה נוספה" rendered at 175px however high the cap
        // went. Raising the ceiling only ever helped the long messages. A floor
        // is what gives a four-word confirmation the presence of a card instead
        // of a chip, and the two together mean every toast now lands between
        // 320 and 384px rather than between 90 and 288.
        "pointer-events-auto flex w-full items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-lift transition-all duration-200 ease-snap sm:min-w-80 sm:max-w-96",
        // Rises into place, because it now comes from the bottom edge.
        shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0",
      )}
    >
      {/* The icon grows with the text rather than staying at 16px beside it: at
          the larger size a small glyph reads as a bullet point instead of as
          the status mark it is. */}
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", TONE_CLASS[toast.tone])}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-base font-semibold">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגירה"
        // -m-1 p-1: the tap target grows to 28px without the X moving or the
        // row getting taller, because the padding is cancelled by the negative
        // margin. A 14px close button was under every touch-target minimum
        // there is, and it is the one control on this card.
        className="-m-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// Throws outside the provider on purpose: a toast fired from a component the
// provider doesn't wrap is a wiring bug, not a state worth falling back on.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
