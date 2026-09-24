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

// The phone's tab bar, in the Pencil design (v7): a capsule floating 16px in
// from the edges and 12px above the bottom, and the tab you are on filled with
// the light teal tint — a filled shape, not only a colour change, because
// colour alone washes out in direct sun, which is the light a travel app is
// used in. (v6 pinned it to the edge; v5 was a glass pill with an ink capsule.)
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
        "fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-full border border-border bg-surface/90 shadow-lift backdrop-blur-xl md:hidden",
        className,
      )}
    >
      <ul className="mx-auto flex h-[60px] max-w-xl items-stretch justify-around p-[5px]">
        {items.map((item) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 items-center justify-center",
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
            "flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] leading-4";

          return (
            <li key={item.href} className="min-w-0 flex-1">
              {item.waiting ? (
                <span
                  title={item.waiting}
                  className={cn(shape, "font-medium text-muted opacity-40")}
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
                        : "bg-primary-tint font-semibold text-primary"
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
