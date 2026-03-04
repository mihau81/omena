import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3002/omenaa";
  const siteUrl = baseUrl.replace(/\/omenaa\/?$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/omenaa/",
        disallow: ["/omenaa/admin/", "/omenaa/api/", "/omenaa/auth/"],
      },
    ],
    sitemap: `${siteUrl}/omenaa/sitemap.xml`,
  };
}
