import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Lefasoc",
  domain: "lefasoc.com.ar",
  baseUrl: "https://lefasoc.com.ar",
  listingPath: "/productos/",
};

const DEFAULT_OUTPUT = "data/lefasoc-products.json";
const MAX_PAGES = Number.parseInt(process.env.LEFASOC_MAX_PAGES ?? "8", 10);

const brandLabels = [
  "3N3",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Flashforge",
  "Generico",
  "Grilon3",
  "Kyocera",
  "Lefasoc",
  "Lefasoc3D",
  "Roby",
  "Snapmaker",
  "Toshiba",
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#8211;", "-")
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

function inferCategory(name) {
  const text = name.toLowerCase();

  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("bambu") || text.includes("creality") || text.includes("flashforge")) {
    return "Impresoras";
  }
  if (
    text.includes("filamento") ||
    text.includes("pla") ||
    text.includes("petg") ||
    text.includes("abs") ||
    text.includes("asa") ||
    text.includes("tpu")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("hotend") ||
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("placa") ||
    text.includes("repuesto") ||
    text.includes("sensor")
  ) {
    return "Repuestos";
  }
  if (text.includes("laser") || text.includes("herramienta") || text.includes("vaso")) return "Herramientas";

  return "Accesorios";
}

function inferBrand(name, jsonLdBrand) {
  if (jsonLdBrand) return jsonLdBrand === "Bambulab" ? "Bambu Lab" : jsonLdBrand;

  const text = name.toLowerCase();
  const brand = brandLabels.find((label) => text.includes(label.toLowerCase()));

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "Lefasoc3D") return "Lefasoc3D";

  return brand ?? null;
}

function makeTags(name, variants, brand) {
  const text = [
    name,
    brand,
    ...variants.flatMap((variant) => [variant.option0, variant.option1, variant.option2, variant.sku]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("500 ml")) tags.add("500ml");
  if (text.includes("1 litro")) tags.add("1 litro");
  if (text.includes("bambu")) tags.add("Bambu Lab");
  if (text.includes("creality")) tags.add("Creality");

  return [...tags].slice(0, 5);
}

function variantText(variant) {
  return [variant.name, variant.option0, variant.option1, variant.option2, variant.sku]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isDepositVariant(variant) {
  const text = variantText(variant);

  return /\b(sena|senal|reserva|reservar|anticipo|apartado|separar|deposito)\b/.test(text) ||
    /\bpre[\s-]?venta\b/.test(text) && /\b(cuota|saldo|restante)\b/.test(text);
}

function inferPurchaseModes(name, url, variants) {
  const productText = [name, url].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function extractJsonLdProducts(html) {
  const products = new Map();
  const scriptRegex =
    /<script type=["']application\/ld\+json["'][^>]*data-component=['"]structured-data\.item['"][^>]*>\s*([\s\S]*?)\s*<\/script>/g;

  for (const match of html.matchAll(scriptRegex)) {
    try {
      const json = JSON.parse(match[1].trim());
      const url = json?.offers?.url ?? json?.mainEntityOfPage?.["@id"];
      if (json?.["@type"] === "Product" && url) {
        products.set(url, json);
      }
    } catch {
      // Ignore malformed structured data and continue with product cards.
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
    /<div class="[^"]*\bjs-item-product\b[^"]*"[\s\S]*?data-product-id="(\d+)"[\s\S]*?(?=<div class="[^"]*\bjs-item-product\b|\s*<div class="text-center|\s*<div id="js-infinite-scroll-spinner"|<footer|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const [, productId] = match;
    const block = match[0];
    const variants = parseVariants(block.match(/data-variants="([\s\S]*?)"/)?.[1]);
    const url = normalizeUrl(block.match(/<a[^>]+href="(https:\/\/lefasoc\.com\.ar\/productos\/[^"]+|\/productos\/[^"]+)"/)?.[1]);
    const jsonLd = url ? jsonLdByUrl.get(url) : null;
    const name = decodeHtml(
      block.match(/<div class="[^"]*\bjs-item-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
        jsonLd?.name ??
        "",
    );
    const brand = inferBrand(name, jsonLd?.brand?.name ?? null);
    const availableVariants = variants.filter((variant) => variant.available !== false && variant.is_visible !== false);
    const nonDepositVariants = (availableVariants.length ? availableVariants : variants).filter((variant) => !isDepositVariant(variant));
    const priceVariants = nonDepositVariants.length ? nonDepositVariants : (availableVariants.length ? availableVariants : variants);
    const priceCandidates = priceVariants
      .map((variant) => Number(variant.price_number))
      .filter((value) => Number.isFinite(value) && value > 0);
    const price = priceCandidates.length > 0 ? Math.min(...priceCandidates) : Number.parseFloat(jsonLd?.offers?.price ?? "");
    const previousPriceCandidates = priceVariants
      .map((variant) => Number(variant.compare_at_price_number))
      .filter((value) => Number.isFinite(value) && value > 0);
    const transferPriceCandidates = priceVariants
      .map((variant) => parseMoney(variant.price_with_payment_discount_short))
      .filter((value) => Number.isFinite(value) && value > 0);
    const stockNumbers = variants
      .map((variant) => Number(variant.stock))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    const jsonLdStock = Number.parseInt(jsonLd?.offers?.inventoryLevel?.value ?? "", 10);
    const stock = stockNumbers.reduce((total, amount) => total + amount, Number.isFinite(jsonLdStock) ? jsonLdStock : 0);
    const hasKnownStock = stockNumbers.length > 0 || Number.isFinite(jsonLdStock);
    const available = variants.length > 0 ? variants.some((variant) => variant.available === true) : jsonLd?.offers?.availability?.includes("InStock");
    const image = normalizeUrl(variants.find((variant) => variant.image_url)?.image_url ?? jsonLd?.image);

    if (!name || !url || !price) continue;

    products.push({
      id: `lefasoc-${productId}`,
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
        isDeposit: isDepositVariant(variant),
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
    throw new Error(`Lefasoc responded ${response.status} for ${url}`);
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

console.log(`Scraped ${result.count} Lefasoc products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} new products`);
}
