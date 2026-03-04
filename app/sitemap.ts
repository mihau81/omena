import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/app/lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3002/omenaa";
  const siteUrl = baseUrl.replace(/\/omenaa\/?$/, "");

  const publicPages = [
    { path: "", changeFrequency: "daily" as const, priority: 1.0 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/auctions", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/artists", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/results", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/events", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/press", changeFrequency: "weekly" as const, priority: 0.6 },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of SUPPORTED_LOCALES) {
    for (const page of publicPages) {
      entries.push({
        url: `${siteUrl}/omenaa/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }

    entries.push({
      url: `${siteUrl}/omenaa/${locale}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    });
  }

  return entries;
}
