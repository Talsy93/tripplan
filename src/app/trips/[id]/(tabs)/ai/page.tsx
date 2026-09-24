import { TwoPane } from "@/components/layout";
import {
  AssistantContext,
  getSelectedDestinations,
  getTrip,
  listChatMessages,
  TripChat,
} from "@/features/trips";

export const metadata = { title: "עוזר AI" };

// The "עוזר AI" tab (v6): the Stitch design's chat screen. The conversation
// and its plan-from-chat were at /more/chat, one menu deep; the design makes
// them a tab, and that address now forwards here.
//
// `?q=` puts a question in the input without sending it — see TripChat's
// initialDraft. The "גילוי" deck's ✨ button uses it, and so do the questions
// in the desktop pane. The chat is keyed by it: the draft is read once, on
// mount, so a second question pressed on the same page needs a fresh composer.
//
// PN20 (Pencil desktop): from @4xl the conversation keeps a 680px column and
// "מה העוזר יודע" sits beside it.
export default async function AiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q }] = await Promise.all([params, searchParams]);
  const [messages, selected, trip] = await Promise.all([
    listChatMessages(id),
    getSelectedDestinations(id),
    getTrip(id),
  ]);
  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);
  const draft = typeof q === "string" ? q.slice(0, 500) : "";

  return (
    <TwoPane
      aside={
        <AssistantContext
          tripId={id}
          startDate={trip?.start_date ?? null}
          endDate={trip?.end_date ?? null}
          cities={cities}
          savedCount={selected.length}
        />
      }
    >
      <TripChat
        key={draft}
        tripId={id}
        initialMessages={messages}
        cities={cities}
        initialDraft={draft}
      />
    </TwoPane>
  );
}
