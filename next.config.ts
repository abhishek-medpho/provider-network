import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle in .next/standalone for Docker.
  output: "standalone",
  // Allow ngrok tunnels to reach dev resources (HMR, webpack chunks).
  // Harmless in prod — only affects `next dev`.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.trycloudflare.com",
  ],
  // Server actions process the onboarding form, which includes 3-4 phone
  // photos (selfie + Aadhaar front/back + qualification cert). Default
  // 1MB is far too small.
  //
  // Next.js 16 reads this from `experimental.serverActions.bodySizeLimit`
  // (see node_modules/next/dist/server/config.js around line 598).
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
      // When the app sits behind a reverse proxy (Caddy/Cloudflare/etc.)
      // terminating TLS, Next.js can read the Host as http://... while the
      // browser sends Origin as https://... — the CSRF check then rejects
      // every POST silently. Explicitly trust the production host(s).
      allowedOrigins: [
        "providers.labstack.in",
        "www.providers.labstack.in",
      ],
    },
  },
};

export default nextConfig;
