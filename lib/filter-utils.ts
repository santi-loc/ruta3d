import { penFilamentMaterial, type Product } from "./catalog";
import type { FilamentColor } from "./filament-colors";

export const unknownBrand = "Sin marca";
export const unknownMaterial = "Sin material";

function normalizeSearchText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const materialSearchAliases = new Map([
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
const filamentMaterialTerms = new Set(["pla", "silk", "slik", "petg", "abs", "asa", "tpu", "flex", "nylon", "pc", "pvc", "pva", "peba", "pa6", "ppa", "lapiz", "lápiz"]);
const filamentColorSearchAliases: Array<[FilamentColor, string[]]> = [
  ["Negro", ["negro", "black", "onyx", "carbon", "midnight"]],
  ["Blanco", ["blanco", "white", "ivory", "marfil"]],
  ["Gris", ["gris", "gray", "grey", "silver", "plata"]],
  ["Rojo", ["rojo", "red", "crimson", "scarlet"]],
  ["Naranja", ["naranja", "orange", "coral"]],
  ["Amarillo", ["amarillo", "yellow"]],
  ["Verde", ["verde", "green", "lime", "olive", "oliva"]],
  ["Azul", ["azul", "blue", "sky", "ocean", "cielo"]],
  ["Violeta", ["violeta", "violet", "purple", "purpura", "púrpura", "lila", "lavanda", "lavender", "morado", "mauve", "uva"]],
  ["Rosa", ["rosa", "pink", "magenta", "fucsia", "fuchsia", "rose", "salmon", "salmón"]],
  ["Dorado", ["dorado", "gold", "golden", "oro", "champagne", "metal gold"]],
  ["Natural", ["natural"]],
];
const filamentColorSearchTerms = new Map(
  filamentColorSearchAliases.flatMap(([color, aliases]) => aliases.map((alias) => [alias, color] as const)),
);

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

  const productSearchText = normalizeSearchText(product.searchText);
  const searchedColor = filamentColorSearchTerms.get(term);
  if (searchedColor && product.isFilament) {
    return product.filamentColors.includes(searchedColor) ||
      (searchTermAliases.get(term) ?? [term]).some((alias) => productSearchText.includes(alias));
  }

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
