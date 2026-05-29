import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  allowedDevOrigins: ["http://172.16.10.209:3000", "http://172.16.26.48:3000"],

  // transpilePackages: ["@react-pdf/renderer"],
  // webpack: (config) => {
  //   config.resolve.alias = {
  //     ...config.resolve.alias,
  //     "@react-pdf/renderer": "@react-pdf/renderer",
  //   };
  //   return config;
  // },
};

export default nextConfig;
