import Link from "next/link";
import { ChevronLeft, MessageCircle, Languages, Luggage } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui";

// A menu, not a pile. The five sections used to stack on one page, which on a
// phone meant scrolling past the weather to reach the chat.
const ENTRIES = [
  {
    segment: "trip",
    label: "פרטי הטיול",
    hint: "תאריכים, טיסות, רכבות ולינה",
    Icon: Luggage,
  },
  {
    segment: "phrases",
    label: "מילים שימושיות",
    hint: "שיחון בשפת היעד, עם תעתיק",
    Icon: Languages,
  },
  {
    segment: "chat",
    label: "שיחה",
    hint: "לתכנן את הטיול בשיחה חופשית",
    Icon: MessageCircle,
  },
] as const;

export const metadata = { title: "עוד" };

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <SectionHeading level="page">עוד</SectionHeading>

      {/* Three full-width 72px rows in a 1024px column was the most obviously
          phone-only screen in the app. A card each, side by side, once there is
          room for them. */}
      <ul className="grid gap-3 sm:grid-cols-3">
        {ENTRIES.map(({ segment, label, hint, Icon }) => (
          <li key={segment}>
            <Link
              href={`/trips/${id}/more/${segment}`}
              className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card
                variant="interactive"
                className="flex h-full items-center gap-3 sm:flex-col sm:items-start sm:gap-2"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{label}</span>
                  <span className="block truncate text-sm text-muted sm:whitespace-normal">
                    {hint}
                  </span>
                </span>
                {/* RTL: "forward" points left. Only useful in the row layout;
                    in the card layout the whole card is the affordance. */}
                <ChevronLeft
                  className="h-5 w-5 shrink-0 text-muted sm:hidden"
                  aria-hidden="true"
                />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
