import erexitData from "@/data/erexit3d-products.json";
import refreshData from "@/data/catalog-refresh.json";
import kimeraData from "@/data/kimera3d-products.json";
import laboratorioData from "@/data/laboratorio3d-products.json";
import proyectoColorData from "@/data/proyectocolor-products.json";
import tp3dData from "@/data/tp3d-products.json";
import { bestAvailablePrice, validTransferPrice } from "@/lib/pricing";
import sourceConfig from "@/store-sources.json";
import { detectFilamentColors, type FilamentColor } from "@/lib/filament-colors";

export type StockLabel = "En stock" | "Pocas unidades" | "Consultar";
export type SortDirection = "desc" | "asc";
export type FilamentWeightGroup = "0.25" | "0.5" | "1" | "over1";
export type PrinterFrameType = "Abierta" | "Cerrada";

export type Product = {
  id: string | number;
  name: string;
  category: string;
  store: string;
  price: number;
  previousPrice?: number;
  transferPrice?: number | null;
  stock: StockLabel;
  city: string;
  shipping: string;
  updated: string;
  tags: string[];
  brand?: string;
  color: string;
  material?: string;
  filamentColors: FilamentColor[];
  colorConfidence: "variantes" | "declarado" | "normalizado" | "sin_dato";
  filamentWeightGroup?: FilamentWeightGroup;
  url: string;
  image?: string | null;
  source: "scraper" | "demo";
  bestPrice: number;
  searchText: string;
  isFilament: boolean;
  isFdmPrinter: boolean;
  isResinPrinter: boolean;
  isResinCuring: boolean;
  isResinMaterial: boolean;
  printerFrameType?: PrinterFrameType;
};

type StoreSource = {
  name: string;
  domain: string;
  url: string;
  status: "Pendiente" | "Mapeada" | "Conectada";
};

type StoreSourceConfig = {
  name: string;
  domain: string;
  baseUrl: string;
};

type ScrapedProduct = {
  id: string;
  name: string;
  category: string;
  store: string;
  price: number;
  previousPrice?: number | null;
  transferPrice: number | null;
  stockLabel: string;
  brand: string | null;
  tags: string[];
  color?: string | null;
  variants?: Array<{
    available?: boolean;
    options?: string[];
  }>;
  image: string | null;
  url: string;
};

type ProductClassificationInput = {
  name: string;
  category: string;
  brand?: string | null;
  tags: string[];
};

type ScrapedCatalog = {
  scrapedAt?: string;
  products: ScrapedProduct[];
};

type CatalogRefreshStore = {
  store: string;
  status: "updated" | "stale";
  reason?: string;
  count: number;
  scrapedAt: string | null;
};

type CatalogRefreshManifest = {
  status?: "ok" | "partial";
  refreshedAt?: string | null;
  lastSuccessfulFullRefreshAt?: string | null;
  staleStores?: number;
  stores?: CatalogRefreshStore[];
};

export const categoryOptions = [
  "Todas",
  "Impresoras FDM",
  "Impresoras de Resina",
  "Curadoras",
  "Filamento",
  "Resina",
  "Accesorios",
  "Repuestos",
  "Herramientas",
];

export const storeSources: StoreSource[] = (sourceConfig as StoreSourceConfig[]).map((source) => ({
  name: source.name,
  domain: source.domain,
  url: source.baseUrl,
  status: "Conectada",
}));

export const connectedStoreSources = storeSources.filter((source) => source.status === "Conectada");
export const stores = ["Todas", ...connectedStoreSources.map((source) => source.name)];
export const connectedStores = connectedStoreSources.length;

const filamentBrandNames = [
  "Bambu Lab",
  "Flashforge",
  "Printalot",
  "Anycubic",
  "Artillery",
  "Creality",
  "Filanova",
  "Filalab",
  "Fremover",
  "Elegoo",
  "GST3D",
  "GST",
  "Hellbot",
  "Toolbox",
  "Filar",
  "Elemental",
];

export const unknownBrand = "Sin marca";
export const unknownMaterial = "Sin material";
export const penFilamentMaterial = "Lápiz 3D";
export const materialLabels = [
  "PLA",
  "PLA Silk",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "FLEX",
  "NYLON",
  "PC",
  "PVC",
  "PVA",
  "PEBA",
  "PA6-GF",
  "PPA-CF",
  penFilamentMaterial,
];
const excludedFilamentBrands = new Set([
  "algolaser",
  "anycubic",
  "biqu",
  "crealty",
  "global",
  "prusa",
  "xtool",
]);

export const materialSearchAliases = new Map([
  ["pla", "PLA"],
  ["silk", "PLA Silk"],
  ["slik", "PLA Silk"],
  ["petg", "PETG"],
  ["abs", "ABS"],
  ["asa", "ASA"],
  ["tpu", "TPU"],
  ["flex", "FLEX"],
  ["nylon", "NYLON"],
  ["pc", "PC"],
  ["pvc", "PVC"],
  ["pva", "PVA"],
  ["peba", "PEBA"],
  ["pa6", "PA6-GF"],
  ["ppa", "PPA-CF"],
  ["lapiz", penFilamentMaterial],
  ["lápiz", penFilamentMaterial],
]);

const searchTermAliases = new Map([
  ["boquilla", ["boquilla", "nozzle"]],
  ["boquillas", ["boquilla", "boquillas", "nozzle", "nozzles"]],
  ["cama", ["cama", "cama magnetica", "cama caliente", "base pei", "pei"]],
  ["estandar", ["estandar", "standard"]],
  ["nozzle", ["nozzle", "boquilla"]],
  ["nozzles", ["nozzle", "nozzles", "boquilla", "boquillas"]],
  ["standard", ["standard", "estandar"]],
]);

const filamentQueryTerms = new Set(["filamento", "filamentos"]);
const filamentMaterialTerms = new Set([
  ...materialLabels.map((material) => material.toLowerCase()),
  "silk",
  "slik",
  "peba",
  "pa6",
  "ppa",
  "pvc",
]);
const filamentProductPhrases = ["filamento", "filamentos", "ecofila", "rollo", "bobina", "recarga"];
const nonFilamentProductWords = [
  "sensor",
  "resina",
  "impresora",
  "secador",
  "secado",
  "cable",
  "cortador",
  "corte",
  "base",
  "soporte",
  "repuesto",
  "boquilla",
  "nozzle",
  "hotend",
  "termistor",
  "correa",
  "coller",
  "final de carrera",
  "extrusor",
  "ams",
  "cfs",
  "ace pro",
  "multicolor",
  "buffer",
  "búfer",
  "puffer",
  "embudo",
  "portabobinas",
  "modulo laser",
  "módulo laser",
  "módulo láser",
  "laser upgrade",
  "láser upgrade",
  "scanner",
  "escaner",
  "escáner",
];

export function searchableText(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function searchableTokens(text: string): string[] {
  return text.match(/[a-z0-9.]+/g) ?? [];
}

function inferBrand(name: string, tags: string[], brand?: string | null) {
  const text = searchableText([name, brand, ...tags]);
  if (text.includes("filamento mix pla small")) return "GST3D";
  if (text.includes("elemental")) return "Elemental";
  if (/\bams\b/i.test(text) || text.includes("bambulab")) return "Bambu Lab";
  if (/\bcfs\b/i.test(text)) return "Creality";
  if (/\bace pro\b/i.test(text)) return "Anycubic";
  const matchedBrand = filamentBrandNames.find((item) => text.includes(item.toLowerCase()));

  if (matchedBrand === "GST") return "GST3D";

  return matchedBrand ?? brand ?? unknownBrand;
}

function inferMaterial(name: string, tags: string[]) {
  const text = searchableText([name, ...tags]);
  const tokens = searchableTokens(text);
  const isPenFilament = (
    (text.includes("lapiz 3d") || text.includes("lápiz 3d")) &&
    (text.includes("filamento") || text.includes("ecofila") || text.includes("small pack") || text.includes("mix pla") || text.includes("mix pcl"))
  ) || (
    text.includes("gst3d") &&
    /\b(x?\s*5\s*metros|metros\s*x\s*10|x10\s*unidades|colores surtidos)\b/i.test(text)
  );
  if (isPenFilament) return penFilamentMaterial;
  if (text.includes("gst3d") && /\bsli?k\b/i.test(text)) return "PLA Silk";
  if (/\b(pla[\s-]*)?(dual[\s-]*)?(tri[\s-]*)?sli?k\b/i.test(text)) return "PLA Silk";
  if (/\bpeba\b/i.test(text)) return "PEBA";
  if (/\bpa6[\s-]*gf\b/i.test(text)) return "PA6-GF";
  if (/\bppa[\s-]*cf\b/i.test(text)) return "PPA-CF";

  return materialLabels.find((material) => tokens.includes(material.toLowerCase())) ?? unknownMaterial;
}

function filamentWeightGroup(weightKg: number): FilamentWeightGroup | undefined {
  if (weightKg > 0.2 && weightKg <= 0.3) return "0.25";
  if (weightKg > 0.3 && weightKg <= 0.6) return "0.5";
  if (weightKg > 0.6 && weightKg <= 1.1) return "1";
  if (weightKg > 1.1) return "over1";

  return undefined;
}

function inferFilamentWeightGroup(values: Array<string | undefined | null>) {
  const text = searchableText(values).replace(/,/g, ".");
  const detectedWeights: number[] = [];

  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|kilogramo|kilogramos|k)\b/g)) {
    const value = Number(match[1]);
    if (value > 0 && value < 20) detectedWeights.push(value);
  }

  for (const match of text.matchAll(/\b(\d{2,4})\s*(g|gr|gramo|gramos)\b/g)) {
    const value = Number(match[1]);
    if (value >= 100 && value < 10_000) detectedWeights.push(value / 1000);
  }

  const largestWeight = Math.max(...detectedWeights);

  return Number.isFinite(largestWeight) ? filamentWeightGroup(largestWeight) : undefined;
}

function baseProductText(product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">) {
  return searchableText([
    product.name,
    product.category,
    product.brand,
    product.material,
    ...product.tags,
  ]);
}

function detectFilamentProduct(product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">) {
  const text = searchableText([product.name, product.category, product.brand, product.material, ...product.tags]);
  const tokens = searchableTokens(text);
  const isPenFilament = (
    (text.includes("lapiz 3d") || text.includes("lápiz 3d")) &&
    (text.includes("filamento") || text.includes("ecofila") || text.includes("small pack") || text.includes("mix pla") || text.includes("mix pcl"))
  ) || (
    text.includes("gst3d") &&
    /\b(x?\s*5\s*metros|metros\s*x\s*10|x10\s*unidades|colores surtidos)\b/i.test(text)
  );
  const hasMaterialSignal = tokens.some((token) => filamentMaterialTerms.has(token));
  const hasFilamentSignal =
    isPenFilament || hasMaterialSignal || filamentProductPhrases.some((word) => text.includes(word));
  const hasAccessorySignal = nonFilamentProductWords.some((word) => text.includes(word));

  return hasFilamentSignal && (isPenFilament || !hasAccessorySignal);
}

function detectSparePart(product: ProductClassificationInput) {
  const text = searchableText([product.name, product.brand, ...product.tags]);
  const isPrinterOrBundle = /\b(impresora|printer)\b/i.test(text) || /\bcombo\b/i.test(text);
  const isBambuLaserModule = text.includes("bambu lab") && /\b(modulo laser|módulo laser|laser upgrade)\b/i.test(text);
  const hasSparePartSignal = isBambuLaserModule || /\b(boquilla|nozzle|hotend|heatbreak|termistor|resistencia|extrusor|extruder|engranaje|cable|correa|motor|sensor|sonda|endstop|placa|mainboard|driver|ventilador|fan|rodamiento|polea|fuente|display|pantalla|touchscreen|ptfe|teflon|fep|lcd|cama magnetica|pei|superficie de repuesto|calefactor|heater|funda de silicona|disipador|bloque de hotend|barrel|tubo de teflon|acople conector|limpiador de boquillas|buffer de filamento|búfer de filamento|filament buffer|modulo de bombeo|módulo de bombeo|bomba de resina|tanque de resina|vat de resina|film fep|release film|plataforma de curado)\b/i.test(text);

  return !isPrinterOrBundle && hasSparePartSignal;
}

function detectAccessory(product: ProductClassificationInput) {
  const text = searchableText([product.name, product.category, product.brand, ...product.tags]);
  const isPrinterListing = /\b(impresora|printer)\b/i.test(text);

  return !isPrinterListing && /\b(camara|cámara|camaras|cámaras|ams|cfs|ace pro|multicolor|puffer|embudo|portabobinas|asa superior|modulo laser|módulo laser|laser upgrade|secador|secadora|space pi|scanner|escaner|escáner|cr scan|ferret|otter|raptor|enclosure|cerramiento)\b/i.test(text);
}

function normalizedCategory(product: Pick<ScrapedProduct, "name" | "category" | "brand" | "tags">) {
  const text = searchableText([product.name, product.category, product.brand, ...product.tags]);
  if (detectSparePart(product)) return "Repuestos";
  if (/\b(resina|lavable al agua|mercury|mercuy|lavado|curado|wash|cure)\b/i.test(text)) return "Resina";
  if (detectAccessory(product)) return "Accesorios";

  return product.category;
}

function isApprovedFilamentProduct(product: Pick<Product, "name" | "brand">) {
  const brand = product.brand?.toLowerCase();

  if (brand === unknownBrand.toLowerCase()) return false;
  if (brand && excludedFilamentBrands.has(brand)) return false;
  if (brand === "creality") return /creality\s+cr-silk\s+1\.0kg/i.test(product.name);

  return true;
}

function detectResinPrinter(product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">) {
  const text = baseProductText(product);
  const hasCuringSignal = /\b(lavado|curado|curadora|wash|cure|mercury|mercuy)\b/i.test(text);
  const hasAccessorySignal = /\b(accesorio|repuesto|modulo|módulo|bombeo|plataforma|tanque|vat|film|fep|pantalla|lcd screen|camara|cámara|tapa|cover)\b/i.test(text);
  const hasPrinterSignal =
    text.includes("impresora") ||
    text.includes("printer") ||
    text.includes("halot") ||
    text.includes("photon") ||
    text.includes("saturn") ||
    text.includes("mars");
  const hasResinSignal =
    text.includes("resina") ||
    text.includes("msla") ||
    text.includes("dlp") ||
    text.includes("lcd") ||
    text.includes("halot") ||
    text.includes("photon") ||
    text.includes("saturn") ||
    text.includes("mars");

  return !hasCuringSignal && !hasAccessorySignal && hasPrinterSignal && hasResinSignal;
}

function detectFdmPrinter(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">,
  isResinPrinter: boolean,
) {
  const text = baseProductText(product);
  const hasPrinterSignal =
    product.category === "Impresoras" ||
    text.includes("impresora") ||
    text.includes("printer") ||
    text.includes("bambu lab a1") ||
    text.includes("bambulab a1") ||
    text.includes("bambu lab p1") ||
    text.includes("bambulab p1") ||
    text.includes("bambu lab x1") ||
    text.includes("bambulab x1") ||
    text.includes("adventurer") ||
    text.includes("centauri carbon") ||
    text.includes("prusa core") ||
    text.includes("snapmaker");
  const accessorySignal =
    product.category === "Repuestos" ||
    product.category === "Accesorios" ||
    text.includes("camara") ||
    text.includes("cámara") ||
    text.includes("cable") ||
    text.includes("kit cerramiento") ||
    text.includes("hub ams") ||
    text.includes("cama ") ||
    text.includes("placa") ||
    text.includes("nozzle") ||
    text.includes("boquilla") ||
    text.includes("hotend") ||
    text.includes("scanner") ||
    text.includes("escaner") ||
    text.includes("escáner") ||
    text.includes("cr scan") ||
    text.includes("ferret") ||
    text.includes("otter") ||
    text.includes("raptor") ||
    text.includes("enclosure") ||
    text.includes("cerramiento") ||
    text.includes("modulo laser") ||
    text.includes("módulo laser");

  return hasPrinterSignal && !isResinPrinter && !accessorySignal;
}

function detectPrinterFrameType(product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">): PrinterFrameType | undefined {
  const text = baseProductText(product);

  if (/\b(cerrada|cerrado|enclosed|corexy|carbon|x1|p1s|k1|k2|adventurer|guider|creator|centauri)\b/i.test(text)) return "Cerrada";
  if (/\b(abierta|abierto|bedslinger|ender|a1|neptune|sv0|sovol|mega|sidewinder)\b/i.test(text)) return "Abierta";

  return undefined;
}

function detectResinCuring(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">,
  isResinPrinter: boolean,
) {
  const text = baseProductText(product);

  return (
    !isResinPrinter &&
    product.category === "Resina" &&
    /\b(lavado|curado|curadora|wash|cure|mercury|mercuy)\b/i.test(text)
  );
}

function detectResinMaterial(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">,
  isResinPrinter: boolean,
  isResinCuring: boolean,
) {
  return (
    !isResinPrinter &&
    !isResinCuring &&
    product.category === "Resina"
  );
}

function storeColor(store: string) {
  if (store === "Laboratorio 3D") return "#315f95";
  if (store === "TP3D") return "#4f8f82";
  if (store === "Proyecto Color") return "#bf6b42";
  if (store === "Kimera 3D") return "#5874a8";

  return "#8f5aa6";
}

function formatScrapedAt(scrapedAt?: string) {
  if (!scrapedAt) return "Actualizado por scraper";

  const date = new Date(scrapedAt);
  if (Number.isNaN(date.getTime())) return "Actualizado por scraper";

  return `Actualizado ${date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function toProduct(product: ScrapedProduct, scrapedAt?: string): Product {
  const tags = product.tags.length ? product.tags : [product.brand ?? product.store];
  const category = normalizedCategory({ ...product, tags });
  const brand = inferBrand(product.name, tags, product.brand);
  const material = inferMaterial(product.name, tags);
  const transferPrice = validTransferPrice(product.price, product.transferPrice);
  const stock: StockLabel =
    product.stockLabel === "Pocas unidades" || product.stockLabel === "Consultar"
      ? product.stockLabel
      : "En stock";
  const baseProduct = {
    id: product.id,
    name: product.name,
    category,
    store: product.store,
    price: product.price,
    previousPrice: product.previousPrice ?? undefined,
    transferPrice,
    stock,
    city: "Argentina",
    shipping: `Dato real de ${product.store}`,
    updated: formatScrapedAt(scrapedAt),
    tags,
    brand,
    color: storeColor(product.store),
    url: product.url,
    image: product.image,
    material,
    source: "scraper" as const,
    bestPrice: bestAvailablePrice(product.price, transferPrice),
    searchText: searchableText([product.name, product.category, product.brand, product.store, "Argentina", material, product.color, ...tags]),
  };
  const isSparePart = detectSparePart(baseProduct);
  const isFilament = !isSparePart && detectFilamentProduct(baseProduct) && isApprovedFilamentProduct(baseProduct);
  const availableVariantColors = (product.variants ?? [])
    .filter((variant) => variant.available !== false)
    .flatMap((variant) => variant.options ?? []);
  const variantColors = isFilament
    ? detectFilamentColors(searchableText(availableVariantColors)).map((match) => match.color)
    : [];
  const detectedColors = isFilament
    ? detectFilamentColors(searchableText([product.name, product.color, product.url, ...tags]))
    : [];
  const filamentColors = [...new Set([...variantColors, ...detectedColors.map((match) => match.color)])];
  const filamentWeightGroup = isFilament
    ? inferFilamentWeightGroup([product.name, product.url, product.color, ...tags, ...availableVariantColors])
    : undefined;
  const isResinPrinter = detectResinPrinter(baseProduct);
  const isFdmPrinter = detectFdmPrinter(baseProduct, isResinPrinter);
  const isResinCuring = detectResinCuring(baseProduct, isResinPrinter);
  const isResinMaterial = detectResinMaterial(baseProduct, isResinPrinter, isResinCuring);
  const printerFrameType = isFdmPrinter ? detectPrinterFrameType(baseProduct) : undefined;

  return {
    ...baseProduct,
    filamentColors,
    colorConfidence: variantColors.length
      ? "variantes"
      : detectedColors[0]?.confidence ?? "sin_dato",
    filamentWeightGroup,
    isFilament,
    isFdmPrinter,
    isResinPrinter,
    isResinCuring,
    isResinMaterial,
    printerFrameType,
  };
}

export function productMatchesCategory(product: Product, category: string) {
  if (category === "Todas") return true;
  if (category === "Impresoras FDM") return product.isFdmPrinter;
  if (category === "Impresoras de Resina") return product.isResinPrinter;
  if (category === "Curadoras") return product.isResinCuring;
  if (category === "Filamento") return product.isFilament && !product.isFdmPrinter && !product.isResinPrinter;
  if (category === "Resina") return product.isResinMaterial;

  return product.category === category;
}

export function queryTermMatches(term: string, product: Product) {
  if (filamentQueryTerms.has(term)) return product.isFilament;
  if (term === "lapiz" || term === "lápiz") return product.isFilament && product.material === penFilamentMaterial;
  if (filamentMaterialTerms.has(term)) {
    const searchedMaterial = materialSearchAliases.get(term) ?? term.toUpperCase();
    if (searchedMaterial === "PLA") return product.isFilament && product.material?.startsWith("PLA");

    return product.isFilament && product.material === searchedMaterial;
  }
  if (term === "cama") {
    const tokens = searchableTokens(product.searchText);

    return tokens.includes("cama") ||
      product.searchText.includes("cama magnetica") ||
      product.searchText.includes("cama caliente") ||
      product.searchText.includes("base pei") ||
      tokens.includes("pei");
  }

  return (searchTermAliases.get(term) ?? [term]).some((alias) => product.searchText.includes(alias));
}

export function normalizeQuery(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

const scrapedCatalogs = [
  erexitData,
  laboratorioData,
  tp3dData,
  proyectoColorData,
  kimeraData,
] as ScrapedCatalog[];

const scrapedDates = scrapedCatalogs
  .map((catalog) => catalog.scrapedAt ? new Date(catalog.scrapedAt) : null)
  .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()));
const refreshManifest = refreshData as CatalogRefreshManifest;
const staleStoreNames = (refreshManifest.stores ?? [])
  .filter((store) => store.status === "stale")
  .map((store) => store.store);

const products = scrapedCatalogs.flatMap((catalog) =>
  catalog.products.map((product) => toProduct(product, catalog.scrapedAt)),
);

export const catalogProducts = products;

export const catalogFreshness = {
  productCount: products.length,
  storeCount: connectedStoreSources.length,
  refreshStatus: refreshManifest.status === "partial" ? "partial" : "ok",
  refreshedAt: refreshManifest.refreshedAt ?? null,
  lastSuccessfulFullRefreshAt: refreshManifest.lastSuccessfulFullRefreshAt ?? null,
  staleStores: refreshManifest.staleStores ?? staleStoreNames.length,
  staleStoreNames,
  oldestScrapedAt: scrapedDates.length
    ? new Date(Math.min(...scrapedDates.map((date) => date.getTime()))).toISOString()
    : null,
  newestScrapedAt: scrapedDates.length
    ? new Date(Math.max(...scrapedDates.map((date) => date.getTime()))).toISOString()
    : null,
};

const catalogFacets = products.reduce(
  (facets, product) => {
    if (product.isFilament) {
      const brand = product.brand ?? unknownBrand;
      if (!excludedFilamentBrands.has(brand.toLowerCase())) {
        facets.brands.add(brand);
        facets.brandCounts[brand] = (facets.brandCounts[brand] ?? 0) + 1;
      }

      const material = product.material ?? unknownMaterial;
      if (material !== unknownMaterial) {
        facets.materials.add(material);
        facets.materialCounts[material] = (facets.materialCounts[material] ?? 0) + 1;
      }
    }

    return facets;
  },
  {
    brandCounts: {} as Record<string, number>,
    brands: new Set<string>(),
    materialCounts: {} as Record<string, number>,
    materials: new Set<string>(),
  },
);

export const filamentBrands = [...catalogFacets.brands].sort((a, b) => {
  if (a === unknownBrand) return 1;
  if (b === unknownBrand) return -1;

  return a.localeCompare(b, "es");
});

export const filamentBrandCounts = catalogFacets.brandCounts;

export const filamentMaterials = [...catalogFacets.materials].sort((a, b) => {
  if (a === unknownMaterial) return 1;
  if (b === unknownMaterial) return -1;

  return materialLabels.indexOf(a) - materialLabels.indexOf(b);
});

export const filamentMaterialCounts = catalogFacets.materialCounts;
