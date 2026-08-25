import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Todo 3D",
  domain: "todo3dsf.com.ar",
  baseUrl: "https://www.todo3dsf.com.ar",
};

const DEFAULT_OUTPUT = "data/todo3dsf-products.json";
const CATEGORY_PATHS = [
  "/productos",
  "/insumos-3d/filamentos",
  "/insumos-3d/filamentos/filamento-pla",
  "/insumos-3d/filamentos/filamento-abs",
  "/insumos-3d/filamentos/filamento-petg",
  "/insumos-3d/filamentos/otros-filamentos",
  "/insumos-3d/repuestos",
  "/insumos-3d/resinas",
  "/impresoras-3d",
  "/impresoras-3d/fdm-filamento",
  "/impresoras-3d/sla-resina",
  "/accesorios",
  "/grabadoras-laser",
];
const MAX_CATEGORY_PAGES = Number.parseInt(process.env.TODO3DSF_MAX_CATEGORY_PAGES ?? "1", 10);

const brandLabels = [
  "3N3",
  "Anycubic",
  "Artillery",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Grilón3",
  "Grilon3",
  "Hellbot",
  "Printalot",
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

function inferCategory(name, url) {
  const text = `${name} ${url}`.toLowerCase();

  if (text.includes("resina")) return "Resina";
  if (
    text.includes("impresora") ||
    text.includes("bambu") ||
    text.includes("creality") ||
    text.includes("anycubic") ||
    text.includes("ender")
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
    text.includes("grilon")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("repuesto") ||
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("hotend") ||
    text.includes("placa") ||
    text.includes("sensor")
  ) {
    return "Repuestos";
  }
  if (text.includes("laser") || text.includes("herramienta")) return "Herramientas";

  return "Accesorios";
}

function inferBrand(name) {
  const text = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const brand = brandLabels.find((label) =>
    text.includes(label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
  );

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "Grilón3") return "Grilon3";

  return brand ?? null;
}

function makeTags(name, url, brand) {
  const text = `${name} ${url} ${brand ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "NYLON", "PC", "PVA"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("bambu")) tags.add("Bambu Lab");
  if (text.includes("creality") || text.includes("ender")) tags.add("Creality");
  if (text.includes("grilon")) tags.add("Grilon3");

  return [...tags].slice(0, 5);
}

function stockLabel(available) {
  return available ? "En stock" : "Consultar";
}

function extractProducts(html, sourceUrl) {
  const productRegex =
    /<div class="[^"]*\bproducts-feed__product\b[^"]*"[\s\S]*?(?=<div class="[^"]*\bproducts-feed__product\b|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="uk-width-1-1"|<footer|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const block = match[0];
    const url = normalizeUrl(
      block.match(/<a[^>]+href="(https:\/\/www\.todo3dsf\.com\.ar\/[^"]+)"/)?.[1] ??
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
      id: `todo3dsf-${productId}`,
      sourceProductId: productId,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name, url),
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
    throw new Error(`Todo 3D responded ${response.status} for ${url}`);
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

console.log(`Scraped ${result.count} Todo 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.path} page ${page.page}: ${page.added}/${page.found} new products`);
}
