import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout";
import { getTrip, TripNav } from "@/features/trips";

// Shared chrome for the five trip tabs.
//
// This lives in a (tabs) route group rather than at [id]/layout.tsx so that
// city/[city] — which has its own back link and no tab bar — does not inherit
// it. App Router does not re-render a layout when navigating between its own
// children, so the header and nav survive a tab switch untouched.
export default async function TripTabsLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  return (
    <AppShell
      header={
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
            <Link
              href="/profile"
              className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              {/* In RTL "back" points left, and the glyph is chosen by
                  meaning rather than by mirroring the LTR arrow. */}
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              הטיולים שלי
            </Link>
            <span className="mx-auto font-display text-sm">{trip.name}</span>
            {/* Balances the back link so the title stays optically centred. */}
            <span className="w-20" aria-hidden="true" />
          </div>
        </header>
      }
      nav={<TripNav tripId={trip.id} />}
    >
      {children}
    </AppShell>
  );
}
