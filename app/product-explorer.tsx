"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FilamentWeightGroup, Product, StoreArea } from "@/lib/catalog";
import { outboundProductUrl, outboundStoreUrl } from "@/lib/outbound-links";
import { parseSafePositiveInteger } from "@/lib/security";
import { Ruta3DMark } from "./ruta-3d-mark";
import {
  filamentWeightOptions,
  printerFrameOptions,
  resinTypeOptions,
  useProductFilters,
} from "./use-product-filters";

type ProductExplorerProps = {
  products: Product[];
  filamentBrands: string[];
  filamentMaterials: string[];
  storeLinks: { name: string; url: string }[];
  stores: string[];
  catalogFreshness: {
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
  initialQuery?: string;
};

const price = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat("es-AR");
const unknownBrandLabel = "Sin marca";
type PhysicalStoreArea = Exclude<StoreArea, "Online">;
type PhysicalStoreLocation = Product["storeLocations"][number] & { area: PhysicalStoreArea };
const storeAreaReferencePostalCodes: Record<PhysicalStoreArea, number> = {
  "CABA": 1416,
  "La Plata": 1900,
  "Córdoba": 5000,
};
const argentinaMapBounds = {
  maxLat: -21,
  maxLng: -53,
  minLat: -55,
  minLng: -74,
};
const storeAreaCoordinates: Record<PhysicalStoreArea, { lat: number; lng: number }> = {
  "CABA": { lat: -34.6037, lng: -58.3816 },
  "La Plata": { lat: -34.9205, lng: -57.9536 },
  "Córdoba": { lat: -31.4201, lng: -64.1888 },
};

function isPhysicalStoreLocation(location: Product["storeLocations"][number]): location is PhysicalStoreLocation {
  return location.area !== "Online";
}

function projectArgentinaPoint(location: PhysicalStoreLocation) {
  const coordinates = location.lat !== undefined && location.lng !== undefined
    ? { lat: location.lat, lng: location.lng }
    : storeAreaCoordinates[location.area];

  return {
    x: ((coordinates.lng - argentinaMapBounds.minLng) / (argentinaMapBounds.maxLng - argentinaMapBounds.minLng)) * 100,
    y: ((argentinaMapBounds.maxLat - coordinates.lat) / (argentinaMapBounds.maxLat - argentinaMapBounds.minLat)) * 120,
  };
}

const fdmBrands = ["Bambu Lab", "Creality", "Elegoo", "Flashforge", "Snapmaker", "Anycubic", "Artillery", "Hellbot"];
const printerAccessoryBrands = ["Bambu Lab", "Creality", "Elegoo", "Flashforge", "Anycubic", "Prusa", "Artillery", "Snapmaker"];
const sparePartGroups = [
  {
    label: "Hotend y extrusión",
    parts: [["Boquillas", "boquilla"], ["Hotends", "hotend"], ["Extrusores", "extrusor"]],
  },
  {
    label: "Movimiento y cama",
    parts: [["Camas de impresión", "cama"], ["Motores", "motor"], ["Correas", "correa"], ["Ejes", "eje"]],
  },
  {
    label: "Electrónica",
    parts: [["Sensores", "sensor"], ["Termistores", "termistor"], ["Placas", "placa"], ["Cables", "cable"]],
  },
  {
    label: "Accesorios",
    category: "Accesorios",
    parts: [["Cámaras", "camara"], ["Luces", "luz"], ["Cerramientos", "cerramiento"], ["Soportes", "soporte"]],
  },
  {
    label: "Otros",
    category: "Accesorios",
    parts: [["Sistemas multicolor", "multicolor"], ["Escáneres", "escaner"], ["Láser", "laser"], ["Secadoras", "secador"]],
  },
] as const;
const accessorySpareParts = new Set(["camara", "luz", "cerramiento", "soporte", "multicolor", "escaner", "laser", "secador"]);
const resinPrinterBrands = ["Anycubic", "Elegoo", "Creality", "Uniformation"];
const plaVariants = ["PLA", "PLA Flex", "PLA Silk", "PLA Art", "PLA Wood"];
const technicalFilamentMaterials = ["ABS", "ASA", "NYLON", "PC", "PVC", "PVA", "PEBA", "PA6-GF", "PPA-CF"];
const technicalFilamentMaterialSet = new Set(technicalFilamentMaterials);
const filamentColors = [
  ["Negro", "#202020"], ["Blanco", "#f6f3eb"], ["Gris", "#8b9196"], ["Rojo", "#d94343"],
  ["Naranja", "#e98432"], ["Amarillo", "#e9c52b"], ["Verde", "#39a95d"], ["Azul", "#427fd2"],
  ["Violeta", "#7c4bd6"], ["Rosa", "#e668a7"], ["Dorado", "#c79a2b"], ["Natural", "#dfc89f"],
] as const;
const filamentWeightLabels: Record<FilamentWeightGroup, string> = {
  "0.25": "0.250 kg",
  "0.5": "0.5 kg",
  "1": "1 kg",
  over1: "Más de 1 kg",
};
const themeChangeEvent = "filtrar-3d-theme-change";
const savedProductsStorageKey = "filtrar-3d-saved-products";
type MobileCategoryPanel = "filament" | "resin" | "parts" | "printer";
type ContactModal = "recommendation" | "store" | null;
type AppliedFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener(themeChangeEvent, onStoreChange);
  return () => window.removeEventListener(themeChangeEvent, onStoreChange);
}

function getStoredTheme() {
  return localStorage.getItem("filtrar-3d-theme") !== "light";
}

function getServerTheme() {
  return true;
}

function colorAvailabilityLabel(product: Product) {
  if (!product.filamentColors.length) return "Color no informado por la tienda";

  const visibleColors = product.filamentColors.slice(0, 3).join(", ");
  const hiddenColorCount = product.filamentColors.length - 3;
  return `Disponible en ${visibleColors}${hiddenColorCount > 0 ? ` y ${hiddenColorCount} más` : ""}`;
}

function priceRangeLabel(min: number | null, max: number | null) {
  if (min === null && max === null) return "Sin límite";
  if (min !== null && max !== null) return `${price.format(min)} - ${price.format(max)}`;
  if (min !== null) return `Desde ${price.format(min)}`;
  return `Hasta ${price.format(max ?? 0)}`;
}

function dateLabel(value: string | null) {
  if (!value) return "fecha no informada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha no informada";

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function parsePriceInput(value: string) {
  return parseSafePositiveInteger(value);
}

function postalCodeNumber(value: string) {
  const match = value.trim().toUpperCase().match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function availableBrands(products: Product[], predicate: (product: Product) => boolean, preferredOrder: string[] = []) {
  const brands = [...new Set(products.filter(predicate).map((product) => product.brand).filter((brand): brand is string => Boolean(brand) && brand !== unknownBrandLabel))];
  const preferred = preferredOrder.filter((brand) => brands.includes(brand));
  const remaining = brands.filter((brand) => !preferredOrder.includes(brand)).sort((a, b) => a.localeCompare(b, "es"));

  return [...preferred, ...remaining];
}

function productMatchesTerms(product: Product, terms: string[]) {
  return terms.every((term) => product.searchText.includes(term));
}

function CategoryIcon({ type }: { type: "filament" | "resin" | "parts" | "printer" }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };

  if (type === "filament") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" {...common} /><circle cx="12" cy="12" r="2.6" {...common} /><path d="M18.4 8.2 21 6.8v10.4l-2.6-1.4" {...common} /></svg>;
  if (type === "resin") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2s-6.2 6.4-6.2 11a6.2 6.2 0 1 0 12.4 0c0-4.6-6.2-11-6.2-11Z" {...common} /><path d="M9.1 16.1c.4 1.1 1.4 1.8 2.7 1.8" {...common} /></svg>;
  if (type === "parts") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14.4 6.1 3.5-3.5 1.5 1.5-3.5 3.5" {...common} /><path d="m12.5 8-8.9 8.9a2.1 2.1 0 0 0 3 3l8.9-8.9" {...common} /><path d="m13.2 3.4 1.7 1.7-3.1 3.1-2.2-.5-.5-2.2 3.1-3.1Z" {...common} /></svg>;
  return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.2h13.6v9.1H5.2zM8.1 17.3v2.3M15.9 17.3v2.3M9 11.1h6M12 8.2V4.5h4.1" {...common} /><circle cx="12" cy="14.3" r="1" fill="currentColor" /></svg>;
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.8c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8v15.4L12 17l-5 3.2V4.8Z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export function ProductExplorer({
  products,
  filamentBrands,
  filamentMaterials,
  storeLinks,
  stores,
  catalogFreshness,
  initialQuery,
}: ProductExplorerProps) {
  const isDark = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isSavedPanelOpen, setIsSavedPanelOpen] = useState(false);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [savedProductsRestored, setSavedProductsRestored] = useState(false);
  const [selectedSparePart, setSelectedSparePart] = useState<string | null>(null);
  const [selectedSpareBrand, setSelectedSpareBrand] = useState<string | null>(null);
  const [selectedSpareFamily, setSelectedSpareFamily] = useState<"fdm" | "resin" | null>(null);
  const [mobileCategoryPanel, setMobileCategoryPanel] = useState<MobileCategoryPanel | null>(null);
  const [contactModal, setContactModal] = useState<ContactModal>(null);
  const [storeMapZoom, setStoreMapZoom] = useState(1);
  const [storeMapFocus, setStoreMapFocus] = useState({ x: 50, y: 55 });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const availableResinPrinterBrands = useMemo(
    () => availableBrands(products, (product) => product.isResinPrinter, resinPrinterBrands),
    [products],
  );
  const availableCuringBrands = useMemo(
    () => availableBrands(products, (product) => product.isResinCuring, resinPrinterBrands),
    [products],
  );
  const availableResinMaterialBrands = useMemo(
    () => availableBrands(products, (product) => product.isResinMaterial, resinPrinterBrands),
    [products],
  );

  const toggleTheme = () => {
    localStorage.setItem("filtrar-3d-theme", isDark ? "light" : "dark");
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  const {
    category,
    filtered,
    handleQueryChange,
    hasActiveFilters,
    hasNoNearbyStores,
    query,
    resetFilters,
    resetVisibleCount,
    setCategory,
    setStore,
    store,
    nearbyOnly,
    nearbyPostalCode,
    nearbyStoreArea,
    clearFilamentBrands,
    clearFilamentColors,
    clearFilamentMaterials,
    clearFilamentWeights,
    clearPriceBounds,
    clearPrinterBrands,
    clearPrinterFrames,
    clearResinMaterialBrands,
    clearResinPrinterBrands,
    clearResinTypes,
    selectAllFilamentBrands,
    selectAllFilamentColors,
    selectAllFilamentMaterials,
    selectAllFilamentWeights,
    selectAllPrinterBrands,
    selectAllPrinterFrames,
    selectAllResinMaterialBrands,
    selectAllResinPrinterBrands,
    selectAllResinTypes,
    selectFilamentBrand,
    selectFilamentColor,
    selectFilamentMaterial,
    selectFilamentWeight,
    selectResinMaterialBrand,
    selectResinPrinterBrand,
    selectResinType,
    selectedFilamentBrands,
    selectedFilamentColors,
    selectedFilamentMaterials,
    selectedFilamentWeights,
    priceMin,
    priceMax,
    selectedPrinterBrands,
    selectedPrinterFrames,
    selectedResinMaterialBrands,
    selectedResinPrinterBrands,
    selectedResinTypes,
    setVisibleCount,
    setPriceMin,
    setPriceMax,
    setSort,
    setShowImmediate,
    setShowPreorder,
    setStockOnly,
    setNearbyOnly,
    setNearbyPostalCode,
    sort,
    showImmediate,
    showPreorder,
    stockOnly,
    toggleFilamentBrand,
    toggleFilamentColor,
    toggleFilamentMaterial,
    toggleFilamentWeight,
    togglePrinterBrand,
    togglePrinterFrame,
    toggleResinMaterialBrand,
    toggleResinPrinterBrand,
    toggleResinType,
    hiddenProducts,
    visibleCount,
    visibleProducts,
  } = useProductFilters(products, filamentBrands, filamentMaterials, availableResinPrinterBrands, availableResinMaterialBrands, initialQuery);
  const hasSearchQuery = query.trim().length > 0;
  const showsResults = hasSearchQuery || category !== "Todas" || store !== "Todas" || nearbyOnly;
  const materialMenuOptions = filamentMaterials
    .filter((material) => material !== "PLA Silk" && !technicalFilamentMaterialSet.has(material))
    .flatMap((material) => material === "PLA" ? plaVariants : [material]);
  const defaultFilamentMaterialCount = filamentMaterials.filter((material) => material !== "Lápiz 3D").length;
  const isFilamentSearch = category === "Filamento" || /\b(filamento|filamentos|pla|silk|slik|petg|abs|asa|tpu|flex|nylon|pvc|pva|pc|peba|pa6|ppa)\b/i.test(query);
  const isFdmPrinterSearch = category === "Impresoras FDM" || (category === "Todas" && /\b(impresora|impresoras|printer)\b/i.test(query));
  const isResinPrinterSearch = category === "Impresoras de Resina";
  const isCuringSearch = category === "Curadoras";
  const isResinMaterialSearch = category === "Resina";
  const isPrinterSearch = isFdmPrinterSearch || isResinPrinterSearch;
  const isResinSearch = isResinPrinterSearch || isCuringSearch || isResinMaterialSearch;
  const showsFilterSidebar = isFilamentSearch || isPrinterSearch || isCuringSearch || isResinMaterialSearch;
  const priceSlider = isFilamentSearch
    ? { min: 0, max: 30_000, step: 1000, start: "$0", middle: "$15k / $20k", end: "$30k" }
    : isResinMaterialSearch
      ? { min: 0, max: 150_000, step: 5000, start: "$0", middle: "$75k", end: "$150k" }
      : isResinPrinterSearch || isCuringSearch
        ? { min: 230_000, max: 2_000_000, step: 25_000, start: "$230k", middle: "$1M", end: "$2M" }
        : { min: 300_000, max: 3_000_000, step: 50_000, start: "$300k", middle: "$1.5M", end: "$3M" };
  const priceMinSliderValue = Math.max(priceSlider.min, Math.min(priceMin ?? priceSlider.min, priceSlider.max));
  const priceMaxSliderValue = Math.max(priceSlider.min, Math.min(priceMax ?? priceSlider.max, priceSlider.max));
  const selectedColorContext = isFilamentSearch && selectedFilamentColors.length > 0 && selectedFilamentColors.length < filamentColors.length
    ? `Disponibles en ${selectedFilamentColors.map((color) => color.toLocaleLowerCase("es-AR")).join(", ")}`
    : null;
  const appliedFilters: AppliedFilter[] = [
    query.trim() ? { key: "query", label: `Búsqueda: ${query.trim()}`, onRemove: () => handleQueryChange("", false) } : null,
    category !== "Todas" ? { key: "category", label: category, onRemove: () => { setCategory("Todas"); resetVisibleCount(); } } : null,
    store !== "Todas" ? { key: "store", label: store, onRemove: () => { setStore("Todas"); resetVisibleCount(); } } : null,
    nearbyOnly && nearbyStoreArea ? { key: "nearby", label: `Cerca de tu CP: ${nearbyStoreArea}`, onRemove: () => { setNearbyOnly(false); setNearbyPostalCode(""); resetVisibleCount(); } } : null,
    nearbyOnly && !nearbyStoreArea && nearbyPostalCode ? { key: "nearby-empty", label: "Sin tiendas cerca", onRemove: () => { setNearbyOnly(false); setNearbyPostalCode(""); resetVisibleCount(); } } : null,
    sort === "desc" ? { key: "sort", label: "Mayor precio", onRemove: () => { setSort("asc"); resetVisibleCount(); } } : null,
    stockOnly ? { key: "stock", label: "Solo disponibles", onRemove: () => { setStockOnly(false); resetVisibleCount(); } } : null,
    !showPreorder ? { key: "preorder", label: "Sin preventa", onRemove: () => { setShowPreorder(true); resetVisibleCount(); } } : null,
    !showImmediate ? { key: "immediate", label: "Sin entrega inmediata", onRemove: () => { setShowImmediate(true); resetVisibleCount(); } } : null,
    selectedFilamentBrands.length !== filamentBrands.length ? { key: "filament-brands", label: `${selectedFilamentBrands.length} marcas`, onRemove: selectAllFilamentBrands } : null,
    selectedFilamentMaterials.length !== defaultFilamentMaterialCount || selectedFilamentMaterials.includes("Lápiz 3D") ? { key: "filament-materials", label: `${selectedFilamentMaterials.length} materiales`, onRemove: selectAllFilamentMaterials } : null,
    selectedFilamentColors.length !== filamentColors.length ? { key: "filament-colors", label: `${selectedFilamentColors.length} colores`, onRemove: selectAllFilamentColors } : null,
    selectedFilamentWeights.length !== filamentWeightOptions.length ? { key: "filament-weights", label: `${selectedFilamentWeights.length} pesos`, onRemove: selectAllFilamentWeights } : null,
    priceMin !== null || priceMax !== null ? { key: "price", label: priceRangeLabel(priceMin, priceMax), onRemove: clearPriceBounds } : null,
    isFdmPrinterSearch && selectedPrinterBrands.length ? { key: "printer-brands", label: `${selectedPrinterBrands.length} marcas FDM`, onRemove: clearPrinterBrands } : null,
    isFdmPrinterSearch && selectedPrinterFrames.length !== printerFrameOptions.length ? { key: "printer-frames", label: selectedPrinterFrames.join(", "), onRemove: selectAllPrinterFrames } : null,
    isResinPrinterSearch && selectedResinPrinterBrands.length !== availableResinPrinterBrands.length ? { key: "resin-printer-brands", label: `${selectedResinPrinterBrands.length} marcas de resina`, onRemove: selectAllResinPrinterBrands } : null,
    isResinMaterialSearch && selectedResinMaterialBrands.length !== availableResinMaterialBrands.length ? { key: "resin-material-brands", label: `${selectedResinMaterialBrands.length} marcas de resina`, onRemove: selectAllResinMaterialBrands } : null,
    isResinMaterialSearch && selectedResinTypes.length !== resinTypeOptions.length ? { key: "resin-types", label: `${selectedResinTypes.length} tipos`, onRemove: selectAllResinTypes } : null,
  ].filter((filter): filter is AppliedFilter => Boolean(filter));

  const sparePartCategory = (part: string | null) => part && accessorySpareParts.has(part) ? "Accesorios" : "Repuestos";

  const updateSparePartSearch = (part: string | null, brand: string | null, family: "fdm" | "resin" | null, nextCategory = "Repuestos") => {
    setCategory(nextCategory);
    handleQueryChange([part, brand, family === "resin" ? "resina" : null].filter((value): value is string => Boolean(value)).join(" "), false);
  };

  const spareBrandHasResultsFor = (part: string | null, brand: string, family: "fdm" | "resin") => {
    if (!part) return true;

    const terms = [part, family === "resin" ? "resina" : null]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.toLowerCase().split(/\s+/).filter(Boolean));
    const targetCategory = sparePartCategory(part);

    return products.some((product) =>
      product.category === targetCategory &&
      product.brand === brand &&
      productMatchesTerms(product, terms)
    );
  };

  const spareBrandHasResults = (brand: string, family: "fdm" | "resin") => spareBrandHasResultsFor(selectedSparePart, brand, family);

  const selectSparePart = (part: string, nextCategory = "Repuestos") => {
    const nextPart = selectedSparePart === part ? null : part;
    const canKeepSelectedBrand = selectedSpareBrand && selectedSpareFamily
      ? spareBrandHasResultsFor(nextPart, selectedSpareBrand, selectedSpareFamily)
      : false;
    const nextBrand = canKeepSelectedBrand ? selectedSpareBrand : null;
    const nextFamily = canKeepSelectedBrand ? selectedSpareFamily : null;
    setSelectedSparePart(nextPart);
    setSelectedSpareBrand(nextBrand);
    setSelectedSpareFamily(nextFamily);
    updateSparePartSearch(nextPart, nextBrand, nextFamily, nextCategory);
  };

  const selectSpareBrand = (brand: string, family: "fdm" | "resin") => {
    const nextBrand = selectedSpareBrand === brand && selectedSpareFamily === family ? null : brand;
    const nextFamily = nextBrand ? family : null;
    setSelectedSpareBrand(nextBrand);
    setSelectedSpareFamily(nextFamily);
    updateSparePartSearch(selectedSparePart, nextBrand, nextFamily, sparePartCategory(selectedSparePart));
  };

  const resetAllFilters = () => {
    setSelectedSparePart(null);
    setSelectedSpareBrand(null);
    setSelectedSpareFamily(null);
    resetFilters();
  };
  const savedProductIdSet = useMemo(() => new Set(savedProductIds), [savedProductIds]);
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const storeLinkByName = useMemo(() => new Map(storeLinks.map((source) => [source.name, source.url])), [storeLinks]);
  const savedProducts = savedProductIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product));
  const nearbyStoreGuide = useMemo(() => {
    const postalCode = postalCodeNumber(nearbyPostalCode);
    const byStore = new Map<string, Product>();

    for (const product of products) {
      if (!byStore.has(product.store)) byStore.set(product.store, product);
    }

    const physicalStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        return product && !product.isOnlineOnly ? [product] : [];
      })
      .map((product) => {
        const distance = product.storeLocations
          .filter(isPhysicalStoreLocation)
          .reduce((closest, location) => {
            if (postalCode === null) return closest;
            return Math.min(closest, Math.abs(storeAreaReferencePostalCodes[location.area] - postalCode));
          }, Number.POSITIVE_INFINITY);

        return {
          areaLabel: product.storeLocations
            .filter(isPhysicalStoreLocation)
            .map((location) => location.area)
            .join(" y "),
          distance,
          name: product.store,
          url: storeLinkByName.get(product.store) ?? product.url,
        };
      })
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "es"));

    const onlineStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        return product?.isOnlineOnly ? [{ name: product.store, url: storeLinkByName.get(product.store) ?? product.url }] : [];
      });

    return { onlineStores, physicalStores };
  }, [nearbyPostalCode, products, storeLinkByName, stores]);
  const storeMapGuide = useMemo(() => {
    const byStore = new Map<string, Product>();

    for (const product of products) {
      if (!byStore.has(product.store)) byStore.set(product.store, product);
    }

    const physicalStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        if (!product || product.isOnlineOnly) return [];

        return product.storeLocations
          .filter(isPhysicalStoreLocation)
          .map((location) => ({
            address: location.address,
            area: location.area,
            name: product.store,
            point: projectArgentinaPoint(location),
            url: storeLinkByName.get(product.store) ?? product.url,
          }));
      });

    const onlineStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        return product?.isOnlineOnly ? [{ name: product.store, url: storeLinkByName.get(product.store) ?? product.url }] : [];
      });

    return { onlineStores, physicalStores };
  }, [products, storeLinkByName, stores]);
  const storeMapTransformOrigin = `${storeMapFocus.x}% ${(storeMapFocus.y / 120) * 100}%`;
  const setStoreMapZoomLevel = (nextZoom: number) => setStoreMapZoom(Math.min(2.8, Math.max(1, nextZoom)));
  const focusStoreMap = (point: { x: number; y: number }, zoom = 2.35) => {
    setStoreMapFocus(point);
    setStoreMapZoomLevel(zoom);
  };
  const resetStoreMap = () => {
    setStoreMapFocus({ x: 50, y: 55 });
    setStoreMapZoom(1);
  };
  const resultsTitle = hasSearchQuery
    ? `Resultados para “${query.trim()}”`
    : `Resultados de ${category !== "Todas" ? category : nearbyOnly && nearbyStoreArea ? "tiendas cerca de tu CP" : nearbyOnly ? "otras tiendas" : store}`;
  const newestScrapeLabel = dateLabel(catalogFreshness.newestScrapedAt);
  const oldestScrapeLabel = dateLabel(catalogFreshness.oldestScrapedAt);
  const refreshAttemptLabel = dateLabel(catalogFreshness.refreshedAt);
  const fullRefreshLabel = dateLabel(catalogFreshness.lastSuccessfulFullRefreshAt);
  const staleStoresLabel = catalogFreshness.staleStoreNames.length
    ? catalogFreshness.staleStoreNames.join(", ")
    : "algunas tiendas";
  const catalogNotice = catalogFreshness.refreshStatus === "partial"
    ? `Última actualización parcial el ${refreshAttemptLabel}. Se conservan precios previos de ${staleStoresLabel}; el último refresh completo fue el ${fullRefreshLabel}.`
    : `Datos actualizados entre ${oldestScrapeLabel} y ${newestScrapeLabel}.`;
  const selectStore = (storeName: string) => {
    setStore(storeName);
    resetVisibleCount();
    setIsStoreMenuOpen(false);
    document.getElementById("comparador")?.scrollIntoView({ behavior: "smooth" });
  };
  const mobileCategoryTitle = mobileCategoryPanel === "filament"
    ? "Filamento"
    : mobileCategoryPanel === "resin"
      ? "Resina"
      : mobileCategoryPanel === "parts"
        ? "Partes y repuestos"
        : "Impresoras FDM";

  const openMobileCategoryPanel = (panel: MobileCategoryPanel) => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches) {
      setMobileCategoryPanel(panel);
    }
  };

  const closeMobileCategoryPanel = () => setMobileCategoryPanel(null);
  const allFilamentBrandsSelected = selectedFilamentBrands.length === filamentBrands.length;
  const allFilamentMaterialsSelected =
    selectedFilamentMaterials.length === defaultFilamentMaterialCount &&
    !selectedFilamentMaterials.includes("Lápiz 3D");
  const allFilamentColorsSelected = selectedFilamentColors.length === filamentColors.length;
  const allFilamentWeightsSelected = selectedFilamentWeights.length === filamentWeightOptions.length;
  const allResinPrinterBrandsSelected = selectedResinPrinterBrands.length === availableResinPrinterBrands.length;
  const allResinMaterialBrandsSelected = selectedResinMaterialBrands.length === availableResinMaterialBrands.length;
  const allResinTypesSelected = selectedResinTypes.length === resinTypeOptions.length;

  const chooseFilamentBrand = (brand: string) => allFilamentBrandsSelected ? selectFilamentBrand(brand) : toggleFilamentBrand(brand);
  const chooseFilamentMaterial = (material: string) => allFilamentMaterialsSelected ? selectFilamentMaterial(material) : toggleFilamentMaterial(material);
  const chooseFilamentColor = (color: (typeof filamentColors)[number][0]) => allFilamentColorsSelected ? selectFilamentColor(color) : toggleFilamentColor(color);
  const chooseFilamentWeight = (weight: (typeof filamentWeightOptions)[number]) => allFilamentWeightsSelected ? selectFilamentWeight(weight) : toggleFilamentWeight(weight);
  const chooseResinPrinterBrand = (brand: string) => allResinPrinterBrandsSelected ? selectResinPrinterBrand(brand) : toggleResinPrinterBrand(brand);
  const chooseResinMaterialBrand = (brand: string) => allResinMaterialBrandsSelected ? selectResinMaterialBrand(brand) : toggleResinMaterialBrand(brand);
  const chooseResinType = (type: string) => allResinTypesSelected ? selectResinType(type) : toggleResinType(type);
  const showAllResinPrinters = () => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const showAllCuringMachines = () => { setCategory("Curadoras"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const showAllResinMaterials = () => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const filterResinPrintersByBrand = (brand: string) => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); chooseResinPrinterBrand(brand); };
  const filterResinCuringByBrand = (brand: string | null = null) => { setCategory("Curadoras"); handleQueryChange(brand ? `${brand} curado` : "", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const filterResinMaterialsByType = (type: string) => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); chooseResinType(type); };
  const filterResinMaterialsByBrand = (brand: string) => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); chooseResinMaterialBrand(brand); };
  const openContactModal = (modal: Exclude<ContactModal, null>) => {
    setContactModal(modal);
    setIsStoreMenuOpen(false);
    setIsSavedPanelOpen(false);
  };
  const closeContactModal = () => setContactModal(null);
  const sendContactForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const storeName = String(form.get("storeName") ?? "").trim();
    const storeUrl = String(form.get("storeUrl") ?? "").trim();
    const storePhone = String(form.get("storePhone") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const subject = contactModal === "store" ? "Sumar tienda a Ruta 3D" : "Mejora para Ruta 3D";
    const body = [
      name ? `Nombre: ${name}` : null,
      email ? `Email: ${email}` : null,
      storeName ? `Tienda: ${storeName}` : null,
      storeUrl ? `Web: ${storeUrl}` : null,
      storePhone ? `Teléfono: ${storePhone}` : null,
      "",
      message || "Hola, quería enviar esta información para Ruta 3D:",
    ].filter((line): line is string => line !== null).join("\n");
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=lok3d.co@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(gmailUrl, "_blank", "noopener,noreferrer");
    closeContactModal();
  };

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(savedProductsStorageKey) ?? "[]");
        if (Array.isArray(saved)) setSavedProductIds(saved.filter((id) => typeof id === "string").slice(0, 100));
      } catch {
        setSavedProductIds([]);
      }
      setSavedProductsRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (savedProductsRestored) localStorage.setItem(savedProductsStorageKey, JSON.stringify(savedProductIds));
  }, [savedProductIds, savedProductsRestored]);

  useEffect(() => {
    if (!mobileCategoryPanel && !contactModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileCategoryPanel, contactModal]);

  useEffect(() => {
    if (!contactModal) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContactModal();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contactModal]);

  useEffect(() => {
    const updateBackToTopVisibility = () => {
      const threshold = Math.max(720, window.innerHeight * 0.85);
      setShowBackToTop(window.scrollY > threshold);
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    window.addEventListener("resize", updateBackToTopVisibility);

    return () => {
      window.removeEventListener("scroll", updateBackToTopVisibility);
      window.removeEventListener("resize", updateBackToTopVisibility);
    };
  }, []);

  const toggleSavedProduct = (product: Product) => {
    const id = String(product.id);
    setSavedProductIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [id, ...current].slice(0, 100));
  };

  const scrollBackToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <main id="inicio" className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      <header className="site-header">
        <div className="site-header-main">
          <a className="header-coffee-link" href="#cafecito" aria-label="Invitame un cafecito">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-1M7 4v2M11 3v3M15 4v2" /></svg>
            <span>Invitame un cafecito</span>
          </a>
          <a className="site-header-brand" href="#inicio" aria-label="Ruta 3D, inicio">
            <Ruta3DMark className="site-header-mark" />
          </a>
          <div className="site-header-actions">
            <button
              type="button"
              className="saved-products-trigger"
              onClick={() => setIsSavedPanelOpen((open) => !open)}
              aria-expanded={isSavedPanelOpen}
              aria-controls="saved-products-panel"
            >
              <BookmarkIcon filled={savedProducts.length > 0} />
              <span>Guardados</span>
              {savedProducts.length ? <b>{savedProducts.length}</b> : null}
            </button>
            <button type="button" className="header-contact" onClick={() => openContactModal("recommendation")}>Contacto</button>
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label={`Cambiar a tema ${isDark ? "claro" : "oscuro"}`}
              aria-pressed={isDark}
            >
              {isDark ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.4A8.7 8.7 0 0 1 8.6 3.6 8.7 8.7 0 1 0 20.4 15.4Z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              )}
              <span className="theme-switch-label">{isDark ? "Oscuro" : "Claro"}</span>
            </button>
          </div>
        </div>
        <nav className="site-header-nav" aria-label="Navegación principal">
          <div className={`site-nav-dropdown ${isStoreMenuOpen ? "open" : ""}`}>
            <button type="button" aria-expanded={isStoreMenuOpen} aria-controls="store-menu" onClick={() => setIsStoreMenuOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Escape") setIsStoreMenuOpen(false); }}>Tiendas <span aria-hidden="true">⌄</span></button>
            <div id="store-menu" className="site-nav-dropdown-menu" aria-label="Lista de tiendas">
              {stores.slice(1).map((store) => (
                <div className="store-menu-row" key={store}>
                  <button type="button" onClick={() => selectStore(store)}>
                    <span>{store}</span>
                    <small>{products.find((product) => product.store === store)?.storeLocationSummary ?? "Ubicación no informada"}</small>
                  </button>
                  <a className="store-menu-visit" href={outboundStoreUrl({ store, url: storeLinkByName.get(store) ?? "", source: "store-menu" })} target="_blank" rel="noreferrer" aria-label={`Visitar tienda original de ${store}`}>
                    Visitar
                  </a>
                </div>
              ))}
            </div>
          </div>
          <a href="#como-funciona" onClick={() => setIsStoreMenuOpen(false)}>Cómo funciona</a>
          <a href="#mapa-tiendas" onClick={() => setIsStoreMenuOpen(false)}>Mapa</a>
          <a className="printer-guide-trigger" href="/que-impresora-compro" onClick={() => setIsStoreMenuOpen(false)}>¿Qué impresora compro?</a>
          <a href="#transparencia" onClick={() => setIsStoreMenuOpen(false)}>Precios y stock</a>
          <button type="button" className="nav-link-button" onClick={() => openContactModal("store")}>Sumá tu tienda</button>
        </nav>
        {isSavedPanelOpen ? (
          <section id="saved-products-panel" className="saved-products-panel" aria-label="Productos guardados">
            <div className="saved-products-heading">
              <div>
                <h2>Guardados</h2>
                <p>{savedProducts.length ? "Productos que marcaste para revisar después. La compra se finaliza en cada tienda." : "Todavía no guardaste productos. Tocá el bookmark de una oferta para verla acá después."}</p>
              </div>
              <button type="button" onClick={() => setIsSavedPanelOpen(false)}>Cerrar</button>
            </div>
            {savedProducts.length ? (
              <div className="saved-products-list">
                {savedProducts.map((product) => (
                  <article key={product.id} className="saved-product">
                    <a href={outboundProductUrl(product, "saved-products")} target="_blank" rel="noreferrer">
                      <span className="saved-product-image">{product.image ? <Image src={product.image} alt={product.name} fill sizes="72px" /> : product.category.slice(0, 3).toUpperCase()}</span>
                      <span>
                        <small>{product.store}</small>
                        <strong>{product.name}</strong>
                        <b>{price.format(product.bestPrice)}</b>
                      </span>
                    </a>
                    <button type="button" onClick={() => toggleSavedProduct(product)}>Quitar</button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </header>
      <section className="search-band comparison-hero" id="comparador">
        <Image className="comparison-art" src="/hero-printing-kit.png" alt="" aria-hidden="true" width={1672} height={941} sizes="(max-width: 1100px) 92vw, 58vw" />
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-logo-lockup" aria-label="Ruta 3D">
              <Ruta3DMark className="hero-route-mark" />
            </div>
            <h1>Comparador argentino de impresión 3D</h1>
          </div>
          <div className="hero-showcase" aria-label="Comparador de productos">
            <div className="comparator-window">
              <header className="comparator-header">
                <div className="comparator-brand">
                  <Ruta3DMark className="mini-route-mark" />
                </div>
                <div className="comparator-search-stack">
                  <label className="comparator-search" htmlFor="search">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.2 4.2" /></svg>
                    <input id="search" value={query} onChange={(event) => { setSelectedSparePart(null); setSelectedSpareBrand(null); setSelectedSpareFamily(null); handleQueryChange(event.target.value); }} aria-label="Buscar productos" />
                  </label>
                  <div className="toolbar comparator-toolbar" aria-label="Orden y disponibilidad">
                    <div className="segmented">
                      <button type="button" className={sort === "desc" ? "active" : ""} aria-pressed={sort === "desc"} onClick={() => { setSort("desc"); resetVisibleCount(); }}>Mayor precio</button>
                      <button type="button" className={sort === "asc" ? "active" : ""} aria-pressed={sort === "asc"} onClick={() => { setSort("asc"); resetVisibleCount(); }}>Menor precio</button>
                    </div>
                    <label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => { setStockOnly(event.target.checked); resetVisibleCount(); }} />Solo disponibles</label>
                    <label className="toggle"><input type="checkbox" checked={showPreorder} onChange={(event) => { setShowPreorder(event.target.checked); resetVisibleCount(); }} />Preventa</label>
                    <label className="toggle"><input type="checkbox" checked={showImmediate} onChange={(event) => { setShowImmediate(event.target.checked); resetVisibleCount(); }} />Entrega inmediata</label>
                    <label className="zone-filter">
                      <span>Código postal</span>
                      <input value={nearbyPostalCode} inputMode="text" autoComplete="postal-code" placeholder="Ej. X5000" onChange={(event) => setNearbyPostalCode(event.target.value)} />
                      <span className="zone-filter-check"><input type="checkbox" checked={nearbyOnly} onChange={(event) => { setNearbyOnly(event.target.checked); resetVisibleCount(); }} />Tiendas cerca de mí</span>
                    </label>
                    <button type="button" className="search-reset-button" onClick={resetAllFilters} disabled={!hasActiveFilters}>Limpiar filtros</button>
                  </div>
                  {appliedFilters.length ? (
                    <div className="active-search-filters" aria-label="Filtros aplicados">
                      {appliedFilters.map((filter) => (
                        <button key={filter.key} type="button" onClick={filter.onRemove} aria-label={`Quitar filtro ${filter.label}`}>
                          <span>{filter.label}</span>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="flag-dot" aria-hidden="true" />
              </header>

              <div className="category-tabs" aria-label="Categorías">
                <div className="category-menu filament-menu">
                  <button type="button" className={category === "Filamento" ? "active" : ""} onClick={() => { setCategory("Filamento"); resetVisibleCount(); openMobileCategoryPanel("filament"); }}>
                    <CategoryIcon type="filament" />Filamento
                  </button>
                  <div className="mega-menu filament-mega-menu" aria-label="Filtros de filamentos">
                    <section>
                      <p>Materiales</p>
                      {materialMenuOptions.map((material) => {
                        const isPlaVariant = material.startsWith("PLA") && material !== "PLA";

                        return <button key={material} type="button" className={isPlaVariant ? query.toLowerCase() === material.toLowerCase() ? "selected" : "" : !allFilamentMaterialsSelected && selectedFilamentMaterials.includes(material) ? "selected" : ""} onClick={() => { setCategory("Filamento"); if (isPlaVariant) handleQueryChange(material, false); else { handleQueryChange("", false); chooseFilamentMaterial(material); } }}>{material}</button>;
                      })}
                    </section>
                    <section className="technical-material-section">
                      <p>Técnicos</p>
                      {technicalFilamentMaterials.map((material) => <button key={material} type="button" className={!allFilamentMaterialsSelected && selectedFilamentMaterials.includes(material) ? "selected" : ""} onClick={() => { setCategory("Filamento"); handleQueryChange("", false); chooseFilamentMaterial(material); }}>{material}</button>)}
                    </section>
                    <section>
                      <p>Marcas</p>
                      {filamentBrands.map((brand) => <button key={brand} type="button" className={!allFilamentBrandsSelected && selectedFilamentBrands.includes(brand) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentBrand(brand); }}>{brand}</button>)}
                    </section>
                    <section>
                      <p>Colores</p>
                      {filamentColors.map(([color, hex]) => <button key={color} type="button" className={!allFilamentColorsSelected && selectedFilamentColors.includes(color) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentColor(color); }}><i className="color-dot" style={{ backgroundColor: hex }} />{color}</button>)}
                    </section>
                    <section>
                      <p>Kilos</p>
                      {filamentWeightOptions.map((weight) => <button key={weight} type="button" className={!allFilamentWeightsSelected && selectedFilamentWeights.includes(weight) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentWeight(weight); }}>{filamentWeightLabels[weight]}</button>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu resin-menu">
                  <button type="button" className={isResinSearch ? "active" : ""} onClick={() => { showAllResinMaterials(); openMobileCategoryPanel("resin"); }}>
                    <CategoryIcon type="resin" />Resina
                  </button>
                  <div className="mega-menu resin-mega-menu" aria-label="Filtros de resina">
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinPrinters}>Impresoras de resina</button>
                      {availableResinPrinterBrands.map((brand) => <button key={brand} type="button" className={!allResinPrinterBrandsSelected && selectedResinPrinterBrands.includes(brand) ? "selected" : ""} onClick={() => filterResinPrintersByBrand(brand)}>{brand}</button>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllCuringMachines}>Curadoras</button>
                      {availableCuringBrands.map((brand) => <button key={brand} type="button" onClick={() => filterResinCuringByBrand(brand)}>{brand}</button>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinMaterials}>Materiales de resina</button>
                      {resinTypeOptions.map((type) => <button key={type} type="button" className={!allResinTypesSelected && selectedResinTypes.includes(type) ? "selected" : ""} onClick={() => filterResinMaterialsByType(type)}>{type}</button>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinMaterials}>Marcas de resina</button>
                      {availableResinMaterialBrands.map((brand) => <button key={brand} type="button" className={!allResinMaterialBrandsSelected && selectedResinMaterialBrands.includes(brand) ? "selected" : ""} onClick={() => filterResinMaterialsByBrand(brand)}>{brand}</button>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu parts-menu">
                  <button type="button" className={category === "Repuestos" || category === "Accesorios" ? "active" : ""} onClick={() => { setCategory("Repuestos"); resetVisibleCount(); openMobileCategoryPanel("parts"); }}>
                    <CategoryIcon type="parts" />Partes y Repuestos
                  </button>
                  <div className="mega-menu parts-mega-menu" aria-label="Filtros de partes y repuestos">
                    <div className="parts-menu-intro">
                      <strong>Elegí repuesto y marca</strong>
                      <span>{selectedSparePart || selectedSpareBrand ? [selectedSparePart, selectedSpareBrand].filter(Boolean).join(" + ") : "Combiná ambos filtros para afinar la búsqueda."}</span>
                    </div>
                    {sparePartGroups.map((group) => (
                      <section key={group.label}>
                        <p>{group.label}</p>
                        {group.parts.map(([label, term]) => <button key={term} type="button" className={selectedSparePart === term ? "selected" : ""} onClick={() => selectSparePart(term, "category" in group ? group.category : "Repuestos")}>{label}</button>)}
                      </section>
                    ))}
                    <section className="parts-brand-section">
                      <p>Marcas FDM</p>
                      {printerAccessoryBrands.map((brand) => {
                        const isDisabled = !spareBrandHasResults(brand, "fdm");

                        return <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "fdm" ? "selected" : ""} disabled={isDisabled} aria-disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onClick={() => selectSpareBrand(brand, "fdm")}>{brand}</button>;
                      })}
                    </section>
                    <section className="parts-brand-section">
                      <p>Marcas resina</p>
                      {availableResinPrinterBrands.map((brand) => {
                        const isDisabled = !spareBrandHasResults(brand, "resin");

                        return <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "resin" ? "selected" : ""} disabled={isDisabled} aria-disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onClick={() => selectSpareBrand(brand, "resin")}>{brand}</button>;
                      })}
                    </section>
                  </div>
                </div>
                <div className="category-menu">
                  <button type="button" className={category === "Impresoras FDM" ? "active" : ""} onClick={() => { setCategory("Impresoras FDM"); resetVisibleCount(); openMobileCategoryPanel("printer"); }}>
                    <CategoryIcon type="printer" />Impresoras FDM
                  </button>
                  <div className="mega-menu" aria-label="Marcas de impresoras FDM">
                    <p>Marcas</p>
                    {fdmBrands.map((brand) => (
                      <button key={brand} type="button" className={selectedPrinterBrands.includes(brand) ? "selected" : ""} onClick={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); togglePrinterBrand(brand); }}>
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {mobileCategoryPanel ? (
                <div className="mobile-category-filter" role="dialog" aria-modal="true" aria-labelledby="mobile-category-filter-title">
                  <button type="button" className="mobile-category-backdrop" aria-label="Cerrar filtros de categoría" onClick={closeMobileCategoryPanel} />
                  <div className="mobile-category-sheet">
                    <header className="mobile-category-sheet-header">
                      <div>
                        <span>Categoría</span>
                        <h2 id="mobile-category-filter-title">{mobileCategoryTitle}</h2>
                      </div>
                      <button type="button" className="mobile-category-close" aria-label="Cerrar" onClick={closeMobileCategoryPanel}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                      </button>
                    </header>

                    <div className="mobile-category-sheet-body">
                      {mobileCategoryPanel === "filament" ? (
                        <>
                          <details open>
                            <summary onClick={() => { setCategory("Filamento"); handleQueryChange("", false); selectAllFilamentMaterials(); }}>Materiales</summary>
                            <div className="mobile-filter-options">
                              {materialMenuOptions.map((material) => {
                                const isPlaVariant = material.startsWith("PLA") && material !== "PLA";

                                return <button key={material} type="button" className={isPlaVariant ? query.toLowerCase() === material.toLowerCase() ? "selected" : "" : !allFilamentMaterialsSelected && selectedFilamentMaterials.includes(material) ? "selected" : ""} onClick={() => { setCategory("Filamento"); if (isPlaVariant) handleQueryChange(material, false); else { handleQueryChange("", false); chooseFilamentMaterial(material); } }}>{material}</button>;
                              })}
                            </div>
                          </details>
                          <details>
                            <summary onClick={() => { setCategory("Filamento"); handleQueryChange("", false); selectAllFilamentMaterials(); }}>Técnicos</summary>
                            <div className="mobile-filter-options is-technical">
                              {technicalFilamentMaterials.map((material) => <button key={material} type="button" className={!allFilamentMaterialsSelected && selectedFilamentMaterials.includes(material) ? "selected" : ""} onClick={() => { setCategory("Filamento"); handleQueryChange("", false); chooseFilamentMaterial(material); }}>{material}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={() => { setCategory("Filamento"); selectAllFilamentBrands(); }}>Marcas</summary>
                            <div className="mobile-filter-options">
                              {filamentBrands.map((brand) => <button key={brand} type="button" className={!allFilamentBrandsSelected && selectedFilamentBrands.includes(brand) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentBrand(brand); }}>{brand}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={() => { setCategory("Filamento"); selectAllFilamentColors(); }}>Colores</summary>
                            <div className="mobile-filter-options">
                              {filamentColors.map(([color, hex]) => <button key={color} type="button" className={!allFilamentColorsSelected && selectedFilamentColors.includes(color) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentColor(color); }}><i className="color-dot" style={{ backgroundColor: hex }} />{color}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={() => { setCategory("Filamento"); selectAllFilamentWeights(); }}>Kilos</summary>
                            <div className="mobile-filter-options">
                              {filamentWeightOptions.map((weight) => <button key={weight} type="button" className={!allFilamentWeightsSelected && selectedFilamentWeights.includes(weight) ? "selected" : ""} onClick={() => { setCategory("Filamento"); chooseFilamentWeight(weight); }}>{filamentWeightLabels[weight]}</button>)}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "resin" ? (
                        <>
                          <details open>
                            <summary onClick={showAllResinPrinters}>Impresoras de resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinPrinterBrands.map((brand) => <button key={brand} type="button" className={!allResinPrinterBrandsSelected && selectedResinPrinterBrands.includes(brand) ? "selected" : ""} onClick={() => filterResinPrintersByBrand(brand)}>{brand}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={showAllCuringMachines}>Curadoras</summary>
                            <div className="mobile-filter-options">
                              {availableCuringBrands.map((brand) => <button key={brand} type="button" onClick={() => filterResinCuringByBrand(brand)}>{brand}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={showAllResinMaterials}>Materiales de resina</summary>
                            <div className="mobile-filter-options">
                              {resinTypeOptions.map((type) => <button key={type} type="button" className={!allResinTypesSelected && selectedResinTypes.includes(type) ? "selected" : ""} onClick={() => filterResinMaterialsByType(type)}>{type}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={showAllResinMaterials}>Marcas de resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinMaterialBrands.map((brand) => <button key={brand} type="button" className={!allResinMaterialBrandsSelected && selectedResinMaterialBrands.includes(brand) ? "selected" : ""} onClick={() => filterResinMaterialsByBrand(brand)}>{brand}</button>)}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "parts" ? (
                        <>
                          <div className="mobile-parts-summary">
                            <strong>{selectedSparePart || selectedSpareBrand ? [selectedSparePart, selectedSpareBrand].filter(Boolean).join(" + ") : "Combiná repuesto y marca para afinar."}</strong>
                          </div>
                          {sparePartGroups.map((group, index) => (
                            <details key={group.label} open={index === 0}>
                              <summary>{group.label}</summary>
                              <div className="mobile-filter-options">
                                {group.parts.map(([label, term]) => <button key={term} type="button" className={selectedSparePart === term ? "selected" : ""} onClick={() => selectSparePart(term, "category" in group ? group.category : "Repuestos")}>{label}</button>)}
                              </div>
                            </details>
                          ))}
                          <details>
                            <summary>Marcas FDM</summary>
                            <div className="mobile-filter-options">
                              {printerAccessoryBrands.map((brand) => {
                                const isDisabled = !spareBrandHasResults(brand, "fdm");

                                return <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "fdm" ? "selected" : ""} disabled={isDisabled} aria-disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onClick={() => selectSpareBrand(brand, "fdm")}>{brand}</button>;
                              })}
                            </div>
                          </details>
                          <details>
                            <summary>Marcas resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinPrinterBrands.map((brand) => {
                                const isDisabled = !spareBrandHasResults(brand, "resin");

                                return <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "resin" ? "selected" : ""} disabled={isDisabled} aria-disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onClick={() => selectSpareBrand(brand, "resin")}>{brand}</button>;
                              })}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "printer" ? (
                        <>
                          <details open>
                            <summary onClick={() => { setCategory("Impresoras FDM"); selectAllPrinterFrames(); }}>Tipo</summary>
                            <div className="mobile-filter-options">
                              {printerFrameOptions.map((frame) => <button key={frame} type="button" className={selectedPrinterFrames.includes(frame) ? "selected" : ""} onClick={() => { setCategory("Impresoras FDM"); togglePrinterFrame(frame); }}>{frame}</button>)}
                            </div>
                          </details>
                          <details>
                            <summary onClick={() => { setCategory("Impresoras FDM"); clearPrinterBrands(); }}>Marcas</summary>
                            <div className="mobile-filter-options">
                              {fdmBrands.map((brand) => (
                                <button key={brand} type="button" className={selectedPrinterBrands.includes(brand) ? "selected" : ""} onClick={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); togglePrinterBrand(brand); }}>
                                  {brand}
                                </button>
                              ))}
                            </div>
                          </details>
                        </>
                      ) : null}
                    </div>

                    <footer className="mobile-category-sheet-footer">
                      <button type="button" onClick={resetAllFilters}>Limpiar</button>
                      <button type="button" onClick={closeMobileCategoryPanel}>Ver resultados</button>
                    </footer>
                  </div>
                </div>
              ) : null}

              <div className={`comparison-table ${showsResults ? "" : "is-empty"}`} aria-label="Ofertas destacadas" aria-live="polite">
                {showsResults ? (
                  <>
                    <div className="search-results-heading comparator-results-heading">
                      <div>
                        <h2>{resultsTitle}</h2>
                        <p>{filtered.length} {filtered.length === 1 ? "producto encontrado" : "productos encontrados"}{selectedColorContext ? <><span aria-hidden="true"> · </span><strong className="results-color-context">{selectedColorContext}</strong></> : null}</p>
                      </div>
                      {hasNoNearbyStores ? (
                        <aside className="nearby-store-guide" aria-label="Tiendas por cercanía aproximada">
                          <div>
                            <strong>Locales más cercanos</strong>
                            <ol>
                              {nearbyStoreGuide.physicalStores.map((store) => (
                                <li key={store.name}>
                                  <button type="button" onClick={() => selectStore(store.name)}>
                                    <span>{store.name}</span>
                                    <small>{store.areaLabel}</small>
                                  </button>
                                </li>
                              ))}
                            </ol>
                          </div>
                          {nearbyStoreGuide.onlineStores.length ? (
                            <div>
                              <strong>Online</strong>
                              <div className="nearby-online-stores">
                                {nearbyStoreGuide.onlineStores.map((store) => (
                                  <button key={store.name} type="button" onClick={() => selectStore(store.name)}>{store.name}</button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </aside>
                      ) : null}
                    </div>
                    {visibleProducts.length || showsFilterSidebar ? (
                      <div className={showsFilterSidebar ? "filament-search-layout" : undefined}>
                        {showsFilterSidebar ? (
                          <aside className="filament-filter-sidebar" aria-label={isPrinterSearch ? "Filtrar impresoras" : isResinMaterialSearch ? "Filtrar resinas" : "Filtrar filamentos"}>
                            <div className="filament-filter-title"><h3>Filtrar</h3><button type="button" onClick={resetFilters}>Limpiar</button></div>
                            <details open><summary>Precio</summary><div className="filter-price-range"><div className="price-filter-heading"><strong>{priceRangeLabel(priceMin, priceMax)}</strong><button type="button" onClick={clearPriceBounds}>Limpiar</button></div><div className="dual-range"><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMinSliderValue} onChange={(event) => setPriceMin(Number(event.target.value))} aria-label="Precio mínimo" /><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMaxSliderValue} onChange={(event) => setPriceMax(Number(event.target.value))} aria-label="Precio máximo" /></div><div className="price-range-scale"><span>{priceSlider.start}</span><span>{priceSlider.middle}</span><span>{priceSlider.end}</span></div><div className="price-inputs"><label><span>Mínimo</span><input inputMode="numeric" value={priceMin ?? ""} placeholder={String(priceSlider.min)} onChange={(event) => setPriceMin(parsePriceInput(event.target.value))} /></label><label><span>Máximo</span><input inputMode="numeric" value={priceMax ?? ""} placeholder={String(priceSlider.max)} onChange={(event) => setPriceMax(parsePriceInput(event.target.value))} /></label></div></div></details>
                            {isPrinterSearch ? <details open><summary>Disponibilidad</summary><div className="filter-actions"><button type="button" onClick={() => { setShowPreorder(true); setShowImmediate(true); resetVisibleCount(); }}>Todas</button></div><div className="filter-options"><label><input type="checkbox" checked={showImmediate} onChange={(event) => { setShowImmediate(event.target.checked); resetVisibleCount(); }} /><span>Entrega inmediata</span></label><label><input type="checkbox" checked={showPreorder} onChange={(event) => { setShowPreorder(event.target.checked); resetVisibleCount(); }} /><span>Preventa</span></label></div><p className="filament-color-note">Las preventas quedan identificadas para no compararlas como compra inmediata.</p></details> : null}
                            {isFdmPrinterSearch ? <details open><summary>Tipo</summary><div className="filter-actions"><button type="button" onClick={selectAllPrinterFrames}>Todas</button><button type="button" onClick={clearPrinterFrames}>Ninguna</button></div><div className="filter-options">{printerFrameOptions.map((frame) => <label key={frame}><input type="checkbox" checked={selectedPrinterFrames.includes(frame)} onChange={() => togglePrinterFrame(frame)} /><span>{frame}</span></label>)}</div><p className="filament-color-note">Al filtrar por tipo se muestran solo modelos detectados en esa característica.</p></details> : null}
                            {isFdmPrinterSearch ? <details><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={clearPrinterBrands}>Todas</button><button type="button" onClick={() => selectAllPrinterBrands(["__none__"])}>Ninguna</button></div><div className="filter-options">{fdmBrands.map((brand) => <label key={brand}><input type="checkbox" checked={!selectedPrinterBrands.length || selectedPrinterBrands.includes(brand)} onChange={() => togglePrinterBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isResinPrinterSearch ? <details><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllResinPrinterBrands}>Todas</button><button type="button" onClick={clearResinPrinterBrands}>Ninguna</button></div><div className="filter-options">{availableResinPrinterBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedResinPrinterBrands.includes(brand)} onChange={() => toggleResinPrinterBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isResinMaterialSearch ? <details open><summary>Material</summary><div className="filter-actions"><button type="button" onClick={selectAllResinTypes}>Todos</button><button type="button" onClick={clearResinTypes}>Ninguno</button></div><div className="filter-options">{resinTypeOptions.map((type) => <label key={type}><input type="checkbox" checked={selectedResinTypes.includes(type)} onChange={() => toggleResinType(type)} /><span>{type}</span></label>)}</div></details> : null}
                            {isResinMaterialSearch ? <details><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllResinMaterialBrands}>Todas</button><button type="button" onClick={clearResinMaterialBrands}>Ninguna</button></div><div className="filter-options">{availableResinMaterialBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedResinMaterialBrands.includes(brand)} onChange={() => toggleResinMaterialBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentBrands}>Todas</button><button type="button" onClick={clearFilamentBrands}>Ninguna</button></div><div className="filter-options">{filamentBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedFilamentBrands.includes(brand)} onChange={() => toggleFilamentBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details><summary>Material</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentMaterials}>Todas</button><button type="button" onClick={clearFilamentMaterials}>Ninguna</button></div><div className="filter-options">{filamentMaterials.map((material) => <label key={material}><input type="checkbox" checked={selectedFilamentMaterials.includes(material)} onChange={() => toggleFilamentMaterial(material)} /><span>{material}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details><summary>Color</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentColors}>Todas</button><button type="button" onClick={clearFilamentColors}>Ninguna</button></div><div className="filter-options">{filamentColors.map(([color, hex]) => <label key={color}><input type="checkbox" checked={selectedFilamentColors.includes(color)} onChange={() => toggleFilamentColor(color)} /><i className="sidebar-color-dot" style={{ backgroundColor: hex }} /><span>{color}</span></label>)}</div><p className="filament-color-note">Si una tienda no informa el color, su oferta queda al final para que no se pierda.</p></details> : null}
                            {isFilamentSearch ? <details><summary>Kilos</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentWeights}>Todos</button><button type="button" onClick={clearFilamentWeights}>Ninguno</button></div><div className="filter-options">{filamentWeightOptions.map((weight) => <label key={weight}><input type="checkbox" checked={selectedFilamentWeights.includes(weight)} onChange={() => toggleFilamentWeight(weight)} /><span>{filamentWeightLabels[weight]}</span></label>)}</div><p className="filament-color-note">Si una tienda no informa el peso, su oferta queda al final para que no se pierda.</p></details> : null}
                          </aside>
                        ) : null}
                      <div className="product-search-grid">
                        {hasNoNearbyStores ? (
                          <div className="nearby-empty-notice">
                            <strong>No hay tiendas cerca de tu código postal</strong>
                            <span>Te mostramos el resto de las ofertas conectadas; arriba tenés las tiendas físicas ordenadas de más cerca a más lejos.</span>
                          </div>
                        ) : null}
                        {visibleProducts.length ? visibleProducts.map((product) => (
                          <article className={`product-search-card ${savedProductIdSet.has(String(product.id)) ? "is-saved" : ""}`} key={product.id}>
                            <button
                              type="button"
                              className="save-product-button"
                              onClick={() => toggleSavedProduct(product)}
                              aria-label={savedProductIdSet.has(String(product.id)) ? `Quitar ${product.name} de guardados` : `Guardar ${product.name}`}
                              aria-pressed={savedProductIdSet.has(String(product.id))}
                            >
                              <BookmarkIcon filled={savedProductIdSet.has(String(product.id))} />
                            </button>
                            <a className="product-search-link" href={outboundProductUrl(product, "catalog-card")} target="_blank" rel="noreferrer" aria-label={`Ver ${product.name} en ${product.store}`}>
                              <div className="product-search-image" style={{ backgroundColor: product.color }}>
                                {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 44vw, (max-width: 1100px) 28vw, 20vw" /> : <span>{product.category.slice(0, 3).toUpperCase()}</span>}
                              </div>
                              <div className="product-search-copy">
                                <p className="product-store-line"><span>{product.store}</span><b className={`store-mode-label ${product.isOnlineOnly ? "is-online" : ""}`}>{product.storeLocationSummary}</b></p>
                                <h3>{product.name}</h3>
                                {product.purchaseModes.some((mode) => mode !== "Entrega inmediata") ? (
                                  <span className="product-purchase-modes">
                                    {product.purchaseModes.filter((mode) => mode !== "Entrega inmediata").map((mode) => (
                                      <b
                                        className={product.saleNoticeType === "deposit" ? "is-deposit-mode" : mode === "Preventa" ? "is-preorder-mode" : undefined}
                                        key={mode}
                                      >
                                        {mode === "Preventa" ? product.saleNoticeLabel ?? product.preorderLabel ?? mode : mode}
                                      </b>
                                    ))}
                                  </span>
                                ) : null}
                                {isFilamentSearch && product.isFilament ? <span className={`filament-color-status ${product.filamentColors.length ? "has-color" : "missing-color"}`}>{colorAvailabilityLabel(product)}</span> : null}
                                <strong>{price.format(product.bestPrice)}</strong>
                                <span>{product.transferPrice ? "Transferencia" : "Precio de lista"}</span>
                                {product.saleNoticeLabel ? <b className={`product-stock-warning ${product.saleNoticeType === "deposit" ? "deposit-warning" : "preorder-warning"}`}>{product.saleNoticeLabel}</b> : product.stock === "Consultar" ? <b className="product-stock-warning">No disponible</b> : null}
                              </div>
                            </a>
                          </article>
                        )) : <p className="search-results-empty">No encontramos productos para esta búsqueda. Probá con otra marca, material o medida.</p>}
                      </div>
                      </div>
                    ) : <p className="search-results-empty">No encontramos productos para esta búsqueda. Probá con otra marca, material o medida.</p>}
                    {hiddenProducts ? <button className="show-more-results" type="button" onClick={() => setVisibleCount(visibleCount + 48)}>Ver {Math.min(hiddenProducts, 48)} productos más</button> : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="mapa-tiendas" className="store-map-section" aria-labelledby="store-map-title">
        <div className="store-map-heading">
          <div>
            <h2 id="store-map-title">Mapa de tiendas</h2>
            <p>Locales conectados por zona y tiendas online separadas para elegir dónde conviene comprar o retirar.</p>
          </div>
          <button type="button" onClick={() => { setStore("Todas"); resetVisibleCount(); document.getElementById("comparador")?.scrollIntoView({ behavior: "smooth" }); }}>
            Ver todas las tiendas
          </button>
        </div>

        <div className="store-map-layout">
          <div className="store-map-panel" aria-label="Mapa de Argentina con tiendas con local">
            <div className="store-map-controls" aria-label="Controles del mapa">
              <button type="button" onClick={() => setStoreMapZoomLevel(storeMapZoom + 0.35)} aria-label="Acercar mapa">+</button>
              <button type="button" onClick={() => setStoreMapZoomLevel(storeMapZoom - 0.35)} aria-label="Alejar mapa">−</button>
              <button type="button" onClick={resetStoreMap}>Argentina</button>
              <button type="button" onClick={() => focusStoreMap(projectArgentinaPoint({ area: "CABA", address: "AMBA" }), 2.45)}>AMBA</button>
              <button type="button" onClick={() => focusStoreMap(projectArgentinaPoint({ area: "Córdoba", address: "Córdoba" }), 2.1)}>Córdoba</button>
            </div>
            <div className="store-map-viewport">
              <div
                className="store-map-canvas"
                style={{
                  transform: `scale(${storeMapZoom})`,
                  transformOrigin: storeMapTransformOrigin,
                }}
              >
                <svg className="argentina-map" viewBox="0 0 100 120" role="img" aria-label="Mapa de Argentina">
                  <path className="argentina-mainland" d="M39 2 52 6 59 15 58 24 66 31 63 39 69 47 66 56 72 65 68 75 72 85 65 94 64 105 56 118 47 113 48 101 43 91 46 80 41 69 44 58 39 49 42 39 35 30 38 20 34 11Z" />
                  <path className="argentina-south" d="M52 106 61 111 56 119 48 116Z" />
                  <path className="argentina-lines" d="M39 25 58 25M36 38 63 38M42 53 66 53M44 68 70 68M46 84 68 84M47 101 63 101" />
                  <path className="argentina-river" d="M68 52c-5 7-7 14-5 22" />
                </svg>
                {storeMapGuide.physicalStores.map((store) => (
                  <button
                    key={`${store.name}-${store.address}`}
                    type="button"
                    className="store-map-pin"
                    style={{ left: `${store.point.x}%`, top: `${(store.point.y / 120) * 100}%` }}
                    onClick={() => { focusStoreMap(store.point); selectStore(store.name); }}
                    aria-label={`Filtrar por ${store.name}, local en ${store.area}`}
                  >
                    <span>{store.name}</span>
                    <small>{store.area}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="store-map-zoom" aria-label="Nivel de zoom">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="2.8"
                step="0.05"
                value={storeMapZoom}
                onChange={(event) => setStoreMapZoomLevel(Number(event.target.value))}
              />
            </div>
          </div>

          <aside className="store-map-list" aria-label="Tiendas online conectadas">
            <div>
              <h3>Locales físicos</h3>
              <div className="store-map-store-list">
                {storeMapGuide.physicalStores.map((store) => (
                  <article key={`${store.name}-${store.address}`}>
                    <button type="button" onClick={() => selectStore(store.name)}>
                      <strong>{store.name}</strong>
                      <span>{store.area}</span>
                    </button>
                    <small>{store.address}</small>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3>Solo online</h3>
              <div className="store-map-online-list">
                {storeMapGuide.onlineStores.map((store) => (
                  <button key={store.name} type="button" onClick={() => selectStore(store.name)}>{store.name}</button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="site-info" aria-label="Información sobre Ruta 3D">
        <div className="site-info-inner">
          <section id="como-funciona" className="info-section">
            <h2>Compará antes de comprar</h2>
            <p>Buscá por producto, marca o material; filtrá por tienda, zona y disponibilidad; después abrí la oferta para completar la compra directamente con el comercio. Algunas tiendas conectadas venden solo online.</p>
          </section>
          <section id="transparencia" className="info-section">
            <h2>Precios y stock de referencia</h2>
            <p>Los valores y la disponibilidad se obtienen de catálogos conectados. Hoy mostramos {count.format(catalogFreshness.productCount)} ofertas de {catalogFreshness.storeCount} tiendas. {catalogNotice} El precio final y el stock se confirman en la tienda de destino.</p>
          </section>
          <section id="cafecito" className="info-section coffee-section">
            <h2>Invitame un cafecito</h2>
            <p><span className="coffee-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-1M7 4v2M11 3v3M15 4v2" /></svg>Si te sirve Ruta 3D, podés apoyar el proyecto con un cafecito.</span></p>
            <a className="cafecito-button" href="https://cafecito.app/santi-loc" rel="noopener" target="_blank">
              <Image src="https://cdn.cafecito.app/imgs/buttons/button_1.png" alt="Invitame un café en cafecito.app" width={250} height={55} />
            </a>
          </section>
        </div>
        <aside id="contacto" className="store-cta">
          <div>
            <h2>Ayudanos a mejorar</h2>
            <p>¿Tenés una recomendación, una mejora o una tienda de impresión 3D para sumar? Escribinos y lo revisamos para las próximas vueltas de Ruta 3D.</p>
            <span className="contact-email">lok3d.co@gmail.com</span>
          </div>
          <div className="store-cta-actions">
            <button type="button" onClick={() => openContactModal("recommendation")}>Enviar recomendación</button>
            <button type="button" onClick={() => openContactModal("store")}>Sumá tu tienda</button>
          </div>
        </aside>
      </section>
      {contactModal ? (
        <section className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
          <button type="button" className="contact-modal-backdrop" aria-label="Cerrar contacto" onClick={closeContactModal} />
          <form className="contact-card" onSubmit={sendContactForm}>
            <header>
              <div>
                <h2 id="contact-modal-title">{contactModal === "store" ? "Sumá tu tienda" : "Enviar recomendación"}</h2>
                <p>{contactModal === "store" ? "Pasame los datos de la tienda y la reviso para conectarla al comparador." : "Contame qué falta, qué viste raro o qué querés que Ruta 3D compare mejor."}</p>
              </div>
              <button type="button" className="contact-close" aria-label="Cerrar" onClick={closeContactModal}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </header>
            <div className="contact-fields">
              <label>
                <span>Tu nombre</span>
                <input name="name" autoComplete="name" />
              </label>
              <label>
                <span>Tu email</span>
                <input name="email" type="email" autoComplete="email" />
              </label>
              {contactModal === "store" ? (
                <>
                  <label>
                    <span>Nombre de la tienda</span>
                    <input name="storeName" required />
                  </label>
                  <label>
                    <span>Web o Instagram</span>
                    <input name="storeUrl" required placeholder="https://" />
                  </label>
                  <label>
                    <span>Teléfono de contacto</span>
                    <input name="storePhone" inputMode="tel" autoComplete="tel" />
                  </label>
                </>
              ) : null}
              <label className="contact-message">
                <span>{contactModal === "store" ? "Qué vende o qué datos conviene revisar" : "Recomendación o mejora"}</span>
                <textarea name="message" required rows={5} />
              </label>
            </div>
            <footer>
              <span>Se abre Gmail web con el mensaje listo para enviar.</span>
              <button type="submit">{contactModal === "store" ? "Preparar tienda" : "Preparar recomendación"}</button>
            </footer>
          </form>
        </section>
      ) : null}
      <footer className="site-footer">
        <p>Ruta 3D compara ofertas; no procesa pagos ni reemplaza la información publicada por cada tienda.</p>
        <div className="site-footer-links">
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
          <a href="#inicio">Volver arriba</a>
        </div>
      </footer>
      <button
        type="button"
        className={`back-to-top ${showBackToTop ? "is-visible" : ""}`}
        onClick={scrollBackToTop}
        aria-label="Volver arriba"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="m6 11 6-6 6 6" />
        </svg>
      </button>

    </main>
  );
}
