import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle in .next/standalone for Docker.
  output: "standalone",
};

export default nextConfig;
