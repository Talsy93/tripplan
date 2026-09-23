import {
  getSelectedDestinations,
  listChatMessages,
  TripChat,
} from "@/features/trips";

export const metadata = { title: "עוזר AI" };

// The "עוזר AI" tab (v6): the Stitch design's chat screen. The conversation
// and its plan-from-chat were at /more/chat, one menu deep; the design makes
// them a tab, and that address now forwards here.
export default async function AiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [messages, selected] = await Promise.all([
    listChatMessages(id),
    getSelectedDestinations(id),
  ]);
  const cities = [...new Set(selected.map((item) => item.city))].filter(Boolean);

  return <TripChat tripId={id} initialMessages={messages} cities={cities} />;
}
