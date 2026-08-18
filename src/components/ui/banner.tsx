import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "callout" | "success" | "danger";

const tones: Record<Tone, string> = {
  info: "bg-action-tint text-action-ink",
  callout: "bg-callout-tint text-callout-ink",
  success: "bg-success-tint text-success-ink",
  danger: "bg-danger-tint text-danger-ink",
};

const icons: Record<Tone, typeof Info> = {
  info: Info,
  callout: AlertTriangle,
  success: CircleCheck,
  danger: CircleAlert,
};

type BannerProps = {
  tone?: Tone;
  children: ReactNode;
  // Replaces the default icon. Pass `null` for a bare message.
  icon?: ReactNode;
  className?: string;
};

// The inline message strip.
//
// It existed three times: booking-list drew it with a ⚠️ prefix, itinerary drew
// the identical class string without one, and up-next drew a fourth shape as a
// Card with a coloured stripe and a 💸 or 📝 chosen by string-matching the
// Hebrew copy. Deciding an icon by `message.startsWith("ביטול")` is the kind of
// thing that works until someone rewords a sentence.
export function Banner({
  tone = "callout",
  children,
  icon,
  className,
}: BannerProps) {
  const Icon = icons[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control px-3 py-2 text-sm",
        tones[tone],
        className,
      )}
    >
      {icon === undefined ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        icon
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
