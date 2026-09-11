import type { NextConfig } from "next";

// The images.remotePatterns entry for upload.wikimedia.org went with the
// destination photos — see trip-aura-band.tsx.
const nextConfig: NextConfig = {
  experimental: {
    // How long the browser may reuse a route it has already rendered, before
    // it goes back to the server for it (the Client Cache).
    //
    // Next's default for a dynamic route is 0 — every click on a tab is a
    // fresh server round trip to Frankfurt, *including* a click back to the
    // tab you were on two seconds ago. In a workspace whose whole navigation
    // is four tabs over one trip, that is the single most-repeated request in
    // the app, and it re-fetches data that cannot have changed.
    //
    // 30 seconds is short enough that a stale tab is measured in seconds, and
    // it is not the mechanism that keeps edits visible anyway: every mutation
    // in application/ calls revalidatePath, which drops this cache entirely.
    // So "I changed something and came back" is always fresh; only "I looked
    // away and looked back" is free.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
