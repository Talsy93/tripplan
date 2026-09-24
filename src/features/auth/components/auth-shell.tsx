import type { ReactNode } from "react";
import { Compass } from "lucide-react";
import { PageEnter } from "@/components/layout";
import { cn } from "@/lib/cn";

// The frame every signed-out screen shares, from design/pencil/exports/
// login-mobile: no card — the warm canvas itself — with the teal logo tile,
// the wordmark and a tagline over a single 24rem column. Sign-in, sign-up,
// password reset, the new-password form and the "check your inbox" state all
// sit in it, so moving between them changes the fields and nothing else.
export function AuthShell({
  tagline = "כל הטיול במקום אחד — מהרעיון ועד הבית",
  children,
  footer,
}: {
  tagline?: ReactNode;
  children: ReactNode;
  // The "אין לכם חשבון? הרשמה" line under the column.
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pb-10 pt-16 sm:justify-center sm:pt-10">
      <PageEnter className="w-full max-w-sm gap-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[image:var(--hero-gradient)] text-white shadow-card"
          >
            <Compass className="h-8 w-8" />
          </span>
          <p className="text-[30px] font-bold leading-none text-foreground">MyTrip</p>
          <p className="text-sm text-muted">{tagline}</p>
        </div>

        {children}

        {footer && <p className="text-center text-sm text-muted">{footer}</p>}
      </PageEnter>
    </main>
  );
}

// "או במייל" between the Google button and the fields.
export function AuthDivider({ label = "או במייל" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-caption text-outline">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// The Pencil auth field: white, a hairline, 52px tall, corners of 14, with an
// icon at the start. Layered on the shared Input rather than changed in it.
// The inputs themselves are dir="ltr" (addresses and passwords are Latin), so
// the icon's side is set physically on them: `pe-11` on an LTR input is its
// right edge, which is the start of this RTL page.
export const authField = (withIcon: boolean) =>
  cn("h-13 rounded-[14px] border-border bg-surface", withIcon && "pe-11");

export const authFieldIcon =
  "pointer-events-none absolute inset-y-0 start-3.5 my-auto h-5 w-5 text-outline";

// The one terracotta button of each screen, full width and round.
export const authSubmit = "h-13 w-full rounded-full text-base";

// A state that replaces a form — "check your inbox", "password updated": an
// icon disc, a heading, and whatever follows.
export function AuthNotice({
  icon,
  title,
  tone = "primary",
  children,
}: {
  icon: ReactNode;
  title: string;
  tone?: "primary" | "success";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[72px] w-[72px] items-center justify-center rounded-full [&_svg]:h-8 [&_svg]:w-8",
          tone === "success" ? "bg-success-tint text-success" : "bg-primary-tint text-primary",
        )}
      >
        {icon}
      </span>
      <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
      <div className="flex w-full flex-col gap-3 text-sm text-muted">{children}</div>
    </div>
  );
}
