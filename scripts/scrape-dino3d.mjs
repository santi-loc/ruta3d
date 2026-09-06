import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Dino 3D",
  domain: "dino3d.com.ar",
  baseUrl: "https://www.dino3d.com.ar",
  listingPath: "/productos.php",
};

const DEFAULT_OUTPUT = "data/dino3d-products.json";

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
  if (/^https?:\/\//.test(value)) return value.replace("https://dino3d.wuaze.com", STORE.baseUrl);

  return `${STORE.baseUrl}/${value.replace(/^\.?\//, "")}`;
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

function attr(block, name) {
  return decodeHtml(block.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "");
}

function labeledValue(block, label) {
  const match = block.match(new RegExp(`${label}:\\s*<strong>([\\s\\S]*?)<\\/strong>`, "i"));
  return decodeHtml(match?.[1] ?? "");
}

function inferCategory(category, name, material) {
  const text = normalizeText([category, name, material].filter(Boolean).join(" "));

  if (text.includes("resina")) return "Resina";
  if (text.includes("impresora") || text.includes("bambu") || text.includes("creality") || text.includes("snapmaker")) {
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
    text.includes("repuesto") ||
    text.includes("boquilla") ||
    text.includes("nozzle") ||
    text.includes("hotend") ||
    text.includes("extrusor")
  ) {
    return "Repuestos";
  }
  if (text.includes("laser") || text.includes("fijador") || text.includes("adhesivo") || text.includes("pegamento")) {
    return "Herramientas";
  }

  return "Accesorios";
}

function makeTags({ brand, category, color, material, name }) {
  const text = normalizeText([name, category, color, material, brand].filter(Boolean).join(" "));
  const tags = new Set();

  if (brand) tags.add(brand);
  if (color) tags.add(color);
  for (const candidate of ["PLA Silk", "PLA HS", "PLA+", "PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"]) {
    if (text.includes(normalizeText(candidate))) tags.add(candidate);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("recarga")) tags.add("Recarga");
  if (text.includes("silk")) tags.add("Silk");

  return [...tags].slice(0, 6);
}

function stockLabel(block) {
  const text = decodeHtml(block);
  if (/\bsin stock\b/i.test(text)) return "Consultar";
  return "En stock";
}

function extractProducts(html, sourceUrl) {
  const products = [];
  const articleRegex = /<article class="product-card-modal-trigger[\s\S]*?<\/article>/g;

  for (const match of html.matchAll(articleRegex)) {
    const block = match[0];
    const productCode = attr(block, "data-product-code");
    const name = attr(block, "data-product-name");
    const brand = attr(block, "data-product-brand") || null;
    const category = decodeHtml(block.match(/<p class="[^"]*uppercase[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    const color = labeledValue(block, "Color") || null;
    const material = labeledValue(block, "Material") || null;
    const price = Number.parseFloat(attr(block, "data-product-price")) || parseMoney(block.match(/product-card-price[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const previousPrice = parseMoney(block.match(/product-card-previous-price[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const image = normalizeUrl(attr(block, "data-product-image") || block.match(/<img[^>]+src="([^"]+)"/)?.[1]);
    const available = stockLabel(block) !== "Consultar";

    if (!productCode || !name || !price) continue;

    products.push({
      id: `dino3d-${productCode}`,
      sourceProductId: productCode,
      store: STORE.name,
      domain: STORE.domain,
      name,
      category: inferCategory(category, name, material),
      price,
      currency: "ARS",
      previousPrice: previousPrice && previousPrice >= price ? previousPrice : null,
      transferPrice: null,
      purchaseModes: available ? ["Entrega inmediata"] : [],
      stock: available ? 1 : 0,
      stockLabel: stockLabel(block),
      available,
      brand,
      color,
      tags: makeTags({ brand, category, color, material, name }),
      image,
      url: `${STORE.baseUrl}${STORE.listingPath}?q=${encodeURIComponent(productCode)}`,
      scrapedFrom: sourceUrl,
      variants: material || color ? [{
        id: productCode,
        sku: productCode,
        price,
        stock: available ? 1 : 0,
        available,
        options: [color, material].filter(Boolean),
        image,
      }] : [],
    });
  }

  return products;
}

async function fetchCatalog() {
  const url = `${STORE.baseUrl}${STORE.listingPath}?por_pagina=Todos`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Dino 3D responded ${response.status} for ${url}`);
  }

  return { url, html: await response.text() };
}

async function scrape() {
  const { url, html } = await fetchCatalog();
  const products = extractProducts(html, url);

  return {
    store: STORE,
    scrapedAt: new Date().toISOString(),
    count: products.length,
    pages: [{ page: 1, path: STORE.listingPath, url, found: products.length, added: products.length }],
    products,
  };
}

const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputPath = path.resolve(outputArg ? outputArg.split("=").slice(1).join("=") : DEFAULT_OUTPUT);
const result = await scrape();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Scraped ${result.count} Dino 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.path}: ${page.added}/${page.found} new products`);
}
