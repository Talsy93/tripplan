import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// One focus treatment for the whole app. Before phase D this ring existed here
// and on Chip and IconButton, was missing its offset on Input and Textarea, and
// was absent entirely from the nav bars — so "where am I" changed meaning
// depending on which control you had tabbed to.
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// `transition-colors` was the whole of the old feel, and it is why pressing
// anything read as flat: the fill faded and nothing else acknowledged the
// finger. Now the surface answers — it dips 3% under the press and comes back
// on the app's own curve.
//
// active: rather than :hover for the dip, because a phone has no hover and
// this is the feedback that matters there. duration-press is 150ms, fast
// enough to feel like an answer rather than an animation.
//
// The global prefers-reduced-motion block collapses every duration in the
// app to 0.01ms, so there is no separate opt-out to maintain here.
const base = cn(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold",
  "transition-[background-color,border-color,color,box-shadow,transform] duration-press ease-snap",
  "active:scale-[0.97]",
  focusRing,
  "disabled:opacity-50 disabled:pointer-events-none",
);

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  soft: "bg-primary-tint text-primary-ink hover:bg-primary-tint/70",
  outline:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-primary-ink hover:bg-primary-tint",
  // Was `hover:text-white`, the one raw palette value left in the primitive
  // layer. The token says the same thing and survives a theme change.
  danger:
    "bg-danger-tint text-danger-ink hover:bg-danger hover:text-primary-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

// Exposed so links can look like buttons without nesting <button> in <a>.
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      // A button that is working is not a button you can press again.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
