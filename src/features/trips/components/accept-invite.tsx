"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { Banner, Button } from "@/components/ui";
import { redeemInvite } from "../application/membership-actions";

// The one button on the invite page, for a visitor already signed in as the
// invited account.
//
// A client component because it navigates on success: the only useful next
// screen is the trip itself, and landing on it directly is the difference
// between "I joined" and "I joined, now where is it".
//
// The server function returns null for every failure without distinguishing
// them, on purpose (see accept_trip_invite in migration 0018) — so this cannot
// say *why*. It says what is actionable instead: ask for a fresh invite.
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    setWorking(true);
    setFailed(false);

    const tripId = await redeemInvite(token);
    if (tripId) {
      // replace, not push: the invite URL is spent, and leaving it in the history
      // means Back returns to a page that now 404s.
      router.replace(`/trips/${tripId}`);
      return;
    }

    setFailed(true);
    setWorking(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => void accept()} loading={working} className="self-start">
        <Check className="h-4 w-4" aria-hidden="true" />
        הצטרפות לטיול
      </Button>

      {failed && (
        <Banner tone="danger">
          ההצטרפות לא הצליחה. ייתכן שההזמנה כבר נוצלה או בוטלה — בקשו ממי שהזמין
          אתכם לשלוח הזמנה חדשה.
        </Banner>
      )}
    </div>
  );
}
