import Link from "next/link";
import type { ReactNode } from "react";
import { Compass } from "lucide-react";

// The top bar of the home screen. v7 (Pencil): a teal tile with a compass and
// the wordmark (the subtitle stays, small, under it) at the start, round actions at the end, on
// the same frosted canvas as AppHeader.
export function BrandHeader({
  subtitle,
  trailing,
}: {
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[66rem] items-center justify-between px-4 md:px-6 lg:px-8">
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col text-right">
            <span className="text-xl font-bold leading-none text-foreground">
              MyTrip
            </span>
            <span className="text-[10px] font-medium leading-[14px] tracking-[0.02em] text-muted-strong">
              {subtitle}
            </span>
          </span>
        </Link>
        {trailing && <div className="flex items-center gap-1">{trailing}</div>}
      </div>
    </header>
  );
}
