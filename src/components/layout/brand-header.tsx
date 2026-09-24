import Link from "next/link";
import type { ReactNode } from "react";

// The top bar of the home export (design/stitch/…/home): the app icon and the
// wordmark over a small subtitle at the start, round actions at the end, on
// the same frosted canvas as AppHeader.
export function BrandHeader({
  subtitle,
  trailing,
}: {
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-background/85 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[66rem] items-center justify-between px-4 md:px-6 lg:px-8">
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a 32px icon
              the browser already has cached from the manifest. */}
          <img
            src="/icon-192.png?v=2"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="flex flex-col text-right">
            <span className="text-[18px] font-semibold leading-none text-primary">
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
