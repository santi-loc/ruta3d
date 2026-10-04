import type { MetadataRoute } from "next";
import { getCatalogData } from "@/lib/catalog";
import { absoluteSiteUrl } from "@/lib/site";

const siteLastModified = new Date("2026-09-20T00:00:00.000Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { catalogFreshness } = await getCatalogData();
  const catalogLastModified = catalogFreshness.newestScrapedAt
    ? new Date(catalogFreshness.newestScrapedAt)
    : new Date();
  const lastModified = catalogLastModified > siteLastModified ? catalogLastModified : siteLastModified;

  return [
    {
      url: absoluteSiteUrl("/"),
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteSiteUrl("/que-impresora-compro"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteSiteUrl("/terminos"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: absoluteSiteUrl("/privacidad"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
