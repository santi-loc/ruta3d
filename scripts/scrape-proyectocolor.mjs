import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Proyecto Color",
  domain: "proyectocolor.com.ar",
  baseUrl: "https://proyectocolor.com.ar",
};

const LISTINGS = [
  { label: "Impresion 3D", path: "/categorias/impresion-3d/" },
  { label: "Grabadoras Laser", path: "/categorias/impresion-3d/grabadoras-laser/" },
  { label: "Laser de Fibra", path: "/categorias/impresion-digital/laser-de-fibra/" },
];

const DEFAULT_OUTPUT = "data/proyectocolor-products.json";
const MAX_PAGES_PER_LISTING = Number.parseInt(process.env.PROYECTO_COLOR_MAX_PAGES ?? "100", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.PROYECTO_COLOR_TIMEOUT_MS ?? "25000", 10);
const REQUEST_RETRIES = Number.parseInt(process.env.PROYECTO_COLOR_RETRIES ?? "3", 10);

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
  const text = decodeHtml(String(value));
  const match = text.match(/\d[\d.]*,\d{2}|\d[\d.]*/);
  if (!match) return null;

  const normalized = match[0].replace(/\./g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function validTransferPrice(price, transferPrice) {
  if (!price || !transferPrice) return null;
  return transferPrice < price ? transferPrice : null;
}

function inferCategory(name, classes, listingLabel) {
  const text = `${name} ${classes} ${listingLabel}`.toLowerCase();
  const productName = name.toLowerCase();

  if (text.includes("laser") || text.includes("láser") || text.includes("grabadora") || text.includes("grabado")) {
    return "Herramientas";
  }
  if (productName.includes("filamento") || productName.includes("ecofila")) {
    return "Filamentos";
  }
  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("impresoras-3d")) return "Impresoras";
  if (text.includes("nozzle") || text.includes("boquilla") || text.includes("hotend") || text.includes("repuestos")) {
    return "Repuestos";
  }
  if (text.includes("laser") || text.includes("scanner") || text.includes("curadora")) return "Herramientas";

  return "Accesorios";
}

function makeTags(name, classes, brand, listingLabel) {
  const text = `${name} ${classes} ${listingLabel}`.toLowerCase();
  const nameText = name.toLowerCase();
  const nameTokens = new Set(nameText.match(/[a-z0-9]+/g) ?? []);
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"]) {
    if (nameTokens.has(material.toLowerCase())) tags.add(material);
  }
  for (const productBrand of ["Bambu Lab", "Creality", "Anycubic", "GST3D", "Fremover", "Toolbox", "Filanova", "Hellbot"]) {
    if (text.includes(productBrand.toLowerCase())) tags.add(productBrand);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("combo")) tags.add("combo");
  if (text.includes("laser") || text.includes("láser") || text.includes("grabadora")) tags.add("Laser");

  return [...tags].slice(0, 5);
}

function extractBrand(block) {
  return decodeHtml(block.match(/<span class="gz-brand-label"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "") || null;
}

function extractPrice(block) {
  const sale = block.match(/<ins>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>[\s\S]*?<\/ins>/)?.[1];
  const regular = block.match(/<span class="price">[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/)?.[1];
  return parseMoney(sale ?? regular);
}

function extractPreviousPrice(block) {
  const previous = block.match(/<del>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>[\s\S]*?<\/del>/)?.[1];
  return parseMoney(previous);
}

function productBlocks(html) {
  const blocks = [];
  const productRegex =
    /<li class="([^"]*\btype-product\b[^"]*\bpost-(\d+)[^"]*)"[\s\S]*?(?=<li class="[^"]*\btype-product\b|<\/ul>\s*<nav class="woocommerce-pagination"|<nav class="woocommerce-pagination"|$)/g;

  for (const match of html.matchAll(productRegex)) {
    blocks.push({ classes: match[1], productId: match[2], block: match[0] });
  }

  return blocks;
}

function extractProducts(html, sourceUrl, listingLabel) {
  return productBlocks(html)
    .map(({ classes, productId, block }) => {
      const url = normalizeUrl(block.match(/<h2[\s\S]*?<a href="([^"]+)"/)?.[1] ?? block.match(/<a href="([^"]+)" class="woocommerce-loop-image-link/)?.[1]);
      const name = decodeHtml(block.match(/<h2 class="woocommerce-loop-product__title">([\s\S]*?)<\/h2>/)?.[1] ?? block.match(/alt="([^"]+)"/)?.[1] ?? "");
      const image = normalizeUrl(block.match(/data-src="([^"]+)"/)?.[1] ?? block.match(/<img[\s\S]*?src="([^"]+)"/)?.[1]);
      const price = extractPrice(block);
      const previousPrice = extractPreviousPrice(block);
      const rawTransferPrice = parseMoney(block.match(/<p class="financing-badge best-unpago-default"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
      const transferPrice = validTransferPrice(price, rawTransferPrice);
      const brand = extractBrand(block);
      const available = classes.includes("instock") || block.includes("gz-stock-status in-stock");

      if (!name || !url || !price || url.includes("__trashed")) return null;

      return {
        id: `proyectocolor-${productId}`,
        sourceProductId: productId,
        store: STORE.name,
        domain: STORE.domain,
        name,
        category: inferCategory(name, classes, listingLabel),
        price,
        currency: "ARS",
        previousPrice: previousPrice && previousPrice !== price ? previousPrice : null,
        transferPrice,
        stock: null,
        stockLabel: available ? "En stock" : "Consultar",
        available,
        brand,
        tags: makeTags(name, classes, brand, listingLabel),
        image,
        url,
        scrapedFrom: sourceUrl,
        variants: [],
      };
    })
    .filter(Boolean);
}

async function fetchPage(listing, page) {
  const url = page === 1 ? `${STORE.baseUrl}${listing.path}` : `${STORE.baseUrl}${listing.path}page/${page}/`;
  let lastError = null;

  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Filtrar3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Proyecto Color responded ${response.status} for ${url}`);
      }

      return { url, html: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt === REQUEST_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError;
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];

  for (const listing of LISTINGS) {
    for (let page = 1; page <= MAX_PAGES_PER_LISTING; page += 1) {
      console.log(`Fetching ${listing.label} page ${page}`);
      const { url, html } = await fetchPage(listing, page);
      const pageProducts = extractProducts(html, url, listing.label);
      const newProducts = pageProducts.filter((product) => {
        if (seen.has(product.url)) return false;
        seen.add(product.url);
        return true;
      });

      pages.push({ listing: listing.label, page, url, found: pageProducts.length, added: newProducts.length });
      products.push(...newProducts);

      if (pageProducts.length === 0 || newProducts.length === 0 || !html.includes("next page-numbers")) break;
    }
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

console.log(`Scraped ${result.count} Proyecto Color products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.listing} page ${page.page}: ${page.added}/${page.found} new products`);
}
