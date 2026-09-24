import {
  getSelectedDestinations,
  listChatMessages,
  TripChat,
} from "@/features/trips";

export const metadata = { title: "עוזר AI" };

// The "עוזר AI" tab (v6): the Stitch design's chat screen. The conversation
// and its plan-from-chat were at /more/chat, one menu deep; the design makes
// them a tab, and that address now forwards here.
//
// `?q=` puts a question in the input without sending it — see TripChat's
// initialDraft. The "גילוי" deck's ✨ button uses it.
export default async function AiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q }] = await Promise.all([params, searchParams]);
  const [messages, selected] = await Promise.all([
    listChatMessages(id),
    getSelectedDestinations(id),
  ]);
  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);

  return (
    <TripChat
      tripId={id}
      initialMessages={messages}
      cities={cities}
      initialDraft={typeof q === "string" ? q.slice(0, 500) : ""}
    />
  );
}
