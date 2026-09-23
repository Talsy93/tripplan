import { redirect } from "next/navigation";
import { tripTabHref } from "@/features/trips";

// The chat became the "עוזר AI" tab (v6). This address stays so old links and
// the installed app's shortcuts still land on it.
export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(tripTabHref(id, "ai"));
}
