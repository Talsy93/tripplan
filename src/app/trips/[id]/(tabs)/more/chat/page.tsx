import { listChatMessages, MoreBackLink, TripChat } from "@/features/trips";

export const metadata = { title: "שיחה" };

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const messages = await listChatMessages(id);

  return (
    <>
      <MoreBackLink tripId={id} />
      {/* The heading lives inside TripChat, next to the actions that belong
          with it — the page had its own h2 as well, so the screen opened with
          two headings saying almost the same thing. */}
      <TripChat tripId={id} initialMessages={messages} />
    </>
  );
}
