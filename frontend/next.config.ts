import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // pdfjs-dist (react-pdf ke andar) ko canvas polyfill nahi chahiye browser mein
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
