import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La imagen Docker (etapa runner) arranca con .next/standalone/server.js.
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Orígenes extra para el servidor de desarrollo (lista separada por comas).
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};

export default nextConfig;
