import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Llaveprint",
  domain: "llaveprint.com.ar",
  baseUrl: "https://www.llaveprint.com.ar",
  listingPath: "/impresion-3d/",
};

const DEFAULT_OUTPUT = "data/llaveprint-products.json";
const MAX_PAGES = Number.parseInt(process.env.LLAVEPRINT_MAX_PAGES ?? "20", 10);

const brandLabels = [
  "3N3",
  "Anycubic",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Flashforge",
  "Grilon3",
  "Llaveprint",
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#8211;", "-")
    .replaceAll("&#8212;", "-")
    .replaceAll("&#36;", "$")
    .replaceAll("&#038;", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${STORE.baseUrl}${value}`;
  return value;
}

function parseMoney(value) {
  if (!value) return null;
  const normalized = String(value)
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeText(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferCategory(name) {
  const text = normalizeText(name);

  if (text.includes("resina")) return "Resina";
  if (
    text.includes("impresora") ||
    text.includes("bambu") ||
    text.includes("creality") ||
    text.includes("flashforge") ||
    text.includes("anycubic") ||
    text.includes("elegoo")
  ) {
    return "Impresoras";
  }
  if (
    text.includes("filamento") ||
    text.includes("pla") ||
    text.includes("petg") ||
    text.includes("abs") ||
    text.includes("asa") ||
    text.includes("tpu") ||
    text.includes("flex")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("hotend") ||
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("repuesto") ||
    text.includes("extrusor")
  ) {
    return "Repuestos";
  }

  return "Accesorios";
}

function inferBrand(name) {
  const text = normalizeText(name);
  const brand = brandLabels.find((label) => text.includes(normalizeText(label)));

  if (brand === "Bambulab") return "Bambu Lab";

  return brand ?? null;
}

function makeTags(name, variants, brand) {
  const text = normalizeText([
    name,
    brand,
    ...variants.flatMap((variant) => [variant.option0, variant.option1, variant.option2, variant.sku]),
  ].filter(Boolean).join(" "));
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"]) {
    if (text.includes(normalizeText(material))) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("1,75") || text.includes("1.75")) tags.add("1.75mm");
  if (text.includes("multicolor")) tags.add("Multicolor");

  return [...tags].slice(0, 6);
}

function variantText(variant) {
  return [variant.name, variant.option0, variant.option1, variant.option2, variant.sku]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferPurchaseModes(name, url, variants) {
  const productText = normalizeText([name, url].join(" "));
  const variantTexts = variants.map(variantText);
  const hasImmediate = variantTexts.some((text) => /\bentrega\s+inmediata\b/.test(text));
  const hasPreorder =
    /\bpre[\s-]?venta\b/.test(productText) ||
    variantTexts.some((text) =>
      /\bpre[\s-]?venta\b/.test(text) ||
      /\bentrega\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.test(text),
    );

  return [hasPreorder ? "Preventa" : null, hasImmediate ? "Entrega inmediata" : null].filter(Boolean);
}

function stockLabel(stock, available, hasKnownStock) {
  if (!available) return "Consultar";
  if (!hasKnownStock) return "En stock";
  if (stock > 0 && stock <= 3) return "Pocas unidades";
  if (stock > 0) return "En stock";
  return "Consultar";
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
  const productRegex =
    /<div class="[^"]*\bjs-item-product\b[^"]*"[\s\S]*?data-product-id="(\d+)"[\s\S]*?(?=<div class="[^"]*\bjs-item-product\b|\s*<div class="text-center|\s*<div id="js-infinite-scroll-spinner"|<footer|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const [, productId] = match;
    const block = match[0];
    const variants = parseVariants(block.match(/data-variants="([\s\S]*?)"/)?.[1]);
    const url = normalizeUrl(block.match(/<a[^>]+href="(https:\/\/www\.llaveprint\.com\.ar\/productos\/[^"]+|\/productos\/[^"]+)"/)?.[1]);
    const name = decodeHtml(block.match(/<div class="[^"]*\bjs-item-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const brand = inferBrand(name);
    const availableVariants = variants.filter((variant) => variant.available !== false && variant.is_visible !== false);
    const priceVariants = availableVariants.length ? availableVariants : variants;
    const priceCandidates = priceVariants
      .map((variant) => Number(variant.price_number))
      .filter((value) => Number.isFinite(value) && value > 0);
    const previousPriceCandidates = priceVariants
      .map((variant) => Number(variant.compare_at_price_number))
      .filter((value) => Number.isFinite(value) && value > 0);
    const transferPriceCandidates = priceVariants
      .map((variant) => parseMoney(variant.price_with_payment_discount_short))
      .filter((value) => Number.isFinite(value) && value > 0);
    const stockNumbers = variants
      .map((variant) => Number(variant.stock))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    const stock = stockNumbers.reduce((total, amount) => total + amount, 0);
    const hasKnownStock = stockNumbers.length > 0;
    const available = variants.length > 0 ? variants.some((variant) => variant.available === true) : !/\bsin stock\b/i.test(decodeHtml(block));
    const image = normalizeUrl(variants.find((variant) => variant.image_url)?.image_url ?? block.match(/<img[^>]+src="([^"]+)"/)?.[1]);
    const price = priceCandidates.length > 0 ? Math.min(...priceCandidates) : parseMoney(block.match(/item-price[^>]*>([\s\S]*?)<\/span>/)?.[1]);

    if (!productId || !name || !url || !price) continue;

    products.push({
      id: `llaveprint-${productId}`,
      sourceProductId: productId,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name),
      price,
      currency: "ARS",
      previousPrice: previousPriceCandidates.length ? Math.min(...previousPriceCandidates) : null,
      transferPrice: transferPriceCandidates.length ? Math.min(...transferPriceCandidates) : null,
      purchaseModes: inferPurchaseModes(name, url, variants),
      stock,
      stockLabel: stockLabel(stock, available, hasKnownStock),
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
  const url = page === 1 ? `${STORE.baseUrl}${STORE.listingPath}` : `${STORE.baseUrl}${STORE.listingPath}?page=${page}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Llaveprint responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const products = [];
  const pages = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { url, html } = await fetchPage(page);
    const pageProducts = extractProducts(html, url);
    const newProducts = pageProducts.filter((product) => {
      if (seen.has(product.url)) return false;
      seen.add(product.url);
      return true;
    });

    pages.push({ page, path: STORE.listingPath, url, found: pageProducts.length, added: newProducts.length });
    products.push(...newProducts);

    if (pageProducts.length === 0 || html.includes("last-page")) break;
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

console.log(`Scraped ${result.count} Llaveprint products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} new products`);
}
