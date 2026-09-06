import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = {
  name: "Creaxis 3D",
  domain: "creaxis.com.ar",
  baseUrl: "https://creaxis.com.ar",
  apiPath: "/wp-json/wc/store/v1/products",
};

const DEFAULT_OUTPUT = "data/creaxis-products.json";
const PER_PAGE = 100;
const MAX_PAGES = Number.parseInt(process.env.CREAXIS_MAX_PAGES ?? "10", 10);
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.CREAXIS_TIMEOUT_MS ?? "25000", 10);
const REQUEST_RETRIES = Number.parseInt(process.env.CREAXIS_RETRIES ?? "3", 10);

const brandLabels = [
  "Anycubic",
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Filar",
  "Flashforge",
  "Hellbot",
  "LaserPecker",
  "xTool",
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#8211;", "-")
    .replaceAll("&#36;", "$")
    .replaceAll("&#036;", "$")
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

function parseMoney(value) {
  if (!value) return null;
  const normalized = decodeHtml(value)
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function taxonomyText(product) {
  return [
    ...(product.categories ?? []).map((category) => category.name),
    ...(product.categories ?? []).map((category) => category.slug),
    ...(product.tags ?? []).map((tag) => tag.name),
    ...(product.tags ?? []).map((tag) => tag.slug),
    ...(product.brands ?? []).map((brand) => brand.name),
    ...(product.brands ?? []).map((brand) => brand.slug),
  ].join(" ");
}

function priceFromMinorUnits(value, minorUnit = 0) {
  const amount = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(amount)) return null;

  return amount / 10 ** minorUnit;
}

function priceRangeMin(product, minorUnit) {
  const rangeMin = product.prices?.price_range?.min_amount;
  return priceFromMinorUnits(rangeMin ?? product.prices?.price, minorUnit);
}

function extractPriceHtmlAmount(priceHtml, className) {
  const markerIndex = priceHtml?.indexOf(className) ?? -1;
  if (markerIndex < 0) return null;

  const nearbyHtml = priceHtml.slice(markerIndex, markerIndex + 700);
  const amount = nearbyHtml.match(/(?:&#036;|&#36;|\$)<\/span>(?:&nbsp;|\s)*([\d.]+(?:,\d+)?)/)?.[1];
  return parseMoney(amount);
}

function inferCategory(product) {
  const nameText = normalizeText(product.name);
  const taxonomy = normalizeText(taxonomyText(product));
  const fullText = normalizeText([product.name, product.description, taxonomyText(product)].join(" "));

  if (taxonomy.includes("laser") || taxonomy.includes("cortadora") || taxonomy.includes("grabadora")) return "Corte laser";
  if (taxonomy.includes("resina") || nameText.includes("resina")) return "Resina";
  if (
    taxonomy.includes("impresora") ||
    nameText.includes("impresora") ||
    nameText.includes("printer") ||
    nameText.includes("bambu lab a1") ||
    nameText.includes("bambulab a1")
  ) {
    return "Impresoras";
  }
  if (
    taxonomy.includes("filamento") ||
    nameText.includes("filamento") ||
    nameText.includes("pla") ||
    nameText.includes("petg") ||
    nameText.includes("abs") ||
    nameText.includes("tpu")
  ) {
    return "Filamentos";
  }
  if (
    taxonomy.includes("repuesto") ||
    fullText.includes("hotend") ||
    fullText.includes("boquilla") ||
    fullText.includes("nozzle") ||
    fullText.includes("extrusor")
  ) {
    return "Repuestos";
  }

  return "Accesorios";
}

function inferBrand(product) {
  const attributeBrand = (product.attributes ?? [])
    .find((attribute) => normalizeText(attribute.name) === "marca")
    ?.terms?.[0]?.name;
  const apiBrand = product.brands?.[0]?.name;
  const text = normalizeText([product.name, product.description, taxonomyText(product), attributeBrand, apiBrand].join(" "));
  const brand = brandLabels.find((label) => text.includes(normalizeText(label)));

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand) return brand;
  if (attributeBrand && normalizeText(attributeBrand) !== "sin marca") return decodeHtml(attributeBrand);
  if (apiBrand && normalizeText(apiBrand) !== "sin marca") return decodeHtml(apiBrand);

  return null;
}

function attributeTerms(product) {
  return (product.attributes ?? [])
    .flatMap((attribute) => attribute.terms ?? [])
    .map((term) => decodeHtml(term.name))
    .filter(Boolean);
}

function makeTags(product, brand) {
  const text = normalizeText([product.name, taxonomyText(product), ...attributeTerms(product)].join(" "));
  const descriptionText = normalizeText(product.description);
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA Silk", "PLA+", "PLA Mate", "PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "NYLON"]) {
    if (text.includes(normalizeText(material))) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg")) tags.add("1kg");
  if (text.includes("500g") || text.includes("500 g")) tags.add("500g");
  if (text.includes("silk")) tags.add("Silk");
  if (text.includes("mate") || text.includes("matte")) tags.add("Mate");
  if (text.includes("laser")) tags.add("Laser");
  if (descriptionText.includes("preventa") || descriptionText.includes("entrega pactada")) tags.add("Preventa");

  return [...tags].slice(0, 6);
}

function parseStock(product) {
  const maximum = Number(product.add_to_cart?.maximum);
  if (Number.isFinite(maximum) && maximum > 0 && maximum < 9999) return maximum;

  const lowStock = Number(product.low_stock_remaining);
  if (Number.isFinite(lowStock) && lowStock > 0) return lowStock;

  const stockText = product.stock_availability?.text ?? "";
  const stock = Number.parseInt(stockText.match(/\d+/)?.[0] ?? "", 10);

  return Number.isFinite(stock) ? stock : null;
}

function stockLabel(stock, available) {
  if (!available || stock === 0) return "Consultar";
  if (stock !== null && stock <= 3) return "Pocas unidades";
  return "En stock";
}

function inferPurchaseModes(product) {
  const text = normalizeText([product.name, product.description, product.short_description].join(" "));
  const modes = [];

  if (/\b(preventa|pre venta|entrega pactada|reserva|senal|seña)\b/i.test(text)) modes.push("Preventa");
  if (product.is_in_stock && !modes.length) modes.push("Entrega inmediata");

  return modes;
}

function variationOptions(variation) {
  return (variation.attributes ?? [])
    .map((attribute) => decodeHtml([attribute.name, attribute.value].filter(Boolean).join(": ")))
    .filter(Boolean);
}

function attributeOptions(product) {
  return (product.attributes ?? [])
    .filter((attribute) => attribute.has_variations)
    .flatMap((attribute) =>
      (attribute.terms ?? []).map((term) => decodeHtml([attribute.name, term.name].filter(Boolean).join(": "))),
    )
    .filter(Boolean);
}

function toScrapedProduct(product) {
  const minorUnit = product.prices?.currency_minor_unit ?? 0;
  const transferPrice = priceRangeMin(product, minorUnit);
  const listPrice = extractPriceHtmlAmount(product.price_html, "crea-lista-monto");
  const regularPrice = priceFromMinorUnits(product.prices?.regular_price, minorUnit);
  const price = listPrice && listPrice > transferPrice ? listPrice : regularPrice ?? transferPrice;
  const stock = parseStock(product);
  const available = Boolean(product.is_in_stock);
  const brand = inferBrand(product);
  const variationDetails = (product.variations ?? []).map((variation) => ({
    id: `creaxis-${variation.id}`,
    sku: String(variation.id),
    available,
    options: variationOptions(variation),
  }));

  if (!product.name || !product.permalink || !price) return null;

  return {
    id: `creaxis-${product.id}`,
    sourceProductId: String(product.id),
    store: STORE.name,
    domain: STORE.domain,
    name: decodeHtml(product.name),
    category: inferCategory(product),
    price,
    currency: product.prices?.currency_code ?? "ARS",
    previousPrice: null,
    transferPrice: transferPrice && transferPrice < price ? transferPrice : null,
    purchaseModes: inferPurchaseModes(product),
    stock,
    stockLabel: stockLabel(stock, available),
    available,
    brand,
    tags: makeTags(product, brand),
    image: product.images?.[0]?.src ?? null,
    url: product.permalink,
    scrapedFrom: `${STORE.baseUrl}${STORE.apiPath}`,
    variants: variationDetails.length
      ? variationDetails
      : attributeOptions(product).map((option, index) => ({
          id: `creaxis-${product.id}-option-${index}`,
          sku: `${product.id}-${index}`,
          available,
          options: [option],
        })),
  };
}

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "Ruta3D MVP scraper (+https://filtrar-3d.locatellisanti.chatgpt.site)",
          accept: "application/json",
        },
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Creaxis 3D responded ${response.status} for ${url}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === REQUEST_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError;
}

async function scrape() {
  const products = [];
  const pages = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${STORE.baseUrl}${STORE.apiPath}?per_page=${PER_PAGE}&page=${page}`;
    console.log(`Fetching Creaxis 3D page ${page}`);
    const rawProducts = await fetchJson(url);
    const pageProducts = rawProducts.map(toScrapedProduct).filter(Boolean);

    pages.push({ page, url, found: rawProducts.length, added: pageProducts.length });
    products.push(...pageProducts);

    if (rawProducts.length < PER_PAGE) break;
  }

  const uniqueProducts = [...new Map(products.map((product) => [product.id, product])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    store: STORE,
    scrapedAt: new Date().toISOString(),
    source: `${STORE.baseUrl}${STORE.apiPath}`,
    pages,
    products: uniqueProducts,
  };
}

function outputPathFromArgs() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  return outputArg ? outputArg.slice("--output=".length) : DEFAULT_OUTPUT;
}

const outputPath = outputPathFromArgs();
const catalog = await scrape();

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`Saved ${catalog.products.length} Creaxis 3D products to ${outputPath}`);
