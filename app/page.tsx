import { ProductExplorer } from "./product-explorer";
import { catalogFreshness, catalogProducts, filamentBrands, filamentMaterials, stores } from "@/lib/catalog";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <ProductExplorer
      products={catalogProducts}
      filamentBrands={filamentBrands}
      filamentMaterials={filamentMaterials}
      stores={stores}
      catalogFreshness={catalogFreshness}
      initialQuery={q ?? ""}
    />
  );
}
