import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits on top of the bottom tab bar on phones.
  devIndicators: false,
  // Reels are called Loops now.
  async redirects() {
    return [
      { source: "/reels", destination: "/loops", permanent: true },
      { source: "/reels/:id", destination: "/loops/:id", permanent: true },
    ];
  },
  // Profile and cover photos are posted straight to a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
