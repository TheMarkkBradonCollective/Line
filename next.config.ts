import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // The dev badge sits on top of the bottom tab bar on phones.
  devIndicators: false,
};

export default nextConfig;
