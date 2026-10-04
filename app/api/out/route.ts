import { NextResponse } from "next/server";
import { getCatalogData, storeSources } from "@/lib/catalog";
import { recordOutboundClick } from "@/lib/outbound-clicks";
import { sanitizeSearchQuery } from "@/lib/security";

type AllowedTarget = {
  store: string;
  productId: string | null;
  productName: string | null;
  targetUrl: string;
};

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

const storesByName = new Map(storeSources.map((source) => [source.name, source]));

function hostnameMatchesStore(url: string, domain: string) {
  const hostname = new URL(url).hostname;
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

async function allowedTargets() {
  const targets = new Map<string, AllowedTarget>();
  const { catalogProducts } = await getCatalogData();

  for (const source of storeSources) {
    const targetUrl = canonicalUrl(source.url);
    if (targetUrl) {
      targets.set(targetUrl, {
        store: source.name,
        productId: null,
        productName: null,
        targetUrl,
      });
    }
  }

  for (const product of catalogProducts) {
    const targetUrl = canonicalUrl(product.url);
    if (targetUrl) {
      targets.set(targetUrl, {
        store: product.store,
        productId: String(product.id),
        productName: product.name,
        targetUrl,
      });
    }
  }

  return targets;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const targetUrl = canonicalUrl(requestUrl.searchParams.get("url") ?? "");
  const fallbackUrl = new URL("/", request.url);

  if (!targetUrl) return NextResponse.redirect(fallbackUrl);

  const targets = await allowedTargets();
  const target = targets.get(targetUrl) ?? (() => {
    const requestedStore = sanitizeSearchQuery(requestUrl.searchParams.get("store"), 80);
    const store = storesByName.get(requestedStore);
    if (!store || !hostnameMatchesStore(targetUrl, store.domain)) return null;

    return {
      store: store.name,
      productId: null,
      productName: null,
      targetUrl,
    };
  })();

  if (!target) return NextResponse.redirect(fallbackUrl);

  try {
    await recordOutboundClick({
      store: target.store,
      productId: target.productId,
      productName: target.productName,
      targetUrl: target.targetUrl,
      source: sanitizeSearchQuery(requestUrl.searchParams.get("source"), 40) || "catalog",
    });
  } catch {
    // A failed analytics write should never block someone from reaching a store.
  }

  return NextResponse.redirect(target.targetUrl);
}
