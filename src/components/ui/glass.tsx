import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Chrome that floats over content instead of framing it.
//
// Used sparingly, and only where translucency does something an opaque colour
// cannot: a bar the content scrolls under, a chip over the aura, a panel that
// picks up the light behind it. Anything that has to be *read* goes on an
// opaque surface — a blurred gradient behind body copy is the one failure mode
// every reference on this warns about, and it is a real contrast problem, not a
// taste one.
//
// Two tones, because what sits behind is either the aura or the app canvas:
//
//   dark  — over the aura or a photo. White text.
//   light — over the app canvas. Foreground text.
//
// The 1px inset top edge is not decoration: it is what makes the surface read
// as glass rather than as a panel left at 40% opacity. Without it the blur
// alone looks like a rendering fault.

export type GlassTone = "dark" | "light";

const tones: Record<GlassTone, string> = {
  dark: [
    "border border-glass-dark-border bg-glass-dark text-white",
    "shadow-[var(--glass-dark-highlight)]",
    "backdrop-blur-md backdrop-saturate-150",
  ].join(" "),
  light: [
    "border border-glass-light-border bg-glass-light text-foreground",
    "shadow-[0_10px_32px_-14px_rgba(12,20,40,0.4),var(--glass-light-highlight)]",
    "backdrop-blur-xl backdrop-saturate-[1.8]",
  ].join(" "),
};

export function glassClasses(tone: GlassTone = "dark"): string {
  return tones[tone];
}

type GlassProps = HTMLAttributes<HTMLDivElement> & { tone?: GlassTone };

export function Glass({ tone = "dark", className, ...props }: GlassProps) {
  return <div className={cn(glassClasses(tone), className)} {...props} />;
}
