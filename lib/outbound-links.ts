import type { Product } from "@/lib/catalog";

type StoreTarget = {
  store: string;
  url: string;
  productId?: Product["id"];
  productName?: string;
  source?: string;
};

export function outboundStoreUrl({ store, url, productId, productName, source = "catalog" }: StoreTarget) {
  const params = new URLSearchParams({
    store,
    url,
    source,
  });

  if (productId !== undefined && productId !== null) params.set("productId", String(productId));
  if (productName) params.set("productName", productName);

  return `/api/out?${params.toString()}`;
}

export function outboundProductUrl(product: Product, source = "product") {
  return outboundStoreUrl({
    store: product.store,
    url: product.url,
    productId: product.id,
    productName: product.name,
    source,
  });
}
