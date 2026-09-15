import type { NextConfig } from "next";

// Hosts the app is reached through when it sits behind a reverse proxy or tunnel.
const proxyHosts = (
  process.env.LOGTRAIL_ALLOWED_ORIGINS ??
  "localhost,localhost:3000,*.preview.devinapps.com"
)
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: proxyHosts,
  experimental: {
    serverActions: { allowedOrigins: proxyHosts },
  },
};

export default nextConfig;
