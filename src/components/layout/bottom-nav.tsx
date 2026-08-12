"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

// The phone navigation bar. Domain-free: it is handed items and renders them.
//
// It reads the pathname itself rather than being told which item is active,
// because the layout that composes it is a server component and cannot know
// the active child segment — that needs a client hook.
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch justify-around px-1 pt-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-control py-1.5 text-[11px] transition-colors",
                  active
                    ? "font-bold text-primary"
                    : "text-muted hover:text-foreground",
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
