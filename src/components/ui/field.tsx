import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// One control skin for every field, so a text input and a select sitting in the
// same grid row stop having different corners and different heights — which is
// exactly what booking-form looked like before phase D (rounded-lg select next
// to a rounded-control input).
const control = cn(
  // `min-w-0` alongside `w-full`, and the two are not the same thing.
  // `w-full` is `width: 100%`, which says nothing about how small the box may
  // get: a flex or grid item keeps `min-width: auto`, floored at its own
  // min-content. For an <input> that floor is the width implied by the `size`
  // attribute — roughly 20 characters — and for date/datetime-local it is wider
  // still, because the box has to fit "dd/mm/yyyy --:--" plus a picker glyph.
  // So a single date field could hold a whole grid track open wider than the
  // phone it was being read on.
  "w-full min-w-0 rounded-control border border-border-strong bg-surface text-foreground",
  // 16px on touch devices, inherited size everywhere else.
  //
  // iOS Safari zooms the whole viewport when it focuses a control whose
  // font-size is under 16px, and never zooms back out. The controls carry no
  // size of their own and inherit one, so those in a dense form (`text-sm` on
  // the wrapping label) were 14px and triggered it.
  //
  // A Tailwind variant and not a raw `@media (pointer: coarse)` block in
  // globals.css, which is where this started. That rule was present in a local
  // production build and **absent from the one Vercel served** — the two use
  // different build pipelines (local emits static/chunks, Vercel
  // static/immutable/chunks), and the hand-written at-rule did not survive
  // theirs. `min-w-0` on this same line did survive, so a utility is the
  // mechanism that demonstrably reaches production.
  //
  // `pointer-coarse` and not a width breakpoint: the trigger is touch, so a
  // 768px iPad needs it and a 375px desktop window does not. Desktop keeps the
  // 14px it was designed with.
  "pointer-coarse:text-base",
  "placeholder:text-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:opacity-50 disabled:pointer-events-none",
  "aria-[invalid=true]:border-danger",
);

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-10 px-3", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(control, "px-3 py-2", className)} {...props} />
  );
}

// A native <select> with the platform arrow suppressed and our own drawn in.
// Native on purpose: the mobile wheel picker is better than anything a custom
// listbox would give us here, and it is one less thing to make accessible.
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    // min-w-0 on the wrapper too: it is the element that becomes the flex/grid
    // item, so the select's own min-w-0 cannot help unless its wrapper can also
    // be squeezed.
    <div className="relative min-w-0">
      <select
        className={cn(control, "h-10 appearance-none ps-3 pe-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-muted"
      />
    </div>
  );
}

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Label + control + message, stacked. Uses <label> wrapping rather than htmlFor
// so callers do not have to invent ids; the association is structural and
// cannot go stale.
export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    // min-w-0 by default: a Field is very often a flex item in a `sm:flex-row`
    // of two, and without it the row is floored at the sum of the two controls'
    // intrinsic widths. Several call sites had learned to pass `min-w-0`
    // themselves, which is a sign it belonged here.
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="text-caption text-danger-ink">{error}</span>
      ) : hint ? (
        <span className="text-caption text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
