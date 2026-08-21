import erexitData from "@/data/erexit3d-products.json";
import refreshData from "@/data/catalog-refresh.json";
import kimeraData from "@/data/kimera3d-products.json";
import lefasocData from "@/data/lefasoc-products.json";
import laboratorioData from "@/data/laboratorio3d-products.json";
import proyectoColorData from "@/data/proyectocolor-products.json";
import tp3dData from "@/data/tp3d-products.json";
import { bestAvailablePrice, validTransferPrice } from "@/lib/pricing";
import sourceConfig from "@/store-sources.json";
import { detectFilamentColors, type FilamentColor } from "@/lib/filament-colors";

export type StockLabel = "En stock" | "Pocas unidades" | "Consultar";
export type SortDirection = "desc" | "asc";
export type FilamentWeightGroup = "0.25" | "0.5" | "1" | "over1";
export type PrinterFrameType = "Abierta" | "Cerrada" | "Multicolor";
export type StoreArea = "Córdoba" | "CABA" | "La Plata" | "Online";
export type PurchaseMode = "Preventa" | "Entrega inmediata";

export type StoreLocation = {
  area: StoreArea;
  address: string;
  lat?: number;
  lng?: number;
};

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
  storeLocations: StoreLocation[];
  storeLocationSummary: string;
  isOnlineOnly: boolean;
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
  printerFeatures: PrinterFrameType[];
  purchaseModes: PurchaseMode[];
  bestPriceMode?: PurchaseMode;
  preorderLabel?: string;
  saleNoticeLabel?: string;
  saleNoticeType?: "preorder" | "deposit";
};

export type StoreSource = {
  name: string;
  domain: string;
  url: string;
  status: "Pendiente" | "Mapeada" | "Conectada";
  locations: StoreLocation[];
  storeLocationSummary: string;
  isOnlineOnly: boolean;
};

type StoreSourceConfig = {
  name: string;
  domain: string;
  baseUrl: string;
};

const storeLocationsByName: Record<string, StoreLocation[]> = {
  "TP3D": [{ area: "Córdoba", address: "Rufino Cuervo 1085, X5000 Córdoba", lat: -31.438, lng: -64.165 }],
  "Erexit 3D": [{ area: "Online", address: "Tienda online" }],
  "Proyecto Color": [
    { area: "CABA", address: "Av. Gaona 1575, C1416DRD Cdad. Autónoma de Buenos Aires", lat: -34.614, lng: -58.459 },
    { area: "Córdoba", address: "Tristán Malbrán 3784, X5009ACO Córdoba", lat: -31.356, lng: -64.232 },
  ],
  "Kimera 3D": [{ area: "Online", address: "Tienda online" }],
  "Laboratorio 3D": [{ area: "La Plata", address: "Avenida 520, C. 13 Bis y, B1900 La Plata, Provincia de Buenos Aires", lat: -34.926, lng: -57.999 }],
  "Lefasoc": [
    { area: "CABA", address: "Virrey Cevallos 149, CABA", lat: -34.609, lng: -58.384 },
    { area: "CABA", address: "Godoy Cruz 2443, CABA", lat: -34.581, lng: -58.426 },
  ],
};

function storeLocationsFor(store: string) {
  return storeLocationsByName[store] ?? [{ area: "Online" as const, address: "Ubicación no informada" }];
}

function storeLocationSummaryFor(store: string) {
  const locations = storeLocationsFor(store);
  if (locations.every((location) => location.area === "Online")) return "Solo online";

  const physicalAreas = locations
    .filter((location) => location.area !== "Online")
    .map((location) => location.area);
  return `Retiro/local en ${physicalAreas.join(" y ")}`;
}

type ScrapedProduct = {
  id: string;
  name: string;
  category: string;
  store: string;
  price: number;
  previousPrice?: number | null;
  transferPrice: number | null;
  purchaseModes?: PurchaseMode[];
  stockLabel: string;
  brand: string | null;
  tags: string[];
  color?: string | null;
  variants?: Array<{
    available?: boolean;
    isDeposit?: boolean;
    price?: number;
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

type CatalogFreshness = {
  productCount: number;
  storeCount: number;
  refreshStatus: "ok" | "partial";
  refreshedAt: string | null;
  lastSuccessfulFullRefreshAt: string | null;
  staleStores: number;
  staleStoreNames: string[];
  oldestScrapedAt: string | null;
  newestScrapedAt: string | null;
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
  locations: storeLocationsFor(source.name),
  storeLocationSummary: storeLocationSummaryFor(source.name),
  isOnlineOnly: storeLocationsFor(source.name).every((location) => location.area === "Online"),
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
  "Grilon3",
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
  const isBambuX2dPrinter =
    /\b(bambu\s+(lab\s+)?x2d|bambulab\s+x2d|x2d)\b/i.test(text) &&
    /\b(impresora|printer|combo|ams|multicolor)\b/i.test(text) &&
    !/\b(hotend\s+con\s+boquilla|correa|repuesto|spare)\b/i.test(text);
  const hasPrinterSignal =
    product.category === "Impresoras" ||
    isBambuX2dPrinter ||
    text.includes("impresora") ||
    text.includes("printer") ||
    text.includes("bambu lab a1") ||
    text.includes("bambulab a1") ||
    text.includes("bambu lab p1") ||
    text.includes("bambulab p1") ||
    text.includes("bambu lab x1") ||
    text.includes("bambulab x1") ||
    text.includes("bambu lab x2") ||
    text.includes("bambulab x2") ||
    text.includes("adventurer") ||
    text.includes("creator 5") ||
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

  return hasPrinterSignal && !isResinPrinter && (isBambuX2dPrinter || !accessorySignal);
}

function detectPrinterFrameType(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags" | "bestPrice">,
): Exclude<PrinterFrameType, "Multicolor"> | undefined {
  const text = baseProductText(product);

  if (/\b(creality\s+hi|k2\s+se|spark\s*x\s*i7|bambu\s+(lab\s+)?a2l|bambu\s+(lab\s+)?a1|bambulab\s+a1|kobra\s+3\s+max)\b/i.test(text)) {
    return "Abierta";
  }

  if (/\b(k1c|creator\s+5(?:\s+pro)?|kobra\s+s1(?:\s+max)?|bambu\s+(lab\s+)?p2s|bambulab\s+p2s|bambu\s+(lab\s+)?x1c|bambulab\s+x1c|prusa\s+core\s+one|bambu\s+(lab\s+)?h2s|bambulab\s+h2s|bambu\s+(lab\s+)?x2d|bambulab\s+x2d|x2d)\b/i.test(text)) {
    return product.bestPrice >= 800_000 ? "Cerrada" : undefined;
  }

  if (/\b(cerrada|cerrado|enclosed|corexy|carbon|x1|p1s|k1|k2|adventurer|guider|creator|centauri)\b/i.test(text)) {
    return product.bestPrice >= 800_000 ? "Cerrada" : undefined;
  }

  if (/\b(abierta|abierto|bedslinger|ender|a1|neptune|sv0|sovol|mega|sidewinder)\b/i.test(text)) return "Abierta";

  return undefined;
}

function detectPrinterFeatures(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags" | "bestPrice">,
): PrinterFrameType[] {
  const frameType = detectPrinterFrameType(product);
  const text = baseProductText(product);
  const isMulticolor = /\b(multicolor|ams|ams\s+lite|ams\s*2|cfs|cfs\s*lite|ace\s+pro|ifs|combo)\b/i.test(text);

  return [frameType, isMulticolor ? "Multicolor" : undefined].filter(
    (feature): feature is PrinterFrameType => Boolean(feature),
  );
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
  if (store === "Lefasoc") return "#2d8c73";

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

function normalizePurchaseText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function purchaseModesFromText(value: string): PurchaseMode[] {
  const text = normalizePurchaseText(value);
  const modes = new Set<PurchaseMode>();

  if (/\bpre[\s-]?venta\b/.test(text) || /\bentrega\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.test(text)) {
    modes.add("Preventa");
  }
  if (/\bentrega\s+inmediata\b/.test(text)) modes.add("Entrega inmediata");

  return [...modes];
}

function variantLooksLikeDeposit(variant: NonNullable<ScrapedProduct["variants"]>[number]) {
  const text = normalizePurchaseText((variant.options ?? []).join(" "));

  return Boolean(variant.isDeposit) || /\b(sena|senal|reserva|reservar|anticipo|apartado|separar|deposito)\b/.test(text);
}

function lowestPricedVariant(product: ScrapedProduct) {
  const variants = product.variants ?? [];
  const availableVariants = variants.filter((variant) => variant.available !== false);
  const candidateVariants = availableVariants.length ? availableVariants : variants;
  const pricedVariants = candidateVariants
    .map((variant) => ({
      isDeposit: variantLooksLikeDeposit(variant),
      price: Number(variant.price),
    }))
    .filter((variant) => Number.isFinite(variant.price) && variant.price > 0)
    .sort((a, b) => a.price - b.price);

  return pricedVariants[0] ?? { isDeposit: false, price: product.price };
}

function preorderLabelFromText(value: string) {
  const text = normalizePurchaseText(value);
  const monthMatch = text.match(/\b(?:pre[\s-]?venta|entrega)\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/);

  if (monthMatch) {
    const month = monthMatch[1] === "setiembre" ? "septiembre" : monthMatch[1];
    return `Preventa ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  }

  return /\bpre[\s-]?venta\b/.test(text) ? "Preventa" : undefined;
}

function inferPurchaseModes(product: ScrapedProduct): PurchaseMode[] {
  const modes = new Set<PurchaseMode>(product.purchaseModes ?? []);
  for (const mode of purchaseModesFromText([product.name, product.url, ...product.tags].join(" "))) modes.add(mode);
  for (const variant of product.variants ?? []) {
    for (const mode of purchaseModesFromText((variant.options ?? []).join(" "))) modes.add(mode);
    if (variantLooksLikeDeposit(variant)) modes.add("Preventa");
  }

  if (!modes.size && product.stockLabel !== "Consultar") modes.add("Entrega inmediata");

  return [...modes];
}

function inferPreorderLabel(product: ScrapedProduct) {
  const candidates = [
    product.name,
    product.url,
    ...product.tags,
    ...(product.variants ?? []).flatMap((variant) => variant.options ?? []),
  ];

  return candidates.map(preorderLabelFromText).find(Boolean);
}

function bestPricePurchaseMode(product: ScrapedProduct, purchaseModes: PurchaseMode[]): PurchaseMode | undefined {
  const variants = product.variants ?? [];
  const pricedVariants = variants.filter((variant) =>
    variant.available !== false &&
    !variantLooksLikeDeposit(variant) &&
    Number.isFinite(variant.price) &&
    Number(variant.price) > 0,
  );
  const lowestVariant = pricedVariants.sort((a, b) => Number(a.price) - Number(b.price))[0];
  const variantModes = lowestVariant ? purchaseModesFromText((lowestVariant.options ?? []).join(" ")) : [];

  return variantModes[0] ?? (purchaseModes.length === 1 ? purchaseModes[0] : undefined);
}

function toProduct(product: ScrapedProduct, scrapedAt?: string): Product {
  const tags = product.tags.length ? product.tags : [product.brand ?? product.store];
  const category = normalizedCategory({ ...product, tags });
  const brand = inferBrand(product.name, tags, product.brand);
  const material = inferMaterial(product.name, tags);
  const listedVariant = lowestPricedVariant(product);
  const productPrice = listedVariant.price;
  const transferPrice = validTransferPrice(productPrice, product.transferPrice);
  const purchaseModes = inferPurchaseModes(product);
  const preorderLabel = inferPreorderLabel(product);
  const saleNoticeLabel = listedVariant.isDeposit ? "Seña / reserva" : preorderLabel;
  const saleNoticeType: Product["saleNoticeType"] = listedVariant.isDeposit ? "deposit" : preorderLabel ? "preorder" : undefined;
  const stock: StockLabel =
    product.stockLabel === "Pocas unidades" || product.stockLabel === "Consultar"
      ? product.stockLabel
      : "En stock";
  const baseProduct = {
    id: product.id,
    name: product.name,
    category,
    store: product.store,
    price: productPrice,
    previousPrice: product.previousPrice ?? undefined,
    transferPrice,
    stock,
    city: "Argentina",
    storeLocations: storeLocationsFor(product.store),
    storeLocationSummary: storeLocationSummaryFor(product.store),
    isOnlineOnly: storeLocationsFor(product.store).every((location) => location.area === "Online"),
    shipping: `Dato real de ${product.store}`,
    updated: formatScrapedAt(scrapedAt),
    tags,
    brand,
    color: storeColor(product.store),
    url: product.url,
    image: product.image,
    material,
    source: "scraper" as const,
    bestPrice: bestAvailablePrice(productPrice, transferPrice),
    purchaseModes,
    bestPriceMode: bestPricePurchaseMode(product, purchaseModes),
    preorderLabel,
    saleNoticeLabel,
    saleNoticeType,
    searchText: searchableText([product.name, product.category, product.brand, product.store, "Argentina", material, product.color, ...purchaseModes, ...tags]),
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
  const printerFeatures = isFdmPrinter ? detectPrinterFeatures(baseProduct) : [];
  const printerFrameType = printerFeatures.find(
    (feature): feature is Exclude<PrinterFrameType, "Multicolor"> => feature === "Abierta" || feature === "Cerrada",
  );

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
    printerFeatures,
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
  lefasocData,
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

export const catalogFreshness: CatalogFreshness = {
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
