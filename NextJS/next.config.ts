import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  allowedDevOrigins: ["http://172.16.10.209:3000", "http://172.16.26.48:3000"],
};

export default nextConfig;
