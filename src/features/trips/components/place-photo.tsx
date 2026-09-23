"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// A place's photo from Wikipedia (see /api/places/photo), or nothing at all.
//
// Nothing rather than a grey box: a stop with no photo is a normal stop, and a
// placeholder would say something is missing. The wrapper collapses on error,
// so a card without a photo is exactly the card it was before photos.
export function PlacePhoto({
  query,
  near,
  alt = "",
  className,
  children,
}: {
  query: string;
  // The city, which narrows the search without deciding it.
  near?: string | null;
  alt?: string;
  className?: string;
  // Drawn over the photo — a badge, a caption.
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !query.trim()) return null;

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {/* A plain <img>: the src is our own redirect to upload.wikimedia.org,
          and next/image would need that host allow-listed and would proxy the
          bytes through the server for no gain at these sizes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo?q=${encodeURIComponent(query)}${near ? `&near=${encodeURIComponent(near)}` : ""}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {children}
    </div>
  );
}
