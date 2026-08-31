import type { ReactNode } from "react";
import { AuraField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { tripHuesFromVars } from "../domain/aura-vars";

// A lit panel, inside a screen that is otherwise white cards on grey.
//
// One per screen, and that cap is the whole idea. The design gave the discovery
// screen exactly one element with full light — the AI's suggestion — because a
// screen where everything glows has nothing that stands out. Everywhere else the
// tone system does the identifying with a dot and a tinted tile.
//
// Text sits on the light here, which the token file says to avoid — "text that
// has to be read sits on an opaque surface, always". The exception holds only
// because of the veil: AuraField's floor is what the rule is really about, and
// this panel keeps headings and one line of intro above it. Anything longer, or
// anything a person has to read carefully, still goes on an opaque card below.
//
// The hues come from CSS variables rather than props (see domain/aura-vars.ts),
// so a component this deep in a tab gets the trip's real colour without either
// prop-drilling through five layers or recomputing an assignment that costs two
// queries.
export function AuraPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-tile bg-aura-base p-4 text-white sm:p-5",
        className,
      )}
    >
      <AuraField hues={tripHuesFromVars(true)} blur={38} />
      <div className="relative flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}
