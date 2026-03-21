import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/app/lib/i18n";
import { db } from "@/db/connection";
import { auctions, artists } from "@/db/schema";
import { isNull } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Dynamic auction pages
  try {
    const auctionRows = await db
      .select({ slug: auctions.slug, updatedAt: auctions.updatedAt })
      .from(auctions)
      .where(isNull(auctions.deletedAt));

    for (const auction of auctionRows) {
      for (const locale of SUPPORTED_LOCALES) {
        entries.push({
          url: `${siteUrl}/omenaa/${locale}/auctions/${auction.slug}`,
          lastModified: auction.updatedAt ?? new Date(),
          changeFrequency: "daily" as const,
          priority: 0.8,
        });
      }
    }
  } catch {
    // DB may not be available at build time — skip dynamic auction entries
  }

  // Dynamic artist pages
  try {
    const artistRows = await db
      .select({ slug: artists.slug, updatedAt: artists.updatedAt })
      .from(artists)
      .where(isNull(artists.deletedAt));

    for (const artist of artistRows) {
      for (const locale of SUPPORTED_LOCALES) {
        entries.push({
          url: `${siteUrl}/omenaa/${locale}/artists/${artist.slug}`,
          lastModified: artist.updatedAt ?? new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB may not be available at build time — skip dynamic artist entries
  }

  return entries;
}
