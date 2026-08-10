import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Free place photos come from Wikipedia (see src/lib/place-image.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
