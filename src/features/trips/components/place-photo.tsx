"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// A place's photo from Wikipedia (see /api/places/photo).
//
// **What happens when there is none is the caller's decision**, and there are
// two right answers depending on where it sits:
//
//   * **Nothing**, with `fallback` left off. A stop on a timeline that has no
//     photo is a normal stop, and the row should be exactly the row it was
//     before photos existed.
//   * **A placeholder**, by passing one. Asked for directly — "if there is no
//     photo in the suggestions put a placeholder so it looks uniform" — and
//     right there: a list of cards where some have an 80px square and some do
//     not is a ragged list, and the raggedness says nothing except that
//     Wikipedia happens to have a page for one of them. Uniform beats honest
//     when the missing thing carries no meaning.
//
// With a fallback the tile is drawn from the first frame and the photo fades in
// over it if one arrives. That ordering matters: the alternative — wait, then
// show a tile if it failed — is a hole in the row for as long as the request
// takes, on exactly the cards that will not get a photo anyway.
export function PlacePhoto({
  query,
  near,
  alt = "",
  className,
  fallback,
  children,
}: {
  query: string;
  // The city, which narrows the search without deciding it.
  near?: string | null;
  alt?: string;
  className?: string;
  // Drawn when there is no photo — and drawn underneath while one is on its
  // way. Without it the component renders nothing at all in that case.
  fallback?: React.ReactNode;
  // Drawn over the photo — a badge, a caption.
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const nothingToShow = failed || !query.trim();
  if (nothingToShow && !fallback) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        // The tint is the placeholder's own surface. Without a fallback it
        // arrives only with the photo: it was painted from the first frame
        // once, which on a list of cards drew three or four grey rectangles
        // while the requests were in flight and most of them then 404 and
        // vanish — a box that appears for half a second and disappears.
        (fallback || loaded) && "bg-surface-2",
        className,
      )}
    >
      {fallback && (
        <span className="absolute inset-0 flex items-center justify-center text-border-strong">
          {fallback}
        </span>
      )}

      {/* A plain <img>: the src is our own redirect to upload.wikimedia.org,
          and next/image would need that host allow-listed and would proxy the
          bytes through the server for no gain at these sizes. */}
      {!nothingToShow && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/places/photo?q=${encodeURIComponent(query)}${near ? `&near=${encodeURIComponent(near)}` : ""}`}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className={cn(
            "relative h-full w-full object-cover transition-opacity duration-settle",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {children}
    </div>
  );
}
