import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./button";

// The filter pill existed five times before phase D: this file (with one
// caller), twice in booking-form, once in manual-place-form, and once more as a
// chat opener. The copies disagreed on the active fill (bg-foreground vs
// bg-primary), on padding (px-3.5 vs px-3) and on weight. Two of them were
// <label><input type="radio"> rather than buttons, which is why this file now
// exports the classes and both shapes instead of just a button.
export function chipClasses(active: boolean, className?: string) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border-strong bg-surface text-foreground hover:bg-surface-2",
    className,
  );
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

// Rendered as a button so it is reachable by keyboard and announces its state.
export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(chipClasses(active), focusRing, className)}
      {...props}
    />
  );
}

type ChipRadioProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "children"
> & {
  label: ReactNode;
  className?: string;
};

// Same pill, one-of-many semantics. The radio itself stays in the DOM and only
// the visual is replaced, so arrow-key navigation within the group and the
// native `required` behaviour both keep working — the hand-rolled copies threw
// that away by using a plain button and tracking state in React.
export function ChipRadio({
  label,
  className,
  checked,
  ...props
}: ChipRadioProps) {
  return (
    <label
      className={cn(
        chipClasses(Boolean(checked)),
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
    >
      <input type="radio" className="sr-only" checked={checked} {...props} />
      {label}
    </label>
  );
}
