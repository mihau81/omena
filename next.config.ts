import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/omena",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
