import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  // Drawn, but not a link yet — "היום" before the trip starts. The reason goes
  // in `title` and in a visually hidden sentence.
  waiting?: string;
};

// The phone's tab bar, in the Stitch design (v6): a full-width frosted bar
// pinned to the bottom edge, each tab an icon in a capsule over a small label.
// The capsule fills in the light maritime tint when the tab is the one you are
// on — a filled shape, not only a colour change, because colour alone washes
// out in direct sun, which is the light a travel app is used in.
//
// It used to be a floating glass pill with an ink capsule. Stitch pins it to
// the edge and draws the lift as an upward blue-tinted shadow instead.
export function BottomNav({
  items,
  className,
  accent = "brand",
}: {
  items: NavItem[];
  // "cta" is the home export's footer: the tab you are on in terracotta, with
  // no capsule behind its icon.
  accent?: "brand" | "cta";
  className?: string;
}) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(2,132,199,0.08)] backdrop-blur-xl md:hidden",
        className,
      )}
    >
      <ul className="mx-auto flex h-16 max-w-xl items-center justify-around px-2">
        {items.map((item) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full",
                  "transition-[background-color,color] duration-settle ease-snap",
                  item.active &&
                    accent === "brand" &&
                    "bg-primary-tint text-brand-2 shadow-soft",
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 max-w-full truncate px-0.5">
                {item.label}
              </span>
            </>
          );

          const shape =
            "mx-auto flex min-h-11 max-w-20 flex-col items-center justify-center gap-0.5 text-[0.6875rem] leading-4";

          return (
            <li key={item.href} className="min-w-0 flex-1">
              {item.waiting ? (
                <span
                  title={item.waiting}
                  className={cn(shape, "font-medium text-border-strong")}
                >
                  {body}
                  <span className="sr-only">— {item.waiting}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  prefetch
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    shape,
                    "rounded-control transition-[color,transform] duration-press ease-snap active:scale-[0.94]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.active
                      ? accent === "cta"
                        ? "font-semibold text-cta-strong"
                        : "font-semibold text-brand-2"
                      : "font-medium text-muted hover:text-foreground",
                  )}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
