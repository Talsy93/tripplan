import type { ReactNode } from "react";
import { Compass, FolderOpen, Layers, MessageCircle, Route } from "lucide-react";
import { PageEnter } from "@/components/layout";
import { cn } from "@/lib/cn";

// The frame every signed-out screen shares, from design/pencil/exports/
// login-mobile: no card — the warm canvas itself — with the teal logo tile,
// the wordmark and a tagline over a single 24rem column. Sign-in, sign-up,
// password reset, the new-password form and the "check your inbox" state all
// sit in it, so moving between them changes the fields and nothing else.
//
// PN20 (Pencil login-tablet / login-desktop): from md the column is a white
// card centred on the canvas; from lg the window splits — the teal gradient
// half carries the wordmark and what the app does, and the form sits on the
// canvas beside it, the card dropped because the half is the frame now.
const PITCH = [
  { Icon: Layers, text: "מחליקים על מקומות ושומרים את מה שאוהבים" },
  { Icon: Route, text: "לו״ז מסודר לכל יום, עם מפה" },
  { Icon: MessageCircle, text: "עוזר מקומי שמכיר את הטיול שלכם" },
  { Icon: FolderOpen, text: "טיסות, מלונות והוצאות — ביד" },
];

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
    <div className="flex min-h-dvh">
      <aside className="hidden w-[35rem] shrink-0 flex-col justify-between bg-[image:var(--hero-gradient)] p-14 text-white lg:flex">
        <p className="flex items-center gap-3 text-[22px] font-bold">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15"
          >
            <Compass className="h-6 w-6" />
          </span>
          MyTrip
        </p>
        <div className="flex flex-col gap-7">
          <p className="text-[40px] font-bold leading-tight">כל הטיול במקום אחד</p>
          <p className="-mt-3 text-xl text-white/70">מהרעיון ועד הבית</p>
          <ul className="flex flex-col gap-4">
            {PITCH.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.12]"
                >
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">חינם · עובד גם בטלפון</p>
      </aside>

      <main className="flex min-h-dvh flex-1 flex-col items-center px-4 pb-10 pt-16 sm:justify-center sm:pt-10">
        <PageEnter className="w-full max-w-sm gap-7 md:max-w-[28.75rem] md:rounded-[28px] md:bg-surface md:p-10 md:shadow-lift lg:max-w-[25rem] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
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
    </div>
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
