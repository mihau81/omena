import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/omena",
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },  // MinIO dev
      { protocol: 'http', hostname: 'minio', port: '9000' },     // MinIO Docker
    ],
  },
};

export default nextConfig;
