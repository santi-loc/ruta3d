import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Osiris 3D",
  domain: "osiris3d.com.ar",
  baseUrl: "https://www.osiris3d.com.ar",
  listingPath: "/productos",
};

const DEFAULT_OUTPUT = "data/osiris3d-products.json";
const MAX_CATEGORY_PAGES = Number.parseInt(process.env.OSIRIS3D_MAX_CATEGORY_PAGES ?? "80", 10);

const brandLabels = [
  "3N3",
  "Bambu Lab",
  "Bambulab",
  "Candela",
  "Creality",
  "Elegoo",
  "FilaMax",
  "Filamax",
  "Grilon3",
  "IIIDMAX",
  "NTH",
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

function inferCategory(name, url) {
  const text = `${name} ${url}`.toLowerCase();

  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("bambu") || text.includes("creality")) return "Impresoras";
  if (
    text.includes("filamento") ||
    text.includes("filamentos") ||
    text.includes("pla") ||
    text.includes("petg") ||
    text.includes("abs") ||
    text.includes("asa") ||
    text.includes("tpu") ||
    text.includes("flexible")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("hotend") ||
    text.includes("repuesto") ||
    text.includes("extrusor")
  ) {
    return "Repuestos";
  }
  if (text.includes("adhesivo") || text.includes("fijador") || text.includes("pegamento")) return "Herramientas";

  return "Accesorios";
}

function inferBrand(name) {
  const text = name.toLowerCase();
  const brand = brandLabels.find((label) => text.includes(label.toLowerCase()));

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "Filamax") return "FilaMax";

  return brand ?? null;
}

function makeTags(name, url, brand) {
  const text = `${name} ${url}`.toLowerCase();
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("500 gr") || text.includes("500gr")) tags.add("500g");
  if (text.includes("600 gr") || text.includes("600gr")) tags.add("600g");
  if (text.includes("1,2 kg") || text.includes("1.2 kg")) tags.add("1.2kg");
  if (text.includes("silk")) tags.add("Silk");

  return [...tags].slice(0, 5);
}

function stockLabel(available) {
  return available ? "En stock" : "Consultar";
}

function categoryPathFromUrl(value) {
  const url = normalizeUrl(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.osiris3d.com.ar") return null;
    if (parsed.pathname === "/" || parsed.pathname.includes(".")) return null;
    return parsed.pathname;
  } catch {
    return null;
  }
}

function extractCategoryPaths(html) {
  const paths = new Set([STORE.listingPath]);
  const menuEnd = html.indexOf('<main');
  const menuHtml = menuEnd > 0 ? html.slice(0, menuEnd) : html;
  const categoryRoots = [
    "/filamentos",
    "/pegamentos",
    "/repuestos",
    "/resina-3d",
    "/interiores",
    "/mates-3d",
    "/impresoras-3d",
    "/juguetes",
  ];

  for (const match of menuHtml.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    const pathName = categoryPathFromUrl(match[1]);
    if (!pathName) continue;
    if (pathName === STORE.listingPath || categoryRoots.some((root) => pathName === root || pathName.startsWith(`${root}/`))) {
      paths.add(pathName);
    }
  }

  return [...paths].slice(0, MAX_CATEGORY_PAGES);
}

function extractProducts(html, sourceUrl) {
  const productRegex =
    /<div class="products-feed__product-wrapper">[\s\S]*?(?=<\/div>\s*<\/div>\s*(?:<div class="products-feed__product uk-width|<\/div>\s*<\/div>\s*<\/div>|$))/g;
  const products = [];

  for (const match of html.matchAll(productRegex)) {
    const block = match[0];
    const productId = block.match(/data-id="(\d+)"/)?.[1];
    const url = normalizeUrl(block.match(/<a href="(https:\/\/www\.osiris3d\.com\.ar\/[^"]+)"/)?.[1]);
    const name = decodeHtml(
      block.match(/<h3 class="products-feed__product-name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ??
        block.match(/alt="Producto - ([^"]+)"/)?.[1] ??
        "",
    );
    const priceBlock = block.match(/<p class="products-feed__product-price[\s\S]*?>([\s\S]*?)<\/p>/)?.[1] ?? "";
    const currentPriceText = priceBlock.replace(/<del>[\s\S]*?<\/del>/g, "");
    const price = parseMoney(decodeHtml(currentPriceText));
    const previousPrice = parseMoney(decodeHtml(priceBlock.match(/<del>([\s\S]*?)<\/del>/)?.[1] ?? ""));
    const image = normalizeUrl(block.match(/<img[^>]+src="([^"]+)"/)?.[1]);
    const available = !/\bSIN STOCK\b/i.test(decodeHtml(block));
    const brand = inferBrand(name);

    if (!productId || !name || !url || !price) continue;

    products.push({
      id: `osiris3d-${productId}`,
      sourceProductId: productId,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(name, url),
      price,
      currency: "ARS",
      previousPrice: previousPrice && previousPrice >= price ? previousPrice : null,
      transferPrice: null,
      stock: null,
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

async function fetchPage(pathName) {
  const url = `${STORE.baseUrl}${pathName}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Osiris 3D responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const seen = new Set();
  const products = [];
  const pages = [];
  const firstPage = await fetchPage(STORE.listingPath);
  const categoryPaths = extractCategoryPaths(firstPage.html);

  for (const pathName of categoryPaths) {
    const { url, html } = pathName === STORE.listingPath ? firstPage : await fetchPage(pathName);
    const pageProducts = extractProducts(html, url);
    const newProducts = pageProducts.filter((product) => {
      if (seen.has(product.url)) return false;
      seen.add(product.url);
      return true;
    });

    pages.push({ page: pages.length + 1, path: pathName, url, found: pageProducts.length, added: newProducts.length });
    products.push(...newProducts);
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

console.log(`Scraped ${result.count} Osiris 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} new products`);
}
