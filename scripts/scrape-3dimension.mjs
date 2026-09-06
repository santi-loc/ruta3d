import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "3Dimension",
  domain: "3dimension.empretienda.com.ar",
  baseUrl: "https://3dimension.empretienda.com.ar",
};

const DEFAULT_OUTPUT = "data/3dimension-products.json";
const CATEGORY_PATHS = [
  "/cortadoras-laser",
  "/cortadoras-laser/accesorios",
  "/cortadoras-laser/creality",
  "/cortadoras-laser/algolaser",
  "/cortadoras-laser/combos",
  "/grabadora-laser-fibra",
];
const MAX_CATEGORY_PAGES = Number.parseInt(process.env.THREEDIMENSION_MAX_CATEGORY_PAGES ?? "2", 10);

const brandLabels = [
  "AlgoLaser",
  "Algolaser",
  "Creality",
  "xTool",
  "Sculpfun",
  "Neje",
  "Two Trees",
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

function slugFromUrl(url) {
  return url?.split("/").filter(Boolean).at(-1) ?? null;
}

function inferBrand(name) {
  const text = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const brand = brandLabels.find((label) =>
    text.includes(label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
  );

  return brand === "Algolaser" ? "AlgoLaser" : brand ?? null;
}

function makeTags(name, url, brand) {
  const text = `${name} ${url} ${brand ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tags = new Set(["Corte láser"]);

  if (brand) tags.add(brand);
  if (text.includes("fibra")) tags.add("Fibra");
  if (text.includes("diodo") || text.includes("diode")) tags.add("Diodo");
  if (text.includes("rotatorio") || text.includes("rotary")) tags.add("Rotatorio");
  if (text.includes("panal") || text.includes("honeycomb")) tags.add("Panal");
  if (text.includes("aire")) tags.add("Air Assist");
  if (text.includes("combo")) tags.add("Combo");

  return [...tags].slice(0, 6);
}

function stockLabel(available) {
  return available ? "En stock" : "Consultar";
}

function extractProducts(html, sourceUrl) {
  const productRegex =
    /<div class="products-feed__product\s[^"]*"[\s\S]*?(?=<div class="products-feed__product\s|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="uk-width-1-1"|<footer|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const block = match[0];
    const url = normalizeUrl(
      block.match(/<a[^>]+href="(https:\/\/3dimension\.empretienda\.com\.ar\/[^"]+)"/)?.[1] ??
        block.match(/<a[^>]+href="(\/[^"]+)"/)?.[1],
    );
    const name = decodeHtml(
      block.match(/<h3 class="[^"]*\bproducts-feed__product-name\b[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ??
        block.match(/alt="Producto - ([^"]+)"/)?.[1] ??
        "",
    );
    const image = normalizeUrl(block.match(/<img class="[^"]*\bproducts-feed__product-image\b[^"]*" src="([^"]+)"/)?.[1]);
    const price = parseMoney(
      block.match(/<p class="[^"]*\bproducts-feed__product-price\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1],
    );
    const productId = block.match(/data-id="(\d+)"/)?.[1] ?? slugFromUrl(url);
    const available = !/\bSIN\s+STOCK\b/i.test(decodeHtml(block)) && Boolean(price);
    const brand = inferBrand(name);

    if (!productId || !name || !url || !price) continue;

    products.push({
      id: `3dimension-${productId}`,
      sourceProductId: productId,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: "Corte láser",
      price,
      currency: "ARS",
      previousPrice: null,
      transferPrice: null,
      purchaseModes: available ? ["Entrega inmediata"] : [],
      stock: available ? 1 : 0,
      stockLabel: stockLabel(available),
      available,
      brand,
      tags: makeTags(name, url, brand),
      image,
      url,
      scrapedFrom: sourceUrl,
      variants: [],
    });
  }

  return products;
}

async function fetchPage(pathname, page) {
  const url = page === 1 ? `${STORE.baseUrl}${pathname}` : `${STORE.baseUrl}${pathname}?page=${page}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`3Dimension responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];

  for (const pathname of CATEGORY_PATHS) {
    for (let page = 1; page <= MAX_CATEGORY_PAGES; page += 1) {
      const { url, html } = await fetchPage(pathname, page);
      const pageProducts = extractProducts(html, url);
      const newProducts = pageProducts.filter((product) => {
        if (seen.has(product.url)) return false;
        seen.add(product.url);
        return true;
      });

      pages.push({ page, path: pathname, url, found: pageProducts.length, added: newProducts.length });
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

console.log(`Scraped ${result.count} 3Dimension products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.path} page ${page.page}: ${page.added}/${page.found} new products`);
}
