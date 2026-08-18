"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui";

// The route-level error boundary. Must be a client component — that is how
// React hands it `reset`, which re-renders the segment without a full reload.
//
// The message from `error` is deliberately not shown: in production Next
// replaces it with a digest, so it would say nothing useful, and in development
// the overlay already shows the real stack.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-tint text-danger-ink"
        aria-hidden="true"
      >
        <CircleAlert className="h-7 w-7" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-bold">משהו נשבר כאן</h1>
        <p className="max-w-md text-base text-muted">
          זו תקלה אצלנו, לא משהו שעשיתם. אפשר לנסות לטעון את המסך מחדש.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          ניסיון נוסף
        </Button>
        <Link href="/profile" className={buttonClasses("outline")}>
          הטיולים שלי
        </Link>
      </div>
    </main>
  );
}
