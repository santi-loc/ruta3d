import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Erexit 3D",
  domain: "erexit3d.com",
  baseUrl: "https://erexit3d.com",
  listingPath: "/productos/",
};

const DEFAULT_OUTPUT = "data/erexit3d-products.json";
const MAX_PAGES = Number.parseInt(process.env.EREXIT_MAX_PAGES ?? "10", 10);

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeUrl(value) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${STORE.baseUrl}${value}`;
  return value;
}

function parsePriceFromCents(rawValue) {
  const cents = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(cents) ? cents / 100 : null;
}

function inferCategory(name) {
  const text = name.toLowerCase();

  if (text.includes("filamento") || text.includes("pla") || text.includes("petg") || text.includes("abs")) {
    return "Filamentos";
  }

  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("bambu") || text.includes("creality")) return "Impresoras";
  if (text.includes("hotend") || text.includes("boquilla") || text.includes("nozzle")) return "Repuestos";
  if (text.includes("cortadora") || text.includes("laser")) return "Herramientas";

  return "Accesorios";
}

function makeTags(name, variants, brand) {
  const text = name.toLowerCase();
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS"]) {
    if (text.includes(material.toLowerCase()) || variants.some((variant) => variant.option1 === material)) {
      tags.add(material);
    }
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("bambu")) tags.add("Bambu Lab");
  if (text.includes("creality")) tags.add("Creality");
  if (text.includes("multicolor")) tags.add("multicolor");

  return [...tags].slice(0, 5);
}

function stockLabel(stock, available) {
  if (!available || stock === 0) return "Consultar";
  if (stock > 0 && stock <= 3) return "Pocas unidades";
  return "En stock";
}

function extractJsonLdProducts(html) {
  const products = new Map();
  const scriptRegex =
    /<script type="application\/ld\+json" data-component=['"]structured-data\.item['"]>\s*([\s\S]*?)\s*<\/script>/g;

  for (const match of html.matchAll(scriptRegex)) {
    try {
      const json = JSON.parse(match[1].trim());
      const url = json?.offers?.url ?? json?.mainEntityOfPage?.["@id"];
      if (json?.["@type"] === "Product" && url) {
        products.set(url, json);
      }
    } catch {
      // Individual malformed snippets should not break the whole scrape.
    }
  }

  return products;
}

function parseVariants(rawAttribute) {
  if (!rawAttribute) return [];

  try {
    return JSON.parse(decodeHtml(rawAttribute));
  } catch {
    return [];
  }
}

function extractProducts(html, sourceUrl) {
  const jsonLdByUrl = extractJsonLdProducts(html);
  const productRegex =
    /<div class="js-item-product[\s\S]*?data-product-id="(\d+)"[\s\S]*?(?=<div class="js-item-product|\s*<div class="text-center mt-5|\s*<div id="js-infinite-scroll-spinner")/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const [, productId] = match;
    const block = match[0];
    const variants = parseVariants(block.match(/data-variants="([\s\S]*?)"/)?.[1]);
    const name = decodeHtml(block.match(/<div class="js-item-name[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const url = normalizeUrl(block.match(/<a href="(https:\/\/erexit3d\.com\/productos\/[^"]+)"/)?.[1]);
    const jsonLd = url ? jsonLdByUrl.get(url) : null;
    const brand = jsonLd?.brand?.name ?? null;
    const availableVariants = variants.filter((variant) => variant.available !== false && variant.is_visible !== false);
    const priceCandidates = (availableVariants.length ? availableVariants : variants)
      .map((variant) => Number(variant.price_number))
      .filter((value) => Number.isFinite(value) && value > 0);
    const price =
      priceCandidates.length > 0
        ? Math.min(...priceCandidates)
        : Number.parseFloat(jsonLd?.offers?.price ?? "") ||
          parsePriceFromCents(block.match(/data-product-price="(\d+)"/)?.[1]);
    const transferPriceCandidates = (availableVariants.length ? availableVariants : variants)
      .map((variant) => Number.parseFloat(String(variant.price_with_payment_discount_short ?? "").replace(/[^\d,]/g, "").replace(",", ".")))
      .filter((value) => Number.isFinite(value) && value > 0);
    const stock = variants.reduce((total, variant) => {
      const amount = Number(variant.stock);
      return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, Number.parseInt(jsonLd?.offers?.inventoryLevel?.value ?? "0", 10) || 0);
    const available = variants.length > 0 ? variants.some((variant) => variant.available === true) : jsonLd?.offers?.availability?.includes("InStock");
    const image = normalizeUrl(variants.find((variant) => variant.image_url)?.image_url ?? jsonLd?.image);

    if (!name || !url || !price) continue;

    products.push({
      id: `erexit3d-${productId}`,
      sourceProductId: productId,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name),
      price,
      currency: "ARS",
      transferPrice: transferPriceCandidates.length ? Math.min(...transferPriceCandidates) : null,
      stock,
      stockLabel: stockLabel(stock, available),
      available: Boolean(available),
      brand,
      tags: makeTags(name, variants, brand),
      image,
      url,
      scrapedFrom: sourceUrl,
      variants: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price_number,
        stock: variant.stock,
        available: variant.available,
        options: [variant.option0, variant.option1, variant.option2].filter(Boolean),
        image: normalizeUrl(variant.image_url),
      })),
    });
  }

  return products;
}

async function fetchPage(page) {
  const url = page === 1 ? `${STORE.baseUrl}${STORE.listingPath}` : `${STORE.baseUrl}${STORE.listingPath}page/${page}/`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Filtrar3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Erexit responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { url, html } = await fetchPage(page);
    const pageProducts = extractProducts(html, url);
    const newProducts = pageProducts.filter((product) => {
      if (seen.has(product.url)) return false;
      seen.add(product.url);
      return true;
    });

    pages.push({ page, url, found: pageProducts.length, added: newProducts.length });
    products.push(...newProducts);

    if (pageProducts.length === 0 || newProducts.length === 0) break;
  }

  return {
    store: STORE,
    scrapedAt: new Date().toISOString(),
    count: products.length,
    pages,
    products,
  };
}

const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputPath = path.resolve(outputArg ? outputArg.split("=").slice(1).join("=") : DEFAULT_OUTPUT);
const result = await scrape();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Scraped ${result.count} Erexit 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} new products`);
}
