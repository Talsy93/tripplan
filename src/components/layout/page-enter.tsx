"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The container that makes a page's content arrive one block at a time, on
// every navigation rather than only on the first load.
//
// The CSS half is `.enter-children` in globals.css. This exists for one reason:
// **the animation has to re-run when the route changes**, and a CSS animation
// runs once per element, when it is inserted.
//
// In the App Router a layout is not re-created when you move between the routes
// under it. Nothing here is remounted, and React reconciles the new page against
// the old one — so where two routes happen to render the same element type in
// the same position, the DOM node is reused rather than replaced. A reused node
// is not a new node, its animation does not restart, and the effect appears on
// some navigations and not others. The trip's five tabs are exactly that case:
// every one of them opens with a `<div>`.
//
// Keying on the pathname makes each route a different subtree, so the old one
// unmounts and the new one mounts. Nothing is lost by that — a navigation is
// already replacing this content — and it is what makes "every page opens with
// an animation" true rather than usually true.
export function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    // gap-6 rather than leaving it on <main>: this element is now the flex
    // container its children live in, and the rhythm belongs to whichever one
    // that is.
    <div key={pathname} className="enter-children flex w-full flex-col gap-6">
      {children}
    </div>
  );
}
