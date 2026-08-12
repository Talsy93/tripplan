import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "ghost" | "surface" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  surface: "border border-border bg-surface text-foreground hover:bg-surface-2",
  danger: "text-muted hover:bg-danger-tint hover:text-danger-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

// Icon-only button. `label` is required and becomes the accessible name —
// an icon alone says nothing to a screen reader.
type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> & {
  label: string;
  variant?: Variant;
  size?: Size;
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
