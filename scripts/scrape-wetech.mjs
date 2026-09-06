import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "WeTech",
  domain: "shop.wetech.ar",
  baseUrl: "https://shop.wetech.ar",
  listingPath: "/products",
};

const DEFAULT_OUTPUT = "data/wetech-products.json";
const FETCH_TIMEOUT_MS = 20_000;
const MIN_PRICE = 100;
const MIN_FILAMENT_PRICE = 10_000;

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableId(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productId(group) {
  const key = String(group.key ?? "");
  if (key.startsWith("fam")) {
    return [group.marca, group.material, group.linea, group.origen].filter(Boolean).join("-").toUpperCase();
  }
  if (key.startsWith("item:")) return key.slice(5);

  return group.variantes?.[0]?.id ?? key;
}

function variantColor(variant) {
  const optionColor = variant.opciones?.Colores?.trim();
  if (optionColor) return optionColor;

  return variant.atributos
    ?.find((attribute) => normalizeText(attribute.clase) === "COLORES")
    ?.valor
    ?.trim() ?? null;
}

function imageUrl(value, fallback = null) {
  const text = cleanText(value);
  return text || fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferCategory(group, variants) {
  const text = normalizeText([
    group.nombre,
    group.grupo,
    group.subgrupo,
    group.marca,
    group.material,
    ...variants.map((variant) => variant.descripcion),
  ].join(" "));

  if (text.includes("RESINA")) return "Resina";
  if (text.includes("IMPRESORA")) return "Impresoras";
  if (
    text.includes("FILAMENTO") ||
    text.includes("PLA") ||
    text.includes("PETG") ||
    text.includes("ABS") ||
    text.includes("ASA") ||
    text.includes("TPU") ||
    text.includes("NYLON")
  ) {
    return "Filamentos";
  }
  if (
    text.includes("REPUESTO") ||
    text.includes("NOZZLE") ||
    text.includes("BOQUILLA") ||
    text.includes("HOTEND") ||
    text.includes("EXTRUSOR") ||
    text.includes("PLACA") ||
    text.includes("SENSOR")
  ) {
    return "Repuestos";
  }
  if (text.includes("HERRAMIENTA") || text.includes("ADHESIVO") || text.includes("PEGAMENTO")) {
    return "Herramientas";
  }

  return "Accesorios";
}

function stockLabel(stock, available) {
  if (!available) return "Consultar";
  if (stock <= 3) return "Pocas unidades";
  return "En stock";
}

function filteredVariants(group) {
  const isFilament = ["FILAMENTO 3D", "FILAMENTOS"].includes(normalizeText(group.grupo));
  const isAccessory = normalizeText(group.grupo) === "REPUESTOS & ACCESORIOS";

  if (normalizeText(group.grupo) === "IMPRESORAS 3D") return [];

  return (group.variantes ?? []).filter((variant) => {
    if (variant.visible === false) return false;
    if (/^TEST_/i.test(String(variant.familia ?? "")) || /DEMO$/i.test(String(variant.familia ?? ""))) return false;
    if (isFilament && !variant.familia) return false;
    if (isFilament && String(variant.descripcion ?? "").trim().toLowerCase().endsWith("mm")) return false;
    if (isFilament && !/^[^-]+-[^-]+-[^-]+-[^-]+$/.test(String(variant.id ?? ""))) return false;

    const price = parseNumber(variant.precioVtaCotizadoMin) ?? 0;
    if (price < MIN_PRICE || (isFilament && price < MIN_FILAMENT_PRICE)) return false;
    if (!imageUrl(variant.fotoUrl) && !isAccessory) return false;
    if (isFilament && variant.pesoKg == null) return false;
    if (isFilament && !variantColor(variant)) return false;

    return true;
  });
}

function tagsFor(group, variants) {
  const weights = unique(variants.map((variant) => {
    const weight = parseNumber(variant.pesoKg);
    return weight ? `${weight}kg` : null;
  }));

  return unique([
    group.marca,
    group.material,
    group.linea,
    group.origen,
    group.subgrupo,
    ...weights,
  ]).slice(0, 8);
}

function toScrapedProduct(group) {
  const variants = filteredVariants(group);
  if (!variants.length) return null;

  const id = productId(group);
  const prices = variants.map((variant) => parseNumber(variant.precioVtaCotizadoMin)).filter(Boolean);
  const transferPrices = variants.map((variant) => parseNumber(variant.promotionalPrice)).filter(Boolean);
  const stock = variants.reduce((total, variant) => total + Math.max(0, Number(variant.stock ?? 0)), 0);
  const image = imageUrl(variants.find((variant) => imageUrl(variant.fotoUrl))?.fotoUrl);
  const category = inferCategory(group, variants);
  const tags = tagsFor(group, variants);
  const url = `${STORE.baseUrl}/product/${encodeURIComponent(id)}`;

  if (!id || !group.nombre || !prices.length) return null;

  return {
    id: `wetech-${stableId(id)}`,
    sourceProductId: id,
    store: STORE.name,
    domain: STORE.domain,
    name: cleanText(group.nombre),
    category,
    price: Math.min(...prices),
    currency: "ARS",
    previousPrice: null,
    transferPrice: transferPrices.length ? Math.min(...transferPrices) : null,
    stock,
    stockLabel: stockLabel(stock, stock > 0),
    available: stock > 0,
    brand: cleanText(group.marca) || null,
    tags,
    image,
    url,
    scrapedFrom: `${STORE.baseUrl}${STORE.listingPath}`,
    variants: variants.map((variant) => {
      const weight = parseNumber(variant.pesoKg);
      const color = variantColor(variant);

      return {
        id: String(variant.id),
        available: Number(variant.stock ?? 0) > 0,
        price: parseNumber(variant.precioVtaCotizadoMin) ?? Math.min(...prices),
        options: unique([
          color,
          weight ? `${weight}kg` : null,
          group.material,
          group.linea,
          group.origen,
        ]),
      };
    }),
  };
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
        ...options.headers,
      },
    });

    if (!response.ok) throw new Error(`WeTech responded ${response.status} for ${url}`);

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverApi() {
  const html = await fetchText(STORE.baseUrl);
  const scriptPath = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
  if (!scriptPath) throw new Error("Could not find WeTech storefront bundle");

  const script = await fetchText(`${STORE.baseUrl}${scriptPath}`);
  const match = script.match(/const\s+sd="([^"]+)",pN="([^"]+)"/);
  if (!match) throw new Error("Could not find WeTech catalog API credentials in storefront bundle");

  return {
    apiBaseUrl: match[1],
    token: match[2],
  };
}

async function fetchCatalog() {
  const { apiBaseUrl, token } = await discoverApi();
  const text = await fetchText(`${apiBaseUrl}/stk-item/catalogo`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
  });
  const catalog = JSON.parse(text);

  if (!Array.isArray(catalog)) {
    throw new Error("WeTech catalog response is not an array");
  }

  return catalog;
}

async function scrape() {
  const rawProducts = await fetchCatalog();
  const products = rawProducts.map(toScrapedProduct).filter(Boolean);

  return {
    store: STORE,
    scrapedAt: new Date().toISOString(),
    count: products.length,
    pages: [{ page: 1, path: "/stk-item/catalogo", url: "https://back.wetech.ar/stk-item/catalogo", found: rawProducts.length, added: products.length }],
    products,
  };
}

const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputPath = path.resolve(outputArg ? outputArg.split("=").slice(1).join("=") : DEFAULT_OUTPUT);
const result = await scrape();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Scraped ${result.count} WeTech products into ${path.relative(process.cwd(), outputPath)}`);
