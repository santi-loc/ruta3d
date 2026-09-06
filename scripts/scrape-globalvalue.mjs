import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Global Value",
  domain: "globalvalue.ar",
  baseUrl: "https://globalvalue.ar",
};

const DEFAULT_OUTPUT = "data/globalvalue-products.json";
const MAX_PAGES = Number.parseInt(process.env.GLOBALVALUE_MAX_PAGES ?? "20", 10);
const MAX_REASONABLE_PRICE = 100_000_000;

const brandLabels = [
  "AlgoLaser",
  "Algolaser",
  "Anycubic",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Falcon",
  "LaserVii",
  "Laservii",
  "Lunyee",
  "Sculpfun",
  "Snapmaker",
  "Two Trees",
  "xTool",
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#160;", " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#8211;", "-")
    .replaceAll("&#36;", "$")
    .replaceAll("&#038;", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
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

function inferBrand(name) {
  const text = normalizeText(name);
  const brand = brandLabels.find((label) => text.includes(normalizeText(label)));

  if (brand === "Algolaser") return "AlgoLaser";
  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "Laservii") return "LaserVii";

  return brand ?? null;
}

function inferCategory(name) {
  const text = normalizeText(name);

  if (text.includes("resina")) return "Resina";
  if (text.includes("filamento") || /\b(pla|petg|abs|asa|tpu)\b/i.test(text)) return "Filamentos";
  if (text.includes("impresora 3d") || text.includes("bambu lab") || text.includes("snapmaker")) return "Impresoras";
  if (text.includes("laser") || text.includes("láser") || text.includes("grabadora") || text.includes("cortadora") || text.includes("cnc")) {
    return "Corte láser";
  }
  if (text.includes("repuesto") || text.includes("cabezal") || text.includes("filtro") || text.includes("lentes")) return "Repuestos";

  return "Accesorios";
}

function makeTags(name, brand) {
  const text = normalizeText(`${name} ${brand ?? ""}`);
  const tags = new Set();

  if (brand) tags.add(brand);
  if (text.includes("laser") || text.includes("laservii") || text.includes("algolaser")) tags.add("Laser");
  if (text.includes("cnc")) tags.add("CNC");
  if (text.includes("fibra")) tags.add("Fibra");
  if (text.includes("diodo")) tags.add("Diodo");
  if (text.includes("co2")) tags.add("CO2");
  if (text.includes("uv")) tags.add("UV");
  if (text.includes("rotativo") || text.includes("rotatorio")) tags.add("Rotatorio");
  if (text.includes("panal") || text.includes("abejas")) tags.add("Panal");
  if (text.includes("bambu lab")) tags.add("Bambu Lab");

  return [...tags].slice(0, 6);
}

function extractProducts(html, sourceUrl) {
  const productRegex =
    /<div class="col tp-product-item\b[\s\S]*?(?=<div class="col tp-product-item\b|<div class="d-flex flex-column align-items-center justify-content-center my-4 tp-product-pager"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="oe_structure|$)/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const block = match[0];
    const templateId = block.match(/data-product-template-id="(\d+)"/)?.[1] ??
      block.match(/name="product_template_id" type="hidden" value="(\d+)"/)?.[1];
    const productId = block.match(/name="product_id" type="hidden" value="(\d+)"/)?.[1] ?? templateId;
    const url = normalizeUrl(
      block.match(/<a[^>]+class="[^"]*\btp-product-image-container\b[^"]*"[^>]+href="([^"]+)"/)?.[1] ??
        block.match(/<a[^>]+itemprop="name"[^>]+href="([^"]+)"/)?.[1],
    );
    const name = decodeHtml(
      block.match(/<a[^>]+itemprop="name"[^>]+title="([^"]+)"/)?.[1] ??
        block.match(/<a[^>]+itemprop="name"[^>]*>([\s\S]*?)<\/a>/)?.[1] ??
        "",
    );
    const image = normalizeUrl(block.match(/<img[^>]+itemprop="image"[^>]+src="([^"]+)"/)?.[1]);
    const price = parseMoney(
      block.match(/<span[^>]+itemprop="price"[^>]*>([\s\S]*?)<\/span>/)?.[1] ??
        block.match(/data-oe-expression="template_price_vals\[&#39;price_reduce&#39;\]"[\s\S]*?<span class="oe_currency_value">([\s\S]*?)<\/span>/)?.[1],
    );
    const previousPrice = parseMoney(
      block.match(/data-oe-expression="template_price_vals\[&#39;base_price&#39;\]"[\s\S]*?<span class="oe_currency_value">([\s\S]*?)<\/span>/)?.[1],
    );
    const brand = inferBrand(name);
    const available = !/\b(out of stock|sin stock|consultar)\b/i.test(decodeHtml(block));

    if (!productId || !name || !url || !price || price >= MAX_REASONABLE_PRICE) continue;

    products.push({
      id: `globalvalue-${templateId ?? productId}`,
      sourceProductId: String(productId),
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name),
      price,
      currency: "ARS",
      previousPrice: previousPrice && previousPrice > price ? previousPrice : null,
      transferPrice: null,
      purchaseModes: available ? ["Entrega inmediata"] : [],
      stock: available ? 1 : 0,
      stockLabel: available ? "En stock" : "Consultar",
      available,
      brand,
      tags: makeTags(name, brand),
      image,
      url,
      scrapedFrom: sourceUrl,
      variants: [],
    });
  }

  return products;
}

function nextPagePath(html) {
  return decodeHtml(html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*\btp-load-more-btn\b[^"]*"/)?.[1] ?? "");
}

function pageUrl(pagePath) {
  return new URL(pagePath || "/shop", STORE.baseUrl).href;
}

async function fetchPage(pagePath) {
  const url = pageUrl(pagePath);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Global Value responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];
  let nextPath = "/shop";

  for (let page = 1; nextPath && page <= MAX_PAGES; page += 1) {
    const { url, html } = await fetchPage(nextPath);
    const pageProducts = extractProducts(html, url);
    const newProducts = pageProducts.filter((product) => {
      if (seen.has(product.url)) return false;
      seen.add(product.url);
      return true;
    });

    pages.push({ page, url, found: pageProducts.length, added: newProducts.length });
    products.push(...newProducts);

    nextPath = nextPagePath(html);
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

console.log(`Scraped ${result.count} Global Value products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} new products`);
}
