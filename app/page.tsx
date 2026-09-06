import type { Metadata } from "next";
import { ProductExplorer } from "./product-explorer";
import { catalogFreshness, catalogProducts, filamentBrands, filamentMaterials, storeSources, stores } from "@/lib/catalog";
import { sanitizeSearchQuery } from "@/lib/security";
import { siteDescription } from "@/lib/site";
import { HomeJsonLd } from "./seo-json-ld";

export const metadata: Metadata = {
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const initialQuery = sanitizeSearchQuery(q);

  return (
    <>
      <HomeJsonLd
        products={catalogProducts}
        productCount={catalogFreshness.productCount}
        storeCount={catalogFreshness.storeCount}
      />
      <ProductExplorer
        products={catalogProducts}
        filamentBrands={filamentBrands}
        filamentMaterials={filamentMaterials}
        storeLinks={storeSources.map((source) => ({ name: source.name, url: source.url }))}
        stores={stores}
        catalogFreshness={catalogFreshness}
        initialQuery={initialQuery}
      />
    </>
  );
}
