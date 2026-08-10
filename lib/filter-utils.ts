import { penFilamentMaterial, type Product } from "./catalog";

export const unknownBrand = "Sin marca";
export const unknownMaterial = "Sin material";

function normalizeSearchText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const materialSearchAliases = new Map([
  ["pla", "PLA"],
  ["petg", "PETG"],
  ["abs", "ABS"],
  ["asa", "ASA"],
  ["tpu", "TPU"],
  ["flex", "FLEX"],
  ["nylon", "NYLON"],
  ["pc", "PC"],
  ["pva", "PVA"],
  ["lapiz", penFilamentMaterial],
  ["lápiz", penFilamentMaterial],
]);

const searchTermAliases = new Map([
  ["boquilla", ["boquilla", "nozzle"]],
  ["boquillas", ["boquilla", "boquillas", "nozzle", "nozzles"]],
  ["cama", ["cama", "cama magnetica", "cama caliente", "base pei", "pei"]],
  ["nozzle", ["nozzle", "boquilla"]],
  ["nozzles", ["nozzle", "nozzles", "boquilla", "boquillas"]],
]);

const filamentQueryTerms = new Set(["filamento", "filamentos"]);
const filamentMaterialTerms = new Set(["pla", "petg", "abs", "asa", "tpu", "flex", "nylon", "pc", "pva", "lapiz", "lápiz"]);

export function searchableTokens(text: string): string[] {
  return normalizeSearchText(text).match(/[a-z0-9.]+/g) ?? [];
}

export function searchedMaterials(query: string) {
  return [...new Set(
    searchableTokens(query.toLowerCase())
      .map((term) => materialSearchAliases.get(term))
      .filter((material): material is string => Boolean(material)),
  )];
}

export function queryContainsMaterial(query: string) {
  return searchableTokens(query.toLowerCase()).some((term) => materialSearchAliases.has(term));
}

export function normalizeQuery(query: string) {
  return searchableTokens(query);
}

export function productMatchesCategory(product: Product, category: string) {
  if (category === "Todas") return true;
  if (category === "Impresoras FDM") return product.isFdmPrinter;
  if (category === "Impresoras de Resina") return product.isResinPrinter;
  if (category === "Filamento") return product.isFilament && !product.isFdmPrinter && !product.isResinPrinter;
  if (category === "Resina") return product.isResinMaterial || (product.category === "Resina" && !product.isResinPrinter);

  return product.category === category;
}

export function queryTermMatches(term: string, product: Product) {
  if (filamentQueryTerms.has(term)) return product.isFilament;
  if (term === "lapiz" || term === "lápiz") return product.isFilament && product.material === penFilamentMaterial;
  if (filamentMaterialTerms.has(term)) return product.isFilament && product.material?.toLowerCase() === term;

  const productSearchText = normalizeSearchText(product.searchText);
  if (term === "cama") {
    const tokens = searchableTokens(productSearchText);

    return tokens.includes("cama") ||
      productSearchText.includes("cama magnetica") ||
      productSearchText.includes("cama caliente") ||
      productSearchText.includes("base pei") ||
      tokens.includes("pei");
  }

  return (searchTermAliases.get(term) ?? [term]).some((alias) => productSearchText.includes(alias));
}
