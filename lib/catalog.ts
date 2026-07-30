import erexitData from "@/data/erexit3d-products.json";
import kimeraData from "@/data/kimera3d-products.json";
import laboratorioData from "@/data/laboratorio3d-products.json";
import proyectoColorData from "@/data/proyectocolor-products.json";
import tp3dData from "@/data/tp3d-products.json";
import { bestAvailablePrice, validTransferPrice } from "@/lib/pricing";
import sourceConfig from "@/store-sources.json";

export type StockLabel = "En stock" | "Pocas unidades" | "Consultar";
export type SortDirection = "desc" | "asc";

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
  url: string;
  image?: string | null;
  source: "scraper" | "demo";
  bestPrice: number;
  searchText: string;
  isFilament: boolean;
  isFdmPrinter: boolean;
  isResinPrinter: boolean;
  isResinMaterial: boolean;
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
  image: string | null;
  url: string;
};

type ScrapedCatalog = {
  scrapedAt?: string;
  products: ScrapedProduct[];
};

export const categoryOptions = [
  "Todas",
  "Impresoras FDM",
  "Impresoras de Resina",
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
];

export const unknownBrand = "Sin marca";
export const unknownMaterial = "Sin material";
export const materialLabels = ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "NYLON", "PC", "PVA"];

export const materialSearchAliases = new Map([
  ["pla", "PLA"],
  ["petg", "PETG"],
  ["abs", "ABS"],
  ["asa", "ASA"],
  ["tpu", "TPU"],
  ["flex", "FLEX"],
  ["nylon", "NYLON"],
  ["pc", "PC"],
  ["pva", "PVA"],
]);

const searchTermAliases = new Map([
  ["boquilla", ["boquilla", "nozzle"]],
  ["boquillas", ["boquilla", "boquillas", "nozzle", "nozzles"]],
  ["nozzle", ["nozzle", "boquilla"]],
  ["nozzles", ["nozzle", "nozzles", "boquilla", "boquillas"]],
]);

const filamentQueryTerms = new Set(["filamento", "filamentos"]);
const filamentMaterialTerms = new Set(materialLabels.map((material) => material.toLowerCase()));
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
];

export function searchableText(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function searchableTokens(text: string): string[] {
  return text.match(/[a-z0-9.]+/g) ?? [];
}

function inferBrand(name: string, tags: string[], brand?: string | null) {
  const text = searchableText([name, brand, ...tags]);
  const matchedBrand = filamentBrandNames.find((item) => text.includes(item.toLowerCase()));

  if (matchedBrand === "GST") return "GST3D";

  return matchedBrand ?? brand ?? unknownBrand;
}

function inferMaterial(name: string, tags: string[]) {
  const text = searchableText([name, ...tags]);
  const tokens = searchableTokens(text);

  return materialLabels.find((material) => tokens.includes(material.toLowerCase())) ?? unknownMaterial;
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

function detectFilamentProduct(product: Pick<Product, "name" | "brand" | "material" | "tags">) {
  const text = searchableText([product.name, product.brand, product.material, ...product.tags]);
  const tokens = searchableTokens(text);
  const hasMaterialSignal = tokens.some((token) => filamentMaterialTerms.has(token));
  const hasFilamentSignal =
    hasMaterialSignal || filamentProductPhrases.some((word) => text.includes(word));
  const hasAccessorySignal = nonFilamentProductWords.some((word) => text.includes(word));

  return hasFilamentSignal && !hasAccessorySignal;
}

function detectResinPrinter(product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">) {
  const text = baseProductText(product);
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

  return hasPrinterSignal && hasResinSignal;
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
    text.includes("scanner");

  return hasPrinterSignal && !isResinPrinter && !accessorySignal;
}

function detectResinMaterial(
  product: Pick<Product, "name" | "category" | "brand" | "material" | "tags">,
  isResinPrinter: boolean,
) {
  const text = baseProductText(product);
  const tokens = searchableTokens(text);
  const isWashOrCure =
    text.includes("lavado") ||
    text.includes("curado") ||
    text.includes("wash") ||
    text.includes("cure") ||
    text.includes("maquina") ||
    text.includes("máquina");
  const hasFilamentMaterial = tokens.some((token) => filamentMaterialTerms.has(token));

  return (
    !isResinPrinter &&
    product.category === "Resina" &&
    !isWashOrCure &&
    !hasFilamentMaterial
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
    category: product.category,
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
    searchText: searchableText([product.name, product.store, "Argentina", material, ...tags]),
  };
  const isFilament = detectFilamentProduct(baseProduct);
  const isResinPrinter = detectResinPrinter(baseProduct);
  const isFdmPrinter = detectFdmPrinter(baseProduct, isResinPrinter);

  return {
    ...baseProduct,
    isFilament,
    isFdmPrinter,
    isResinPrinter,
    isResinMaterial: detectResinMaterial(baseProduct, isResinPrinter),
  };
}

export function productMatchesCategory(product: Product, category: string) {
  if (category === "Todas") return true;
  if (category === "Impresoras FDM") return product.isFdmPrinter;
  if (category === "Impresoras de Resina") return product.isResinPrinter;
  if (category === "Filamento") return product.isFilament && !product.isFdmPrinter && !product.isResinPrinter;
  if (category === "Resina") return product.isResinMaterial;

  return product.category === category;
}

export function queryTermMatches(term: string, product: Product) {
  if (filamentQueryTerms.has(term)) return product.isFilament;
  if (filamentMaterialTerms.has(term)) return product.material?.toLowerCase() === term;

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

const products = scrapedCatalogs.flatMap((catalog) =>
  catalog.products.map((product) => toProduct(product, catalog.scrapedAt)),
);

export const catalogProducts = products;

const catalogFacets = products.reduce(
  (facets, product) => {
    const brand = product.brand ?? unknownBrand;
    facets.brands.add(brand);
    facets.brandCounts[brand] = (facets.brandCounts[brand] ?? 0) + 1;

    if (product.isFilament) {
      const material = product.material ?? unknownMaterial;
      facets.materials.add(material);
      facets.materialCounts[material] = (facets.materialCounts[material] ?? 0) + 1;
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
