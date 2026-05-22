import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle in .next/standalone for Docker.
  output: "standalone",
  // Server actions process the onboarding form, which includes 3-4 phone
  // photos (selfie + Aadhaar front/back + qualification cert). Default
  // 1MB is far too small.
  //
  // Next.js 16 reads this from `experimental.serverActions.bodySizeLimit`
  // (see node_modules/next/dist/server/config.js around line 598).
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
