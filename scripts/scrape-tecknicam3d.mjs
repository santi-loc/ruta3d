import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Tecknicam 3D",
  domain: "tecknicam3d.com.ar",
  baseUrl: "https://www.tecknicam3d.com.ar",
};

const DEFAULT_OUTPUT = "data/tecknicam3d-products.json";
const MAX_REASONABLE_PRICE = 100_000_000;
const CATEGORY_PATHS = [
  "/productos?categoria=1-impresoras-3d",
  "/productos?categoria=2-filamento-3d&stock=con_stock",
  "/productos?categoria=categoria-test",
  "/productos?categoria=4-laser",
  "/productos?categoria=5-repuestos-impresoras",
  "/productos?categoria=6-accesorios",
  "/productos?categoria=9-cnc-fresas",
];
const MAX_CATEGORY_PAGES = Number.parseInt(process.env.TECKNICAM3D_MAX_CATEGORY_PAGES ?? "2", 10);

const brandLabels = [
  "3N3",
  "Anycubic",
  "Artillery",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Grilon3",
  "Hellbot",
  "Printalot",
  "W3D",
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

function normalizeText(value) {
  return decodeHtml(String(value ?? ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeUrl(value) {
  if (!value) return null;
  const decoded = decodeHtml(value);
  if (decoded.startsWith("//")) return `https:${decoded}`;
  if (decoded.startsWith("/")) return `${STORE.baseUrl}${decoded}`;
  return decoded;
}

function parseMoney(value) {
  if (!value) return null;
  const raw = decodeHtml(String(value));
  const match = raw.match(/\d[\d.,]*/);
  if (!match) return null;

  const normalized = match[0].includes(",")
    ? match[0].replace(/\./g, "").replace(",", ".")
    : match[0].replace(/,/g, "");
  const amount = Number.parseFloat(normalized);

  return Number.isFinite(amount) ? amount : null;
}

function slugFromUrl(url) {
  return url?.split("/").filter(Boolean).at(-1) ?? null;
}

function inferCategory(name, url, sourceUrl) {
  const text = normalizeText(`${name} ${url} ${sourceUrl}`);

  if (text.includes("resina") || text.includes("categoria-test")) return "Resina";
  if (
    text.includes("impresora") ||
    text.includes("printer") ||
    text.includes("ender") ||
    text.includes("bambu") ||
    text.includes("creality") ||
    text.includes("anycubic")
  ) {
    return "Impresoras";
  }
  if (
    text.includes("filamento") ||
    text.includes("pla") ||
    text.includes("petg") ||
    text.includes("abs") ||
    text.includes("hips") ||
    text.includes("flexible") ||
    text.includes("tpu")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("repuesto") ||
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("hotend") ||
    text.includes("extrusor") ||
    text.includes("placa")
  ) {
    return "Repuestos";
  }
  if (text.includes("laser") || text.includes("cnc") || text.includes("fresa")) return "Herramientas";

  return "Accesorios";
}

function inferBrand(name) {
  const text = normalizeText(name);
  const brand = brandLabels.find((label) => text.includes(normalizeText(label)));

  if (brand === "Bambulab") return "Bambu Lab";

  return brand ?? null;
}

function makeTags(name, url, sourceUrl, brand) {
  const text = normalizeText(`${name} ${url} ${sourceUrl} ${brand ?? ""}`);
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "HIPS", "NYLON", "PC", "PVA"]) {
    if (new RegExp(`(^|[^a-z0-9])${normalizeText(material)}([^a-z0-9]|$)`).test(text)) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("500g") || text.includes("500 g")) tags.add("500g");
  if (text.includes("250g") || text.includes("250 g")) tags.add("250g");
  if (text.includes("ecofila")) tags.add("ECOFILA");
  if (text.includes("laser")) tags.add("Laser");
  if (text.includes("cnc")) tags.add("CNC");

  return [...tags].slice(0, 6);
}

function stockFromBlock(block) {
  const text = decodeHtml(block);
  const stock = Number.parseInt(text.match(/En stock\s*\((\d+)\s+disponibles?\)/i)?.[1] ?? "", 10);

  return Number.isFinite(stock) ? stock : null;
}

function stockLabel(stock, available) {
  if (!available || stock === 0) return "Consultar";
  if (stock !== null && stock <= 3) return "Pocas unidades";
  return "En stock";
}

function extractProducts(html, sourceUrl) {
  const productRegex =
    /<div class="card product-card\b[\s\S]*?(?=<div class="col-lg-4 col-md-6">\s*<div class="card product-card\b|<\/div>\s*<\/div>\s*<!-- Pagination -->|<nav id="catalogPaginationNav"|<div id="catalogInfiniteSentinel"|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const block = match[0];
    const url = normalizeUrl(
      block.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*\btext-decoration-none\b[^"]*"/)?.[1] ??
        block.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*\bbtn-outline-primary\b[^"]*"/)?.[1],
    );
    const name = decodeHtml(
      block.match(/<h5 class="card-title"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ??
        block.match(/data-product-name="([^"]+)"/)?.[1] ??
        block.match(/alt="([^"]+)"/)?.[1] ??
        "",
    );
    const image = normalizeUrl(block.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*\bcard-img-top\b[^"]*"/)?.[1]);
    const price = parseMoney(
      block.match(/data-product-price="([^"]+)"/)?.[1] ??
        block.match(/<div class="h4[^"]*\btext-primary\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1],
    );
    const transferPrice = parseMoney(
      block.match(/<li class="[^"]*\btext-success\b[^"]*"[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/)?.[1],
    );
    const stock = stockFromBlock(block);
    const available = /add-to-cart/i.test(block) && !/sin stock/i.test(decodeHtml(block));
    const productId = block.match(/data-product-id="(\d+)"/)?.[1] ?? slugFromUrl(url);
    const brand = inferBrand(name);

    if (!productId || !name || !url || !price || price >= MAX_REASONABLE_PRICE) continue;

    products.push({
      id: `tecknicam3d-${productId}`,
      sourceProductId: String(productId),
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name, url, sourceUrl),
      price,
      currency: "ARS",
      previousPrice: null,
      transferPrice: transferPrice && transferPrice < price ? transferPrice : null,
      purchaseModes: available ? ["Entrega inmediata"] : [],
      stock,
      stockLabel: stockLabel(stock, available),
      available,
      brand,
      tags: makeTags(name, url, sourceUrl, brand),
      image,
      url,
      scrapedFrom: sourceUrl,
      variants: [],
    });
  }

  return products;
}

function totalPagesFromHtml(html) {
  const total = Number.parseInt(html.match(/data-total-pages="(\d+)"/)?.[1] ?? "", 10);

  return Number.isFinite(total) && total > 0 ? total : 1;
}

function pageUrl(pathname, page) {
  const url = new URL(pathname, STORE.baseUrl);
  if (page > 1) url.searchParams.set("page", String(page));

  return url.href;
}

async function fetchPage(pathname, page) {
  const url = pageUrl(pathname, page);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Tecknicam 3D responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];

  for (const pathname of CATEGORY_PATHS) {
    let totalPages = 1;

    for (let page = 1; page <= Math.min(MAX_CATEGORY_PAGES, totalPages); page += 1) {
      const { url, html } = await fetchPage(pathname, page);
      totalPages = totalPagesFromHtml(html);

      const pageProducts = extractProducts(html, url);
      const newProducts = pageProducts.filter((product) => {
        if (seen.has(product.url)) return false;
        seen.add(product.url);
        return true;
      });

      pages.push({ page, path: pathname, url, found: pageProducts.length, added: newProducts.length, totalPages });
      products.push(...newProducts);

      if (pageProducts.length === 0 || newProducts.length === 0) break;
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

console.log(`Scraped ${result.count} Tecknicam 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.path} page ${page.page}/${page.totalPages}: ${page.added}/${page.found} new products`);
}
