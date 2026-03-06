import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/omenaa",
  serverExternalPackages: ['geoip-lite'],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },  // MinIO dev
      { protocol: 'http', hostname: 'minio', port: '9000' },     // MinIO Docker
    ],
  },
};

// Only wrap with Sentry if DSN is configured
const sentryConfig = {
  silent: true,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableServerWebpackPlugin: !process.env.SENTRY_DSN,
};

export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
