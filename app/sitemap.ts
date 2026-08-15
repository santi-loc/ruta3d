import type { MetadataRoute } from "next";
import { catalogFreshness } from "@/lib/catalog";
import { absoluteSiteUrl } from "@/lib/site";

const lastModified = catalogFreshness.newestScrapedAt
  ? new Date(catalogFreshness.newestScrapedAt)
  : new Date();

export default function sitemap(): MetadataRoute.Sitemap {
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
