import Link from "next/link";
import { ChevronLeft, MessageCircle, Languages, Luggage } from "lucide-react";
import { Card } from "@/components/ui";

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

export default async function MorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <h2 className="font-display text-xl">עוד</h2>

      <ul className="flex flex-col gap-3">
        {ENTRIES.map(({ segment, label, hint, Icon }) => (
          <li key={segment}>
            <Link href={`/trips/${id}/more/${segment}`} className="block">
              <Card
                variant="interactive"
                className="flex items-center gap-3 p-4"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="block truncate text-sm text-muted">
                    {hint}
                  </span>
                </span>
                {/* RTL: "forward" points left. */}
                <ChevronLeft
                  className="h-5 w-5 shrink-0 text-muted"
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
