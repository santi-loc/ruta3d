import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const STORE = {
  name: "Kimera 3D",
  domain: "kimera3d.com.ar",
  baseUrl: "https://kimera3d.com.ar",
  apiPath: "/wp-json/wc/store/v1/products",
};

const DEFAULT_OUTPUT = "data/kimera3d-products.json";
const PER_PAGE = 100;
const FETCH_TIMEOUT_MS = 20_000;

const brandLabels = [
  "Bambu Lab",
  "Bambulab",
  "Creality",
  "Elegoo",
  "Hellbot",
  "Printalot",
  "PrintaLot",
  "3NMAX",
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

function priceFromMinorUnits(value, minorUnit = 2) {
  const amount = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(amount)) return null;

  return amount / 10 ** minorUnit;
}

function inferCategory(product) {
  const nameText = String(product.name ?? "").toLowerCase();
  const taxonomyText = [
    ...(product.categories ?? []).map((category) => category.name),
    ...(product.categories ?? []).map((category) => category.slug),
    ...(product.tags ?? []).map((tag) => tag.name),
    ...(product.tags ?? []).map((tag) => tag.slug),
  ]
    .join(" ")
    .toLowerCase();
  const fullText = `${nameText} ${taxonomyText} ${product.description ?? ""}`.toLowerCase();

  if (nameText.includes("resina") || taxonomyText.includes("resina")) return "Resina";
  if (nameText.includes("impresora") || taxonomyText.includes("impresora")) return "Impresoras";
  if (
    nameText.includes("filamento") ||
    taxonomyText.includes("filamento") ||
    taxonomyText.includes("filamentos") ||
    taxonomyText.includes("material-pla") ||
    taxonomyText.includes("material-petg") ||
    taxonomyText.includes("material-abs") ||
    taxonomyText.includes("material-tpu")
  ) {
    return "Filamentos";
  }
  if (
    fullText.includes("nozzle") ||
    fullText.includes("boquilla") ||
    fullText.includes("hotend") ||
    fullText.includes("repuesto") ||
    fullText.includes("extrusor") ||
    fullText.includes("sensor") ||
    fullText.includes("placa")
  ) {
    return "Repuestos";
  }
  if (
    fullText.includes("laser") ||
    fullText.includes("scanner") ||
    fullText.includes("herramienta") ||
    fullText.includes("cortadora") ||
    fullText.includes("plotter")
  ) {
    return "Herramientas";
  }
  if (
    fullText.includes("filamento") ||
    fullText.includes("filamentos") ||
    fullText.includes("ecofila") ||
    fullText.includes("pla") ||
    fullText.includes("petg") ||
    fullText.includes("abs") ||
    fullText.includes("asa") ||
    fullText.includes("tpu")
  ) {
    return "Filamentos";
  }

  return "Accesorios";
}

function inferBrand(product) {
  const nameText = String(product.name ?? "").toLowerCase();
  const namedBrand = brandLabels.find((label) => nameText.includes(label.toLowerCase()));
  if (namedBrand === "Bambulab") return "Bambu Lab";
  if (namedBrand === "PrintaLot") return "Printalot";
  if (namedBrand) return namedBrand;

  const apiBrand = product.brands?.[0]?.name;
  if (apiBrand) return apiBrand;

  const text = [
    product.name,
    product.description,
    ...(product.categories ?? []).map((category) => category.name),
    ...(product.categories ?? []).map((category) => category.slug),
    ...(product.tags ?? []).map((tag) => tag.name),
  ]
    .join(" ")
    .toLowerCase();
  const brand = brandLabels.find((label) => text.includes(label.toLowerCase()));

  if (brand === "Bambulab") return "Bambu Lab";
  if (brand === "PrintaLot") return "Printalot";

  return brand ?? null;
}

function makeTags(product, brand) {
  const text = [
    product.name,
    product.description,
    ...(product.categories ?? []).map((category) => category.name),
    ...(product.categories ?? []).map((category) => category.slug),
    ...(product.tags ?? []).map((tag) => tag.name),
    ...(product.tags ?? []).map((tag) => tag.slug),
  ]
    .join(" ")
    .toLowerCase();
  const tags = new Set();

  if (brand) tags.add(brand);
  for (const material of ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "PVOH"]) {
    if (text.includes(material.toLowerCase())) tags.add(material);
  }
  if (text.includes("1kg") || text.includes("1 kg") || text.includes("1k ")) tags.add("1kg");
  if (text.includes("250g") || text.includes("250 g")) tags.add("250g");
  if (text.includes("recarga")) tags.add("recarga");
  if (text.includes("cuotas")) tags.add("cuotas");

  return [...tags].slice(0, 5);
}

function parseStock(product) {
  const maximum = Number(product.add_to_cart?.maximum);
  if (Number.isFinite(maximum) && maximum > 0) return maximum;

  const stockText = product.stock_availability?.text ?? "";
  const stock = Number.parseInt(stockText.match(/\d+/)?.[0] ?? "", 10);

  return Number.isFinite(stock) ? stock : null;
}

function stockLabel(stock, available) {
  if (!available || stock === 0) return "Consultar";
  if (stock !== null && stock <= 3) return "Pocas unidades";
  return "En stock";
}

function toScrapedProduct(product) {
  const minorUnit = product.prices?.currency_minor_unit ?? 2;
  const price = priceFromMinorUnits(product.prices?.price, minorUnit);
  const regularPrice = priceFromMinorUnits(product.prices?.regular_price, minorUnit);
  const stock = parseStock(product);
  const available = Boolean(product.is_in_stock);
  const brand = inferBrand(product);

  if (!product.name || !product.permalink || !price) return null;

  return {
    id: `kimera3d-${product.id}`,
    sourceProductId: String(product.id),
    store: STORE.name,
    domain: STORE.domain,
    name: decodeHtml(product.name),
    category: inferCategory(product),
    price,
    currency: product.prices?.currency_code ?? "ARS",
    previousPrice: regularPrice && regularPrice !== price ? regularPrice : null,
    transferPrice: null,
    stock,
    stockLabel: stockLabel(stock, available),
    available,
    brand,
    tags: makeTags(product, brand),
    image: product.images?.[0]?.src ?? null,
    url: product.permalink,
    scrapedFrom: `${STORE.baseUrl}${STORE.apiPath}`,
    variants: [],
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Ruta3D/1.0; +https://filtrar-3d.locatellisanti.chatgpt.site)",
        accept: "application/json",
      },
    });

    if (!response.ok) throw new Error(`Kimera 3D responded ${response.status} for ${url}`);

    return response.json();
  } catch {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const temporaryPath = `/tmp/kimera3d-api-${process.pid}-${attempt}.json`;

      try {
        await execFileAsync(
          "curl",
          [
            "--http1.1",
            "--connect-timeout",
            "10",
            "--max-time",
            "25",
            "--retry",
            "3",
            "--retry-all-errors",
            "--retry-delay",
            "2",
            "-A",
            "Mozilla/5.0 (compatible; Ruta3D/1.0; +https://filtrar-3d.locatellisanti.chatgpt.site)",
            "-H",
            "accept: application/json",
            "-L",
            "--silent",
            "--show-error",
            "-o",
            temporaryPath,
            url,
          ],
          { maxBuffer: 1024 * 128, timeout: FETCH_TIMEOUT_MS + 10_000 },
        );
        return JSON.parse(await readFile(temporaryPath, "utf8"));
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      } finally {
        await unlink(temporaryPath).catch(() => {});
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function scrape() {
  const products = [];
  const pages = [];

  for (let page = 1; ; page += 1) {
    const url = `${STORE.baseUrl}${STORE.apiPath}?per_page=${PER_PAGE}&page=${page}`;
    const apiProducts = await fetchJson(url);
    const pageProducts = apiProducts.map(toScrapedProduct).filter(Boolean);

    pages.push({ page, url, found: apiProducts.length, added: pageProducts.length });
    products.push(...pageProducts);

    if (apiProducts.length < PER_PAGE) break;
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

console.log(`Scraped ${result.count} Kimera 3D products into ${path.relative(process.cwd(), outputPath)}`);
for (const page of result.pages) {
  console.log(`- page ${page.page}: ${page.added}/${page.found} products from ${page.url}`);
}
