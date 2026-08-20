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
      {/* Fixed to the corner rather than a full-width strip, so it sits
          beside the screen instead of pushing content down — and stacks
          without needing to know how many are already showing. */}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:start-4 sm:items-end">
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
        "pointer-events-auto flex w-full max-w-72 items-start gap-2 rounded-card bg-surface p-3 shadow-lift transition-all duration-200 ease-snap",
        shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      <Icon
        className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_CLASS[toast.tone])}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגירה"
        className="shrink-0 rounded text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
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
