import Link from "next/link";
import { ArrowLeft, ChevronDown, Compass } from "lucide-react";
import { Card } from "@/components/ui";
import { WORKFLOW_STEPS } from "../domain/workflow";

// The same seven-then-eight steps as WorkflowGuide, reduced to their titles.
//
// Two call sites need "what does this app expect me to do", in a space too small
// for the full guide: the new-trip dialog, and the collapsed state of the help
// section on the home screen. Both read from WORKFLOW_STEPS, so there is exactly
// one place where a step is renamed or reordered — which is the reason the steps
// were put in the domain rather than written as JSX in the guide page.
//
// The titles already carry their own numbers ("1. תאריכים"), so this is a plain
// <ul> with the number shown as typed rather than an <ol> that would print a
// second one beside it.
export function WorkflowSummary({ className }: { className?: string }) {
  return (
    <ul className={className}>
      {WORKFLOW_STEPS.map((step) => (
        <li
          key={step.id}
          className="flex items-baseline gap-2 border-b border-dashed border-border py-1.5 last:border-b-0"
        >
          <span className="min-w-0 text-sm font-semibold wrap-anywhere">
            {step.title}
          </span>
          {/* The action label doubles as "where this happens" — "פרטי הטיול",
              "מה עושים?" are the tab names the reader will be looking for. */}
          <span className="ms-auto shrink-0 text-caption text-muted">
            {step.action}
          </span>
        </li>
      ))}
    </ul>
  );
}

// "איך זה עובד" on the home screen.
//
// Built on native <details>/<summary> rather than useState: it is a server
// component this way, it works before hydration, the browser handles the
// keyboard and the open/closed state is exposed to assistive tech for free.
// There is no state here worth a client bundle.
//
// `defaultOpen` is decided by the caller from whether the user has any trips.
// Someone with no trips has never seen the app work and needs the order of
// operations in front of them; someone with four trips knows it, and an
// expanded help panel above their trip list is just something to scroll past.
export function HowItWorks({
  defaultOpen,
  tripId,
}: {
  defaultOpen: boolean;
  // The most recent trip, for the "full guide" link. Null before the first one,
  // where the full guide has no trip to describe.
  tripId: string | null;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
            aria-hidden="true"
          >
            <Compass className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">איך זה עובד</span>
            <span className="block text-sm text-muted">
              סדר העבודה באפליקציה, משמונה שלבים
            </span>
          </span>
          {/* Rotates on open. The marker is removed by list-none above, so this
              is the only affordance saying the row expands. */}
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
          <WorkflowSummary />
          {tripId && (
            <Link
              href={`/trips/${tripId}/more/guide`}
              className="flex items-center gap-1 self-start rounded-control text-sm font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              המדריך המלא, עם קישור לכל מסך
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </details>
    </Card>
  );
}
