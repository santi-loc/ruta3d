import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Gprint 3D",
  domain: "gprint3d.com.ar",
  baseUrl: "https://gprint3d.com.ar",
};

const LISTINGS = [
  { label: "Impresoras FDM", path: "/16-impresoras-3d-filamentos-" },
  { label: "Impresoras Resina", path: "/17-impresoras-3d-resinas" },
  { label: "Grabadoras Laser", path: "/18-grabadoras-laser" },
  { label: "PLA", path: "/20-pla" },
  { label: "PETG", path: "/21-petg" },
  { label: "ABS", path: "/22-abs" },
  { label: "Especiales Tecnicos", path: "/23-especialestecnicos-" },
  { label: "Resinas", path: "/24-estandar" },
  { label: "Otras Resinas", path: "/25-otras" },
  { label: "Repuestos", path: "/14-repuestos" },
  { label: "Impresoras Laser", path: "/26-impresoras-laser" },
  { label: "Novedades", path: "/novedades" },
];

const DEFAULT_OUTPUT = "data/gprint3d-products.json";
const MAX_PAGES_PER_LISTING = Number.parseInt(process.env.GPRINT3D_MAX_PAGES ?? "4", 10);

const brandLabels = [
  "3N3",
  "Anycubic",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Elego",
  "Grilon3",
  "Hellbot",
  "Printalot",
  "Ricoh",
  "Snapmaker",
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#8211;", "-")
    .replaceAll("&#36;", "$")
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

function pageUrl(listing, page) {
  const url = new URL(normalizeUrl(listing.path));
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
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

function nameFromUrl(url) {
  const slug = url
    ?.split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.html$/i, "")
    .replace(/^\d+-+/, "")
    .replace(/-+/g, " ");

  if (!slug) return "";

  return slug
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^(a1|ams|cfs|fdm|hi|k1|k2|pla|petg|abs|asa|tpu|uw03)$/i.test(word)) return word.toUpperCase();
      if (/^\d/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function normalizeSearchText(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferBrand(name) {
  const text = normalizeSearchText(name);
  const brand = brandLabels.find((label) => text.includes(normalizeSearchText(label)));

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "Elego") return "Elegoo";

  return brand ?? null;
}

function inferCategory(name, listingLabel) {
  const text = normalizeSearchText(`${name} ${listingLabel}`);

  if (text.includes("resina") || text.includes("lavadora") || text.includes("curadora")) return "Resina";
  if (
    text.includes("impresora") ||
    text.includes("bambu") ||
    text.includes("creality") ||
    text.includes("anycubic") ||
    text.includes("ender") ||
    text.includes("fdm")
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
    text.includes("grilon") ||
    text.includes("insumo")
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
  if (text.includes("laser") || text.includes("scanner") || text.includes("herramienta")) return "Herramientas";

  return "Accesorios";
}

function makeTags(name, listingLabel, brand) {
  const text = normalizeSearchText(`${name} ${listingLabel} ${brand ?? ""}`);
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "NYLON", "PC", "PVA"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  if (text.includes("silk")) tags.add("PLA Silk");
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
      const url = normalizeUrl(
        block.match(/<a href="([^"]+)" class="thumbnail product-thumbnail"/)?.[1] ??
          block.match(/<h2[\s\S]*?<a href="([^"]+)"/)?.[1],
      );
      const image = normalizeUrl(
        block.match(/data-full-size-image-url="([^"]+)"/)?.[1] ??
          block.match(/<img[\s\S]*?src="([^"]+)"/)?.[1],
      );
      const visibleName = decodeHtml(block.match(/<h2[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/)?.[1] ?? "");
      const imageAlt = decodeHtml(block.match(/<img[\s\S]*?alt="([^"]+)"/)?.[1] ?? "");
      const name = visibleName && !visibleName.includes("...")
        ? visibleName
        : nameFromUrl(url) || imageAlt;
      const price = parseMoney(block.match(/<span class="price"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
      const available = !/\bFuera\s+de\s+stock\b/i.test(decodeHtml(block)) && Boolean(price);
      const brand = inferBrand(name);

      if (!productId || !name || !url || !price) return null;

      return {
        id: `gprint3d-${productId}`,
        sourceProductId: productId,
        store: STORE.name,
        domain: STORE.domain,
        name,
        category: inferCategory(name, listingLabel),
        price,
        currency: "ARS",
        previousPrice: null,
        transferPrice: null,
        purchaseModes: available ? ["Entrega inmediata"] : [],
        stock: available ? 1 : 0,
        stockLabel: available ? "En stock" : "Consultar",
        available,
        brand,
        tags: makeTags(name, listingLabel, brand),
        image,
        url,
        scrapedFrom: sourceUrl,
        variants: [],
      };
    })
    .filter(Boolean);
}

async function fetchPage(listing, page) {
  const url = pageUrl(listing, page);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Gprint 3D responded ${response.status} for ${url}`);
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

console.log(`Scraped ${result.count} Gprint 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- ${page.listing} page ${page.page}: ${page.added}/${page.found} new products`);
}
