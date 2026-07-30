import { ProductExplorer } from "./product-explorer";
import { catalogProducts, filamentBrandCounts, filamentMaterialCounts } from "@/lib/catalog";

export default function Home() {
  return (
    <ProductExplorer
      products={catalogProducts}
      filamentBrandCounts={filamentBrandCounts}
      filamentMaterialCounts={filamentMaterialCounts}
    />
  );
}
