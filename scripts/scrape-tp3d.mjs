import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "TP3D",
  domain: "tp3d.com.ar",
  baseUrl: "https://tp3d.com.ar",
};

const LISTINGS = [
  { label: "Insumos", path: "/127-insumos" },
  { label: "Impresoras FDM", path: "/203-all-fdm" },
  { label: "Impresoras Resina", path: "/7-impresoras-resina" },
  { label: "Repuestos", path: "/10-partes-y-repuestos" },
  { label: "Accesorios", path: "/15-accesorios-y-complementos-3d" },
  { label: "Scanners", path: "/13-scanners" },
];

const DEFAULT_OUTPUT = "data/tp3d-products.json";
const MAX_PAGES_PER_LISTING = Number.parseInt(process.env.TP3D_MAX_PAGES ?? "8", 10);

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

function inferCategory(name, listingLabel) {
  const text = `${name} ${listingLabel}`.toLowerCase();

  if (text.includes("filamento") || text.includes("pla") || text.includes("petg") || text.includes("abs") || text.includes("asa") || text.includes("insumos")) {
    return "Filamentos";
  }
  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("fdm") || text.includes("bambu") || text.includes("creality") || text.includes("anycubic")) {
    return "Impresoras";
  }
  if (text.includes("hotend") || text.includes("boquilla") || text.includes("nozzle") || text.includes("repuesto")) {
    return "Repuestos";
  }
  if (text.includes("scanner") || text.includes("laser") || text.includes("herramienta")) return "Herramientas";

  return "Accesorios";
}

function makeTags(name, listingLabel) {
  const text = `${name} ${listingLabel}`.toLowerCase();
  const tags = new Set();

  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  for (const brand of ["Bambu Lab", "Creality", "Anycubic", "Hellbot", "Elegoo", "Artillery", "Printalot"]) {
    if (text.includes(brand.toLowerCase())) tags.add(brand);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("combo")) tags.add("combo");
  if (listingLabel) tags.add(listingLabel);

  return [...tags].slice(0, 5);
}

function productBlocks(html) {
  const blocks = [];
  const productRegex =
    /<article class="[^"]*\bjs-product-miniature\b[^"]*"[\s\S]*?data-id-product="(\d+)"[\s\S]*?<\/article>/g;

  for (const match of html.matchAll(productRegex)) {
    blocks.push({ productId: match[1], block: match[0] });
  }

  return blocks;
}

function extractProducts(html, sourceUrl, listingLabel) {
  return productBlocks(html)
    .map(({ productId, block }) => {
      const url = normalizeUrl(block.match(/<h2[\s\S]*?<a href="([^"]+)"/)?.[1] ?? block.match(/<a href="([^"]+)" class="thumbnail product-thumbnail"/)?.[1]);
      const name = decodeHtml(block.match(/<h2[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/)?.[1] ?? block.match(/alt="([^"]+)"/)?.[1] ?? "");
      const image = normalizeUrl(block.match(/data-full-size-image-url="([^"]+)"/)?.[1] ?? block.match(/<img[\s\S]*?src="([^"]+)"/)?.[1]);
      const price = parseMoney(block.match(/<span class="price"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const rawTransferPrice = parseMoney(block.match(/<span class="pc-transfer-price"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const transferPrice = validTransferPrice(price, rawTransferPrice);

      if (!name || !url || !price) return null;

      return {
        id: `tp3d-${productId}`,
        sourceProductId: productId,
        store: STORE.name,
        domain: STORE.domain,
        name,
        category: inferCategory(name, listingLabel),
        price,
        currency: "ARS",
        transferPrice,
        stock: null,
        stockLabel: "En stock",
        available: true,
        brand: null,
        tags: makeTags(name, listingLabel),
        image,
        url,
        scrapedFrom: sourceUrl,
        variants: [],
      };
    })
    .filter(Boolean);
}

async function fetchPage(listing, page) {
  const pageSuffix = page === 1 ? "" : `${listing.path.includes("?") ? "&" : "?"}page=${page}`;
  const url = `${STORE.baseUrl}${listing.path}${pageSuffix}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Filtrar3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`TP3D responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];

  for (const listing of LISTINGS) {
    for (let page = 1; page <= MAX_PAGES_PER_LISTING; page += 1) {
      const { url, html } = await fetchPage(listing, page);
      const pageProducts = extractProducts(html, url, listing.label);
      const newProducts = pageProducts.filter((product) => {
        if (seen.has(product.url)) return false;
        seen.add(product.url);
        return true;
      });

      pages.push({ listing: listing.label, page, url, found: pageProducts.length, added: newProducts.length });
      products.push(...newProducts);

      if (pageProducts.length === 0 || newProducts.length === 0 || !html.includes('rel="next"')) break;
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

console.log(`Scraped ${result.count} TP3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.listing} page ${page.page}: ${page.added}/${page.found} new products`);
}
