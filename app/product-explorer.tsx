"use client";

import Image from "next/image";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FilamentWeightGroup, Product, StoreArea, StoreSource } from "@/lib/catalog";
import { outboundProductUrl, outboundStoreUrl } from "@/lib/outbound-links";
import { parseSafePositiveInteger } from "@/lib/security";
import { Ruta3DMark } from "./ruta-3d-mark";
import { StoreMap } from "./store-map";
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
  storeLinks: StoreLink[];
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

type StoreLink = Pick<StoreSource, "name" | "url" | "locations" | "storeLocationSummary" | "isOnlineOnly">;
type StoreGuideEntry = { product: Product | null; source?: StoreLink };

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
  "Santa Fe": 3000,
  "Buenos Aires": 1702,
};
const storeAreaCoordinates: Record<PhysicalStoreArea, { lat: number; lng: number }> = {
  "CABA": { lat: -34.6037, lng: -58.3816 },
  "La Plata": { lat: -34.9205, lng: -57.9536 },
  "Córdoba": { lat: -31.4201, lng: -64.1888 },
  "Santa Fe": { lat: -31.6333, lng: -60.7000 },
  "Buenos Aires": { lat: -34.633, lng: -58.536 },
};

function isPhysicalStoreLocation(location: Product["storeLocations"][number]): location is PhysicalStoreLocation {
  return location.area !== "Online";
}

const fdmBrands = ["Bambu Lab", "Creality", "Elegoo", "Flashforge", "Snapmaker", "Anycubic", "Artillery", "Hellbot"];
const laserBrandOrder = ["Creality", "xTool", "AlgoLaser", "Sculpfun", "Hellbot", "Bambu Lab", "Neje", "Two Trees"];
const laserGroups = [
  {
    label: "Equipos",
    items: [["Grabadoras y cortadoras", "grabadora laser"], ["Diodo", "diodo"], ["CO2", "co2"], ["Fibra / UV", "fibra uv"]],
  },
  {
    label: "Módulos",
    items: [["Módulos láser", "modulo laser"], ["Infrarrojo", "infrarrojo"], ["Upgrade kits", "laser upgrade"]],
  },
  {
    label: "Accesorios",
    items: [["Rotativos", "rotativo"], ["Honeycomb", "honeycomb"], ["Air assist", "air assist"], ["Risers y elevadores", "elevadores"]],
  },
  {
    label: "Seguridad",
    items: [["Purificadores", "purificador"], ["Cubiertas", "cubierta"], ["Lentes", "lente"], ["Materiales", "kit materiales"]],
  },
] as const;
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
  {
    label: "Insumos",
    category: "Insumos",
    parts: [["Polímeros", "polimero"], ["Llaveros", "llavero"], ["Pinturas", "pintura acrilica"], ["Vasos", "vaso milkshake"], ["Luces LED", "luz led"]],
  },
] as const;
const accessorySpareParts = new Set(["camara", "luz", "cerramiento", "soporte", "multicolor", "escaner", "laser", "secador"]);
const supplySpareParts = new Set(["polimero", "llavero", "pintura acrilica", "vaso milkshake", "luz led"]);
const resinPrinterBrands = ["Anycubic", "Elegoo", "Creality", "Uniformation"];
const printerTradeInStores = [
  {
    name: "TP3D",
    area: "Córdoba",
    note: "Tomá tu impresora usada como parte de pago para bajar el precio de una nueva.",
  },
  {
    name: "Proyecto Color",
    area: "CABA y Córdoba",
    note: "Ofrece canje con evaluación previa para renovar equipo en sus locales.",
  },
] as const;
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
type MobileCategoryPanel = "filament" | "resin" | "parts" | "printer" | "laser";
type ContactModal = "recommendation" | "store" | null;
type SpareBrandSelection = { brand: string; family: "fdm" | "resin" };
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

function productMatchesAnyTermSet(product: Product, terms: string[]) {
  return terms.some((term) => productMatchesTerms(product, term.toLowerCase().split(/\s+/).filter(Boolean)));
}

function sparePartCategory(part: string | null) {
  if (part && supplySpareParts.has(part)) return "Insumos";
  if (part && accessorySpareParts.has(part)) return "Accesorios";
  return "Repuestos";
}

function CategoryIcon({ type }: { type: "filament" | "resin" | "parts" | "printer" | "laser" }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };

  if (type === "filament") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" {...common} /><circle cx="12" cy="12" r="2.6" {...common} /><path d="M18.4 8.2 21 6.8v10.4l-2.6-1.4" {...common} /></svg>;
  if (type === "resin") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2s-6.2 6.4-6.2 11a6.2 6.2 0 1 0 12.4 0c0-4.6-6.2-11-6.2-11Z" {...common} /><path d="M9.1 16.1c.4 1.1 1.4 1.8 2.7 1.8" {...common} /></svg>;
  if (type === "parts") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 6.2 17 3.3l3.7 3.7-2.9 2.9" {...common} /><path d="m13.1 8.9-8.2 8.2a2.1 2.1 0 0 0 3 3l8.2-8.2" {...common} /><path d="m11.5 4.2 2.3 2.3-3.1 3.1-2.7-.6-.6-2.7 3.1-3.1Z" {...common} /></svg>;
  if (type === "laser") return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v5h-15zM7.5 10.5 5.8 19M16.5 10.5l1.7 8.5M9 19h6M12 10.5v3.3M10.5 15.3 12 13.8l1.5 1.5M7.4 8h2.2M14.4 8h2.2" {...common} /></svg>;
  return <svg className="category-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.2h13.6v9.1H5.2zM8.1 17.3v2.3M15.9 17.3v2.3M9 11.1h6M12 8.2V4.5h4.1" {...common} /><circle cx="12" cy="14.3" r="1" fill="currentColor" /></svg>;
}

function productFallbackIconType(product: Product): "filament" | "resin" | "parts" | "printer" | "laser" {
  if (product.isLaserProduct) return "laser";
  if (product.isFdmPrinter || product.isResinPrinter) return "printer";
  if (product.isResinMaterial || product.isResinCuring) return "resin";
  if (product.isFilament) return "filament";
  return "parts";
}

function productFallbackLabel(product: Product) {
  if (product.category === "Insumos") return "Insumo";
  if (product.category === "Herramientas") return "Herramienta";
  return product.category;
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.8c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8v15.4L12 17l-5 3.2V4.8Z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

function CategoryFilterOption({
  children,
  disabled = false,
  label,
  onReplace,
  onToggle,
  selected,
  title,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onReplace: () => void;
  onToggle: () => void;
  selected: boolean;
  title?: string;
}) {
  const replaceSelection = () => {
    if (!disabled) onReplace();
  };

  const toggleSelection = () => {
    if (!disabled) onToggle();
  };

  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    replaceSelection();
  };

  const onCheckKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.stopPropagation();
  };

  return (
    <div
      className={`category-filter-option ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={replaceSelection}
      onKeyDown={onRowKeyDown}
      title={title}
    >
      <button
        type="button"
        className="category-option-check"
        aria-label={`${selected ? "Quitar" : "Agregar"} ${label}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          toggleSelection();
        }}
        onKeyDown={onCheckKeyDown}
      >
        <span aria-hidden="true" />
      </button>
      <span className="category-option-label">{children}</span>
    </div>
  );
}

export function ProductExplorer({
  products: initialProducts,
  filamentBrands,
  filamentMaterials,
  storeLinks,
  stores,
  catalogFreshness,
  initialQuery,
}: ProductExplorerProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [catalogLoadState, setCatalogLoadState] = useState<"loading" | "ready" | "error">(
    initialProducts.length ? "ready" : "loading",
  );
  const isDark = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isSavedPanelOpen, setIsSavedPanelOpen] = useState(false);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [savedProductsRestored, setSavedProductsRestored] = useState(false);
  const [selectedFilamentMenuTerms, setSelectedFilamentMenuTerms] = useState<string[]>([]);
  const [selectedSpareParts, setSelectedSpareParts] = useState<string[]>([]);
  const [selectedSpareBrands, setSelectedSpareBrands] = useState<SpareBrandSelection[]>([]);
  const [selectedCuringBrands, setSelectedCuringBrands] = useState<string[]>([]);
  const [selectedLaserTerms, setSelectedLaserTerms] = useState<string[]>([]);
  const [mobileCategoryPanel, setMobileCategoryPanel] = useState<MobileCategoryPanel | null>(null);
  const [contactModal, setContactModal] = useState<ContactModal>(null);
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
  const availableLaserBrands = useMemo(
    () => availableBrands(products, (product) => product.isLaserProduct, laserBrandOrder),
    [products],
  );

  useEffect(() => {
    if (initialProducts.length) return;

    let isCancelled = false;

    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog", { cache: "force-cache" });
        if (!response.ok) throw new Error("catalog-request-failed");
        const data = await response.json() as { products?: Product[] };
        if (!Array.isArray(data.products)) throw new Error("catalog-payload-invalid");
        if (!isCancelled) {
          setProducts(data.products);
          setCatalogLoadState("ready");
        }
      } catch {
        if (!isCancelled) setCatalogLoadState("error");
      }
    }

    void loadCatalog();

    return () => {
      isCancelled = true;
    };
  }, [initialProducts.length]);

  const toggleTheme = () => {
    localStorage.setItem("filtrar-3d-theme", isDark ? "light" : "dark");
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  const {
    category,
    filtered: baseFiltered,
    handleQueryChange,
    hasActiveFilters: baseHasActiveFilters,
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
    selectFilamentWeight,
    selectPrinterBrand,
    selectPrinterFrame,
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
    visibleCount,
  } = useProductFilters(products, filamentBrands, filamentMaterials, availableResinPrinterBrands, availableResinMaterialBrands, initialQuery);

  const categoryMenuHasActiveFilters =
    selectedFilamentMenuTerms.length > 0 ||
    selectedSpareParts.length > 0 ||
    selectedSpareBrands.length > 0 ||
    selectedCuringBrands.length > 0 ||
    selectedLaserTerms.length > 0;
  const hasActiveFilters = baseHasActiveFilters || categoryMenuHasActiveFilters;
  const filtered = useMemo(() => {
    return baseFiltered.filter((product) => {
      if (selectedFilamentMenuTerms.length > 0) {
        return product.isFilament && productMatchesAnyTermSet(product, selectedFilamentMenuTerms);
      }

      if (selectedCuringBrands.length > 0) {
        return product.isResinCuring && selectedCuringBrands.includes(product.brand ?? unknownBrandLabel);
      }

      if (selectedLaserTerms.length > 0) {
        return product.isLaserProduct && productMatchesAnyTermSet(product, selectedLaserTerms);
      }

      if (selectedSpareParts.length > 0 || selectedSpareBrands.length > 0) {
        const matchesPart =
          selectedSpareParts.length === 0 ||
          selectedSpareParts.some((part) => product.category === sparePartCategory(part) && productMatchesAnyTermSet(product, [part]));
        const matchesBrand =
          selectedSpareBrands.length === 0 ||
          selectedSpareBrands.some(({ brand, family }) =>
            product.brand === brand &&
            (family === "fdm" || productMatchesAnyTermSet(product, ["resina"])),
          );

        return matchesPart && matchesBrand;
      }

      return true;
    });
  }, [baseFiltered, selectedCuringBrands, selectedFilamentMenuTerms, selectedLaserTerms, selectedSpareBrands, selectedSpareParts]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const hiddenProducts = Math.max(filtered.length - visibleProducts.length, 0);
  const clearCategoryMenuFilters = () => {
    setSelectedFilamentMenuTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
  };

  useEffect(() => {
    const trackedQuery = query.trim();
    if (trackedQuery.length < 2) return;

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({
        query: trackedQuery,
        category,
        store,
        resultCount: String(filtered.length),
      });

      void fetch(`/api/search-metrics?${params.toString()}`, { cache: "no-store", keepalive: true }).catch(() => {});
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [category, filtered.length, query, store]);

  const hasSearchQuery = query.trim().length > 0;
  const showsResults = hasSearchQuery || category !== "Todas" || store !== "Todas" || nearbyOnly || categoryMenuHasActiveFilters;
  const materialMenuOptions = filamentMaterials
    .filter((material) => material !== "PLA Silk" && !technicalFilamentMaterialSet.has(material))
    .flatMap((material) => material === "PLA" ? plaVariants : [material]);
  const defaultFilamentMaterialCount = filamentMaterials.filter((material) => material !== "Lápiz 3D").length;
  const isFilamentSearch = category === "Filamento" || selectedFilamentMenuTerms.length > 0 || /\b(filamento|filamentos|pla|silk|slik|petg|abs|asa|tpu|flex|nylon|pvc|pva|pc|peba|pa6|ppa)\b/i.test(query);
  const isFdmPrinterSearch = category === "Impresoras FDM" || (category === "Todas" && /\b(impresora|impresoras|printer)\b/i.test(query));
  const isResinPrinterSearch = category === "Impresoras de Resina";
  const isCuringSearch = category === "Curadoras" || selectedCuringBrands.length > 0;
  const isResinMaterialSearch = category === "Resina";
  const isLaserSearch = category === "Corte láser" || selectedLaserTerms.length > 0;
  const isPrinterSearch = isFdmPrinterSearch || isResinPrinterSearch;
  const isResinSearch = isResinPrinterSearch || isCuringSearch || isResinMaterialSearch;
  const showsFilterSidebar = isFilamentSearch || isPrinterSearch || isCuringSearch || isResinMaterialSearch || isLaserSearch;
  const priceSlider = isFilamentSearch
    ? { min: 0, max: 30_000, step: 1000, start: "$0", middle: "$15k / $20k", end: "$30k" }
    : isResinMaterialSearch
      ? { min: 0, max: 150_000, step: 5000, start: "$0", middle: "$75k", end: "$150k" }
      : isLaserSearch
        ? { min: 0, max: 5_000_000, step: 50_000, start: "$0", middle: "$2.5M", end: "$5M" }
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
    isPrinterSearch && !showPreorder ? { key: "preorder", label: "Sin preventa", onRemove: () => { setShowPreorder(true); resetVisibleCount(); } } : null,
    isPrinterSearch && !showImmediate ? { key: "immediate", label: "Sin entrega inmediata", onRemove: () => { setShowImmediate(true); resetVisibleCount(); } } : null,
    selectedFilamentBrands.length !== filamentBrands.length ? { key: "filament-brands", label: `${selectedFilamentBrands.length} marcas`, onRemove: selectAllFilamentBrands } : null,
    selectedFilamentMenuTerms.length ? { key: "filament-menu-terms", label: `${selectedFilamentMenuTerms.length} tipos`, onRemove: () => { setSelectedFilamentMenuTerms([]); resetVisibleCount(); } } : null,
    selectedFilamentMaterials.length !== defaultFilamentMaterialCount || selectedFilamentMaterials.includes("Lápiz 3D") ? { key: "filament-materials", label: `${selectedFilamentMaterials.length} materiales`, onRemove: selectAllFilamentMaterials } : null,
    selectedFilamentColors.length !== filamentColors.length ? { key: "filament-colors", label: `${selectedFilamentColors.length} colores`, onRemove: selectAllFilamentColors } : null,
    selectedFilamentWeights.length !== filamentWeightOptions.length ? { key: "filament-weights", label: `${selectedFilamentWeights.length} pesos`, onRemove: selectAllFilamentWeights } : null,
    priceMin !== null || priceMax !== null ? { key: "price", label: priceRangeLabel(priceMin, priceMax), onRemove: clearPriceBounds } : null,
    isFdmPrinterSearch && selectedPrinterBrands.length ? { key: "printer-brands", label: `${selectedPrinterBrands.length} marcas FDM`, onRemove: clearPrinterBrands } : null,
    isFdmPrinterSearch && selectedPrinterFrames.length !== printerFrameOptions.length ? { key: "printer-frames", label: selectedPrinterFrames.join(", "), onRemove: selectAllPrinterFrames } : null,
    isResinPrinterSearch && selectedResinPrinterBrands.length !== availableResinPrinterBrands.length ? { key: "resin-printer-brands", label: `${selectedResinPrinterBrands.length} marcas de resina`, onRemove: selectAllResinPrinterBrands } : null,
    isResinMaterialSearch && selectedResinMaterialBrands.length !== availableResinMaterialBrands.length ? { key: "resin-material-brands", label: `${selectedResinMaterialBrands.length} marcas de resina`, onRemove: selectAllResinMaterialBrands } : null,
    isResinMaterialSearch && selectedResinTypes.length !== resinTypeOptions.length ? { key: "resin-types", label: `${selectedResinTypes.length} tipos`, onRemove: selectAllResinTypes } : null,
    selectedCuringBrands.length ? { key: "curing-brands", label: `${selectedCuringBrands.length} marcas de curadoras`, onRemove: () => { setSelectedCuringBrands([]); resetVisibleCount(); } } : null,
    selectedSpareParts.length ? { key: "spare-parts", label: `${selectedSpareParts.length} repuestos`, onRemove: () => { setSelectedSpareParts([]); resetVisibleCount(); } } : null,
    selectedSpareBrands.length ? { key: "spare-brands", label: `${selectedSpareBrands.length} marcas de repuestos`, onRemove: () => { setSelectedSpareBrands([]); resetVisibleCount(); } } : null,
    selectedLaserTerms.length ? { key: "laser-terms", label: `${selectedLaserTerms.length} filtros láser`, onRemove: () => { setSelectedLaserTerms([]); resetVisibleCount(); } } : null,
  ].filter((filter): filter is AppliedFilter => Boolean(filter));

  const prepareMenuFilter = (nextCategory: string) => {
    setCategory(nextCategory);
    handleQueryChange("", false);
  };
  const toggleFilamentMenuTerm = (term: string) => {
    prepareMenuFilter("Filamento");
    selectAllFilamentMaterials();
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    setSelectedFilamentMenuTerms((current) => current.includes(term) ? current.filter((item) => item !== term) : [...current, term]);
  };
  const replaceFilamentMenuTerm = (term: string) => {
    prepareMenuFilter("Filamento");
    selectAllFilamentMaterials();
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    setSelectedFilamentMenuTerms([term]);
  };
  const toggleSparePart = (part: string) => {
    prepareMenuFilter("Todas");
    setSelectedFilamentMenuTerms([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    setSelectedSpareParts((current) => current.includes(part) ? current.filter((item) => item !== part) : [...current, part]);
  };
  const replaceSparePart = (part: string) => {
    prepareMenuFilter("Todas");
    setSelectedFilamentMenuTerms([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    setSelectedSpareParts([part]);
    setSelectedSpareBrands([]);
  };
  const spareBrandKey = (selection: SpareBrandSelection) => `${selection.family}:${selection.brand}`;
  const spareBrandHasResults = (brand: string, family: "fdm" | "resin") => {
    if (!selectedSpareParts.length) return true;

    return selectedSpareParts.some((part) =>
      products.some((product) =>
        product.category === sparePartCategory(part) &&
        product.brand === brand &&
        (family === "fdm" || productMatchesAnyTermSet(product, ["resina"])) &&
        productMatchesAnyTermSet(product, [part]),
      ),
    );
  };
  const toggleSpareBrand = (brand: string, family: "fdm" | "resin") => {
    prepareMenuFilter("Todas");
    setSelectedFilamentMenuTerms([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    const nextSelection = { brand, family };
    const nextKey = spareBrandKey(nextSelection);
    setSelectedSpareBrands((current) => current.some((item) => spareBrandKey(item) === nextKey) ? current.filter((item) => spareBrandKey(item) !== nextKey) : [...current, nextSelection]);
  };
  const replaceSpareBrand = (brand: string, family: "fdm" | "resin") => {
    prepareMenuFilter("Todas");
    setSelectedFilamentMenuTerms([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([{ brand, family }]);
  };
  const toggleCuringBrand = (brand: string) => {
    prepareMenuFilter("Curadoras");
    selectAllResinPrinterBrands();
    selectAllResinMaterialBrands();
    selectAllResinTypes();
    setSelectedFilamentMenuTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedLaserTerms([]);
    setSelectedCuringBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]);
  };
  const replaceCuringBrand = (brand: string) => {
    prepareMenuFilter("Curadoras");
    selectAllResinPrinterBrands();
    selectAllResinMaterialBrands();
    selectAllResinTypes();
    setSelectedFilamentMenuTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedLaserTerms([]);
    setSelectedCuringBrands([brand]);
  };
  const toggleLaserTerm = (term: string) => {
    prepareMenuFilter("Corte láser");
    setSelectedFilamentMenuTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms((current) => current.includes(term) ? current.filter((item) => item !== term) : [...current, term]);
  };
  const replaceLaserTerm = (term: string) => {
    prepareMenuFilter("Corte láser");
    setSelectedFilamentMenuTerms([]);
    setSelectedSpareParts([]);
    setSelectedSpareBrands([]);
    setSelectedCuringBrands([]);
    setSelectedLaserTerms([term]);
  };
  const resetAllFilters = () => {
    clearCategoryMenuFilters();
    resetFilters();
  };
  const savedProductIdSet = useMemo(() => new Set(savedProductIds), [savedProductIds]);
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const storeLinkByName = useMemo(() => new Map(storeLinks.map((source) => [source.name, source.url])), [storeLinks]);
  const storeSourceByName = useMemo(() => new Map(storeLinks.map((source) => [source.name, source])), [storeLinks]);
  const savedProducts = savedProductIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product));
  const nearbyStoreGuide = useMemo(() => {
    const postalCode = postalCodeNumber(nearbyPostalCode);
    const byStore = new Map<string, Product>();

    for (const product of products) {
      if (!byStore.has(product.store)) byStore.set(product.store, product);
    }

    const storeEntries: StoreGuideEntry[] = stores
      .slice(1)
      .flatMap((storeName): StoreGuideEntry[] => {
        const product = byStore.get(storeName);
        const source = storeSourceByName.get(storeName);
        if (product) return !product.isOnlineOnly ? [{ product, source }] : [];
        return source && !source.isOnlineOnly ? [{ product: null, source }] : [];
      });

    const physicalStores = storeEntries
      .map(({ product, source }) => {
        const locations = product?.storeLocations ?? source?.locations ?? [];
        const storeName = product?.store ?? source?.name ?? "";
        const distance = locations
          .filter(isPhysicalStoreLocation)
          .reduce((closest, location) => {
            if (postalCode === null) return closest;
            return Math.min(closest, Math.abs(storeAreaReferencePostalCodes[location.area] - postalCode));
          }, Number.POSITIVE_INFINITY);

        return {
          areaLabel: locations
            .filter(isPhysicalStoreLocation)
            .map((location) => location.area)
            .join(" y "),
          distance,
          name: storeName,
          url: storeLinkByName.get(storeName) ?? product?.url ?? source?.url ?? "",
        };
      })
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "es"));

    const onlineStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        const source = storeSourceByName.get(storeName);
        if (product) return product.isOnlineOnly ? [{ name: product.store, url: storeLinkByName.get(product.store) ?? product.url }] : [];
        return source?.isOnlineOnly ? [{ name: source.name, url: storeLinkByName.get(source.name) ?? source.url }] : [];
      });

    return { onlineStores, physicalStores };
  }, [nearbyPostalCode, products, storeLinkByName, storeSourceByName, stores]);
  const storeMapGuide = useMemo(() => {
    const byStore = new Map<string, Product>();

    for (const product of products) {
      if (!byStore.has(product.store)) byStore.set(product.store, product);
    }

    const physicalStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        const source = storeSourceByName.get(storeName);
        const locations = product?.storeLocations ?? source?.locations ?? [];
        const isOnlineOnly = product?.isOnlineOnly ?? source?.isOnlineOnly ?? true;
        if (isOnlineOnly) return [];

        return locations
          .filter(isPhysicalStoreLocation)
          .map((location) => ({
            address: location.address,
            area: location.area,
            lat: location.lat ?? storeAreaCoordinates[location.area].lat,
            lng: location.lng ?? storeAreaCoordinates[location.area].lng,
            name: product?.store ?? source?.name ?? storeName,
            url: storeLinkByName.get(storeName) ?? product?.url ?? source?.url ?? "",
          }));
      });

    const onlineStores = stores
      .slice(1)
      .flatMap((storeName) => {
        const product = byStore.get(storeName);
        const source = storeSourceByName.get(storeName);
        if (product) return product.isOnlineOnly ? [{ name: product.store, url: storeLinkByName.get(product.store) ?? product.url }] : [];
        return source?.isOnlineOnly ? [{ name: source.name, url: storeLinkByName.get(source.name) ?? source.url }] : [];
      });

    return { onlineStores, physicalStores };
  }, [products, storeLinkByName, storeSourceByName, stores]);
  const storeMenuGroups = useMemo(() => {
    const byStore = new Map<string, Product>();
    const groupOrder = ["CABA", "Buenos Aires", "Córdoba", "Santa Fe", "Online"] as const;
    const groups = new Map(groupOrder.map((label) => [label, [] as { name: string; summary: string; url: string }[]]));

    for (const product of products) {
      if (!byStore.has(product.store)) byStore.set(product.store, product);
    }

    for (const storeName of stores.slice(1)) {
      const product = byStore.get(storeName);
      const source = storeSourceByName.get(storeName);
      const locations = product?.storeLocations ?? source?.locations ?? [];
      const physicalAreas = new Set(
        locations
          .filter((location) => location.area !== "Online")
          .map((location) => location.area === "La Plata" ? "Buenos Aires" : location.area),
      );

      const menuStore = {
        name: storeName,
        summary: product?.storeLocationSummary ?? source?.storeLocationSummary ?? "Ubicación no informada",
        url: storeLinkByName.get(storeName) ?? product?.url ?? source?.url ?? "",
      };

      if (physicalAreas.size === 0) {
        groups.get("Online")?.push(menuStore);
      } else {
        for (const area of physicalAreas) groups.get(area)?.push(menuStore);
      }
    }

    return groupOrder
      .map((label) => ({
        label,
        stores: (groups.get(label) ?? []).sort((a, b) => a.name.localeCompare(b.name, "es")),
      }))
      .filter((group) => group.stores.length > 0);
  }, [products, storeLinkByName, storeSourceByName, stores]);
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
  const isCatalogLoading = catalogLoadState === "loading";
  const hasCatalogLoadError = catalogLoadState === "error";
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
        : mobileCategoryPanel === "laser"
          ? "Corte láser"
          : "Impresoras FDM";

  const openMobileCategoryPanel = (panel: MobileCategoryPanel) => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches) {
      setMobileCategoryPanel(panel);
    }
  };

  const closeMobileCategoryPanel = () => setMobileCategoryPanel(null);
  const allFilamentBrandsSelected = selectedFilamentBrands.length === filamentBrands.length;
  const allFilamentColorsSelected = selectedFilamentColors.length === filamentColors.length;
  const allFilamentWeightsSelected = selectedFilamentWeights.length === filamentWeightOptions.length;
  const allResinPrinterBrandsSelected = selectedResinPrinterBrands.length === availableResinPrinterBrands.length;
  const allResinMaterialBrandsSelected = selectedResinMaterialBrands.length === availableResinMaterialBrands.length;
  const allResinTypesSelected = selectedResinTypes.length === resinTypeOptions.length;

  const chooseFilamentBrand = (brand: string) => allFilamentBrandsSelected ? selectFilamentBrand(brand) : toggleFilamentBrand(brand);
  const chooseFilamentColor = (color: (typeof filamentColors)[number][0]) => allFilamentColorsSelected ? selectFilamentColor(color) : toggleFilamentColor(color);
  const chooseFilamentWeight = (weight: (typeof filamentWeightOptions)[number]) => allFilamentWeightsSelected ? selectFilamentWeight(weight) : toggleFilamentWeight(weight);
  const chooseResinPrinterBrand = (brand: string) => allResinPrinterBrandsSelected ? selectResinPrinterBrand(brand) : toggleResinPrinterBrand(brand);
  const chooseResinMaterialBrand = (brand: string) => allResinMaterialBrandsSelected ? selectResinMaterialBrand(brand) : toggleResinMaterialBrand(brand);
  const chooseResinType = (type: string) => allResinTypesSelected ? selectResinType(type) : toggleResinType(type);
  const showAllResinPrinters = () => { clearCategoryMenuFilters(); setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const showAllCuringMachines = () => { clearCategoryMenuFilters(); setCategory("Curadoras"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const showAllResinMaterials = () => { clearCategoryMenuFilters(); setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectAllResinTypes(); };
  const filterResinPrintersByBrand = (brand: string) => { clearCategoryMenuFilters(); setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); chooseResinPrinterBrand(brand); };
  const filterResinMaterialsByType = (type: string) => { clearCategoryMenuFilters(); setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); chooseResinType(type); };
  const filterResinMaterialsByBrand = (brand: string) => { clearCategoryMenuFilters(); setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); chooseResinMaterialBrand(brand); };
  const showAllLaserProducts = () => { clearCategoryMenuFilters(); setCategory("Corte láser"); handleQueryChange("", false); };
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
              {storeMenuGroups.map((group) => (
                <section className={`store-menu-group ${group.label === "Online" ? "is-online" : ""}`} key={group.label} aria-label={`Tiendas: ${group.label}`}>
                  <h3>{group.label}</h3>
                  <div className="store-menu-items">
                    {group.stores.map((store) => (
                      <div className="store-menu-row" key={store.name}>
                        <button type="button" onClick={() => selectStore(store.name)}>
                          <span>{store.name}</span>
                          <small>{store.summary}</small>
                        </button>
                        <a className="store-menu-visit" href={outboundStoreUrl({ store: store.name, url: store.url, source: "store-menu" })} target="_blank" rel="noreferrer" aria-label={`Visitar tienda original de ${store.name}`}>
                          Visitar
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <a href="#como-funciona" onClick={() => setIsStoreMenuOpen(false)}>Cómo funciona</a>
          <a href="#mapa-tiendas" onClick={() => setIsStoreMenuOpen(false)}>Mapa</a>
          <a href="#canje-impresoras" onClick={() => setIsStoreMenuOpen(false)}>Canje</a>
          <a className="printer-guide-trigger" href="/que-impresora-compro" onClick={() => setIsStoreMenuOpen(false)}>¿Qué impresora compro?</a>
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
            <h1>Ruta 3D: Comparador argentino de impresión 3D</h1>
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
                    <input id="search" value={query} onChange={(event) => { clearCategoryMenuFilters(); handleQueryChange(event.target.value); }} aria-label="Buscar productos" />
                  </label>
                  <div className="toolbar comparator-toolbar" aria-label="Orden y ubicación">
                    <div className="segmented">
                      <button type="button" className={sort === "desc" ? "active" : ""} aria-pressed={sort === "desc"} onClick={() => { setSort("desc"); resetVisibleCount(); }}>Mayor precio</button>
                      <button type="button" className={sort === "asc" ? "active" : ""} aria-pressed={sort === "asc"} onClick={() => { setSort("asc"); resetVisibleCount(); }}>Menor precio</button>
                    </div>
                    <label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => { setStockOnly(event.target.checked); resetVisibleCount(); }} />Solo disponibles</label>
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
                <div className="category-menu">
                  <button type="button" className={category === "Impresoras FDM" ? "active" : ""} onClick={() => { clearCategoryMenuFilters(); setCategory("Impresoras FDM"); resetVisibleCount(); openMobileCategoryPanel("printer"); }}>
                    <CategoryIcon type="printer" />Impresoras FDM
                  </button>
                  <div className="mega-menu" aria-label="Marcas de impresoras FDM">
                    <p>Marcas</p>
                    {fdmBrands.map((brand) => (
                      <CategoryFilterOption key={brand} label={brand} selected={selectedPrinterBrands.includes(brand)} onReplace={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); selectPrinterBrand(brand); }} onToggle={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); togglePrinterBrand(brand); }}>
                        {brand}
                      </CategoryFilterOption>
                    ))}
                  </div>
                </div>
                <div className="category-menu filament-menu">
                  <button type="button" className={category === "Filamento" || selectedFilamentMenuTerms.length > 0 ? "active" : ""} onClick={() => { if (!selectedFilamentMenuTerms.length) clearCategoryMenuFilters(); setCategory("Filamento"); resetVisibleCount(); openMobileCategoryPanel("filament"); }}>
                    <CategoryIcon type="filament" />Filamento
                  </button>
                  <div className="mega-menu filament-mega-menu" aria-label="Filtros de filamentos">
                    <section>
                      <p>Materiales</p>
                      {materialMenuOptions.map((material) => {
                        const isSelected = selectedFilamentMenuTerms.includes(material);

                        return <CategoryFilterOption key={material} label={material} selected={isSelected} onReplace={() => replaceFilamentMenuTerm(material)} onToggle={() => toggleFilamentMenuTerm(material)}>{material}</CategoryFilterOption>;
                      })}
                    </section>
                    <section className="technical-material-section">
                      <p>Técnicos</p>
                      {technicalFilamentMaterials.map((material) => <CategoryFilterOption key={material} label={material} selected={selectedFilamentMenuTerms.includes(material)} onReplace={() => replaceFilamentMenuTerm(material)} onToggle={() => toggleFilamentMenuTerm(material)}>{material}</CategoryFilterOption>)}
                    </section>
                    <section>
                      <p>Marcas</p>
                      {filamentBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allFilamentBrandsSelected && selectedFilamentBrands.includes(brand)} onReplace={() => { setCategory("Filamento"); selectFilamentBrand(brand); }} onToggle={() => { setCategory("Filamento"); chooseFilamentBrand(brand); }}>{brand}</CategoryFilterOption>)}
                    </section>
                    <section>
                      <p>Colores</p>
                      {filamentColors.map(([color, hex]) => <CategoryFilterOption key={color} label={color} selected={!allFilamentColorsSelected && selectedFilamentColors.includes(color)} onReplace={() => { setCategory("Filamento"); selectFilamentColor(color); }} onToggle={() => { setCategory("Filamento"); chooseFilamentColor(color); }}><i className="color-dot" style={{ backgroundColor: hex }} />{color}</CategoryFilterOption>)}
                    </section>
                    <section>
                      <p>Kilos</p>
                      {filamentWeightOptions.map((weight) => <CategoryFilterOption key={weight} label={filamentWeightLabels[weight]} selected={!allFilamentWeightsSelected && selectedFilamentWeights.includes(weight)} onReplace={() => { setCategory("Filamento"); selectFilamentWeight(weight); }} onToggle={() => { setCategory("Filamento"); chooseFilamentWeight(weight); }}>{filamentWeightLabels[weight]}</CategoryFilterOption>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu parts-menu">
                  <button type="button" className={category === "Repuestos" || category === "Accesorios" || category === "Insumos" || selectedSpareParts.length > 0 || selectedSpareBrands.length > 0 ? "active" : ""} onClick={() => { if (!selectedSpareParts.length && !selectedSpareBrands.length) clearCategoryMenuFilters(); setCategory("Repuestos"); resetVisibleCount(); openMobileCategoryPanel("parts"); }}>
                    <CategoryIcon type="parts" /><span>Partes y Repuestos</span>
                  </button>
                  <div className="mega-menu parts-mega-menu" aria-label="Filtros de partes y repuestos">
                    <div className="parts-menu-intro">
                      <strong>Elegí repuesto y marca</strong>
                      <span>{selectedSpareParts.length || selectedSpareBrands.length ? [...selectedSpareParts, ...selectedSpareBrands.map(({ brand }) => brand)].join(" + ") : "Combiná ambos filtros para afinar la búsqueda."}</span>
                    </div>
                    {sparePartGroups.map((group) => (
                      <section key={group.label}>
                        <p>{group.label}</p>
                        {group.parts.map(([label, term]) => <CategoryFilterOption key={term} label={label} selected={selectedSpareParts.includes(term)} onReplace={() => replaceSparePart(term)} onToggle={() => toggleSparePart(term)}>{label}</CategoryFilterOption>)}
                      </section>
                    ))}
                    <section className="parts-brand-section">
                      <p>Marcas FDM</p>
                      {printerAccessoryBrands.map((brand) => {
                        const isDisabled = !spareBrandHasResults(brand, "fdm");

                        return <CategoryFilterOption key={brand} label={brand} selected={selectedSpareBrands.some((selection) => selection.brand === brand && selection.family === "fdm")} disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onReplace={() => replaceSpareBrand(brand, "fdm")} onToggle={() => toggleSpareBrand(brand, "fdm")}>{brand}</CategoryFilterOption>;
                      })}
                    </section>
                    <section className="parts-brand-section">
                      <p>Marcas resina</p>
                      {availableResinPrinterBrands.map((brand) => {
                        const isDisabled = !spareBrandHasResults(brand, "resin");

                        return <CategoryFilterOption key={brand} label={brand} selected={selectedSpareBrands.some((selection) => selection.brand === brand && selection.family === "resin")} disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onReplace={() => replaceSpareBrand(brand, "resin")} onToggle={() => toggleSpareBrand(brand, "resin")}>{brand}</CategoryFilterOption>;
                      })}
                    </section>
                  </div>
                </div>
                <div className="category-menu resin-menu">
                  <button type="button" className={isResinSearch ? "active" : ""} onClick={() => { if (selectedCuringBrands.length) prepareMenuFilter("Curadoras"); else showAllResinMaterials(); openMobileCategoryPanel("resin"); }}>
                    <CategoryIcon type="resin" />Resina
                  </button>
                  <div className="mega-menu resin-mega-menu" aria-label="Filtros de resina">
                    <div className="resin-menu-intro">
                      <strong>Elegí marca y material de resina</strong>
                    </div>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinPrinters}>Impresoras de resina</button>
                      {availableResinPrinterBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allResinPrinterBrandsSelected && selectedResinPrinterBrands.includes(brand)} onReplace={() => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); selectResinPrinterBrand(brand); }} onToggle={() => filterResinPrintersByBrand(brand)}>{brand}</CategoryFilterOption>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllCuringMachines}>Curadoras</button>
                      {availableCuringBrands.map((brand) => {
                        const selected = selectedCuringBrands.includes(brand);

                        return <CategoryFilterOption key={brand} label={brand} selected={selected} onReplace={() => replaceCuringBrand(brand)} onToggle={() => toggleCuringBrand(brand)}>{brand}</CategoryFilterOption>;
                      })}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinMaterials}>Materiales de resina</button>
                      {resinTypeOptions.map((type) => <CategoryFilterOption key={type} label={type} selected={!allResinTypesSelected && selectedResinTypes.includes(type)} onReplace={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectResinType(type); }} onToggle={() => filterResinMaterialsByType(type)}>{type}</CategoryFilterOption>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={showAllResinMaterials}>Marcas de resina</button>
                      {availableResinMaterialBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allResinMaterialBrandsSelected && selectedResinMaterialBrands.includes(brand)} onReplace={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinTypes(); selectResinMaterialBrand(brand); }} onToggle={() => filterResinMaterialsByBrand(brand)}>{brand}</CategoryFilterOption>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu laser-menu">
                  <button type="button" className={isLaserSearch ? "active" : ""} onClick={() => { if (selectedLaserTerms.length) prepareMenuFilter("Corte láser"); else showAllLaserProducts(); openMobileCategoryPanel("laser"); }}>
                    <CategoryIcon type="laser" />Corte láser
                  </button>
                  <div className="mega-menu laser-mega-menu" aria-label="Filtros de corte láser">
                    {laserGroups.map((group) => (
                      <section key={group.label}>
                        <button className="menu-section-trigger" type="button" onClick={showAllLaserProducts}>{group.label}</button>
                        {group.items.map(([label, term]) => {
                          const selected = selectedLaserTerms.includes(term);

                          return <CategoryFilterOption key={term} label={label} selected={selected} onReplace={() => replaceLaserTerm(term)} onToggle={() => toggleLaserTerm(term)}>{label}</CategoryFilterOption>;
                        })}
                      </section>
                    ))}
                    <section className="parts-brand-section laser-brand-section">
                      <p>Marcas de corte láser</p>
                      {availableLaserBrands.map((brand) => {
                        const selected = selectedLaserTerms.includes(brand);

                        return <CategoryFilterOption key={brand} label={brand} selected={selected} onReplace={() => replaceLaserTerm(brand)} onToggle={() => toggleLaserTerm(brand)}>{brand}</CategoryFilterOption>;
                      })}
                    </section>
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
                            <summary>Materiales</summary>
                            <div className="mobile-filter-options">
                              {materialMenuOptions.map((material) => {
                                const isSelected = selectedFilamentMenuTerms.includes(material);

                                return <CategoryFilterOption key={material} label={material} selected={isSelected} onReplace={() => replaceFilamentMenuTerm(material)} onToggle={() => toggleFilamentMenuTerm(material)}>{material}</CategoryFilterOption>;
                              })}
                            </div>
                          </details>
                          <details>
                            <summary>Técnicos</summary>
                            <div className="mobile-filter-options is-technical">
                              {technicalFilamentMaterials.map((material) => <CategoryFilterOption key={material} label={material} selected={selectedFilamentMenuTerms.includes(material)} onReplace={() => replaceFilamentMenuTerm(material)} onToggle={() => toggleFilamentMenuTerm(material)}>{material}</CategoryFilterOption>)}
                            </div>
                          </details>
                          <details>
                            <summary>Marcas</summary>
                            <div className="mobile-filter-options">
                              {filamentBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allFilamentBrandsSelected && selectedFilamentBrands.includes(brand)} onReplace={() => { setCategory("Filamento"); selectFilamentBrand(brand); }} onToggle={() => { setCategory("Filamento"); chooseFilamentBrand(brand); }}>{brand}</CategoryFilterOption>)}
                            </div>
                          </details>
                          <details>
                            <summary>Colores</summary>
                            <div className="mobile-filter-options">
                              {filamentColors.map(([color, hex]) => <CategoryFilterOption key={color} label={color} selected={!allFilamentColorsSelected && selectedFilamentColors.includes(color)} onReplace={() => { setCategory("Filamento"); selectFilamentColor(color); }} onToggle={() => { setCategory("Filamento"); chooseFilamentColor(color); }}><i className="color-dot" style={{ backgroundColor: hex }} />{color}</CategoryFilterOption>)}
                            </div>
                          </details>
                          <details>
                            <summary>Kilos</summary>
                            <div className="mobile-filter-options">
                              {filamentWeightOptions.map((weight) => <CategoryFilterOption key={weight} label={filamentWeightLabels[weight]} selected={!allFilamentWeightsSelected && selectedFilamentWeights.includes(weight)} onReplace={() => { setCategory("Filamento"); selectFilamentWeight(weight); }} onToggle={() => { setCategory("Filamento"); chooseFilamentWeight(weight); }}>{filamentWeightLabels[weight]}</CategoryFilterOption>)}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "resin" ? (
                        <>
                          <div className="mobile-parts-summary">
                            <strong>Elegí marca y material de resina</strong>
                          </div>
                          <details open>
                            <summary>Impresoras de resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinPrinterBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allResinPrinterBrandsSelected && selectedResinPrinterBrands.includes(brand)} onReplace={() => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); selectResinPrinterBrand(brand); }} onToggle={() => filterResinPrintersByBrand(brand)}>{brand}</CategoryFilterOption>)}
                            </div>
                          </details>
                          <details>
                            <summary>Curadoras</summary>
                            <div className="mobile-filter-options">
                              {availableCuringBrands.map((brand) => {
                                const selected = selectedCuringBrands.includes(brand);

                                return <CategoryFilterOption key={brand} label={brand} selected={selected} onReplace={() => replaceCuringBrand(brand)} onToggle={() => toggleCuringBrand(brand)}>{brand}</CategoryFilterOption>;
                              })}
                            </div>
                          </details>
                          <details>
                            <summary>Materiales de resina</summary>
                            <div className="mobile-filter-options">
                              {resinTypeOptions.map((type) => <CategoryFilterOption key={type} label={type} selected={!allResinTypesSelected && selectedResinTypes.includes(type)} onReplace={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinMaterialBrands(); selectResinType(type); }} onToggle={() => filterResinMaterialsByType(type)}>{type}</CategoryFilterOption>)}
                            </div>
                          </details>
                          <details>
                            <summary>Marcas de resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinMaterialBrands.map((brand) => <CategoryFilterOption key={brand} label={brand} selected={!allResinMaterialBrandsSelected && selectedResinMaterialBrands.includes(brand)} onReplace={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); selectAllResinTypes(); selectResinMaterialBrand(brand); }} onToggle={() => filterResinMaterialsByBrand(brand)}>{brand}</CategoryFilterOption>)}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "parts" ? (
                        <>
                          <div className="mobile-parts-summary">
                            <strong>{selectedSpareParts.length || selectedSpareBrands.length ? [...selectedSpareParts, ...selectedSpareBrands.map(({ brand }) => brand)].join(" + ") : "Combiná repuesto y marca para afinar."}</strong>
                          </div>
                          {sparePartGroups.map((group, index) => (
                            <details key={group.label} open={index === 0}>
                              <summary>{group.label}</summary>
                              <div className="mobile-filter-options">
                                {group.parts.map(([label, term]) => <CategoryFilterOption key={term} label={label} selected={selectedSpareParts.includes(term)} onReplace={() => replaceSparePart(term)} onToggle={() => toggleSparePart(term)}>{label}</CategoryFilterOption>)}
                              </div>
                            </details>
                          ))}
                          <details>
                            <summary>Marcas FDM</summary>
                            <div className="mobile-filter-options">
                              {printerAccessoryBrands.map((brand) => {
                                const isDisabled = !spareBrandHasResults(brand, "fdm");

                                return <CategoryFilterOption key={brand} label={brand} selected={selectedSpareBrands.some((selection) => selection.brand === brand && selection.family === "fdm")} disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onReplace={() => replaceSpareBrand(brand, "fdm")} onToggle={() => toggleSpareBrand(brand, "fdm")}>{brand}</CategoryFilterOption>;
                              })}
                            </div>
                          </details>
                          <details>
                            <summary>Marcas resina</summary>
                            <div className="mobile-filter-options">
                              {availableResinPrinterBrands.map((brand) => {
                                const isDisabled = !spareBrandHasResults(brand, "resin");

                                return <CategoryFilterOption key={brand} label={brand} selected={selectedSpareBrands.some((selection) => selection.brand === brand && selection.family === "resin")} disabled={isDisabled} title={isDisabled ? "No hay productos para este filtro" : undefined} onReplace={() => replaceSpareBrand(brand, "resin")} onToggle={() => toggleSpareBrand(brand, "resin")}>{brand}</CategoryFilterOption>;
                              })}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "laser" ? (
                        <>
                          {laserGroups.map((group, index) => (
                            <details key={group.label} open={index === 0}>
                              <summary>{group.label}</summary>
                              <div className="mobile-filter-options">
                                {group.items.map(([label, term]) => {
                                  const selected = selectedLaserTerms.includes(term);

                                  return <CategoryFilterOption key={term} label={label} selected={selected} onReplace={() => replaceLaserTerm(term)} onToggle={() => toggleLaserTerm(term)}>{label}</CategoryFilterOption>;
                                })}
                              </div>
                            </details>
                          ))}
                          <details>
                            <summary>Marcas de corte láser</summary>
                            <div className="mobile-filter-options">
                              {availableLaserBrands.map((brand) => {
                                const selected = selectedLaserTerms.includes(brand);

                                return <CategoryFilterOption key={brand} label={brand} selected={selected} onReplace={() => replaceLaserTerm(brand)} onToggle={() => toggleLaserTerm(brand)}>{brand}</CategoryFilterOption>;
                              })}
                            </div>
                          </details>
                        </>
                      ) : null}

                      {mobileCategoryPanel === "printer" ? (
                        <>
                          <details open>
                            <summary>Tipo</summary>
                            <div className="mobile-filter-options">
                              {printerFrameOptions.map((frame) => <CategoryFilterOption key={frame} label={frame} selected={selectedPrinterFrames.includes(frame)} onReplace={() => { setCategory("Impresoras FDM"); selectPrinterFrame(frame); }} onToggle={() => { setCategory("Impresoras FDM"); togglePrinterFrame(frame); }}>{frame}</CategoryFilterOption>)}
                            </div>
                            <div className="mobile-filter-options">
                              <CategoryFilterOption label="Entrega inmediata" selected={showImmediate} onReplace={() => { setCategory("Impresoras FDM"); setShowImmediate(true); setShowPreorder(false); resetVisibleCount(); }} onToggle={() => { setCategory("Impresoras FDM"); setShowImmediate(!showImmediate); resetVisibleCount(); }}>Entrega inmediata</CategoryFilterOption>
                              <CategoryFilterOption label="Preventa" selected={showPreorder} onReplace={() => { setCategory("Impresoras FDM"); setShowImmediate(false); setShowPreorder(true); resetVisibleCount(); }} onToggle={() => { setCategory("Impresoras FDM"); setShowPreorder(!showPreorder); resetVisibleCount(); }}>Preventa</CategoryFilterOption>
                            </div>
                          </details>
                          <details>
                            <summary>Marcas</summary>
                            <div className="mobile-filter-options">
                              {fdmBrands.map((brand) => (
                                <CategoryFilterOption key={brand} label={brand} selected={selectedPrinterBrands.includes(brand)} onReplace={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); selectPrinterBrand(brand); }} onToggle={() => { setCategory("Impresoras FDM"); handleQueryChange("", false); togglePrinterBrand(brand); }}>
                                  {brand}
                                </CategoryFilterOption>
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
                    {visibleProducts.length || showsFilterSidebar || isCatalogLoading || hasCatalogLoadError ? (
                      <div className={showsFilterSidebar ? "filament-search-layout" : undefined}>
                        {showsFilterSidebar ? (
                          <aside className="filament-filter-sidebar" aria-label={isPrinterSearch ? "Filtrar impresoras" : isResinMaterialSearch ? "Filtrar resinas" : "Filtrar filamentos"}>
                            <div className="filament-filter-title"><h3>Filtrar</h3><button type="button" onClick={resetFilters}>Limpiar</button></div>
                            <details open><summary>Precio</summary><div className="filter-price-range"><div className="price-filter-heading"><strong>{priceRangeLabel(priceMin, priceMax)}</strong><button type="button" onClick={clearPriceBounds}>Limpiar</button></div><div className="dual-range"><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMinSliderValue} onChange={(event) => setPriceMin(Number(event.target.value))} aria-label="Precio mínimo" /><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMaxSliderValue} onChange={(event) => setPriceMax(Number(event.target.value))} aria-label="Precio máximo" /></div><div className="price-range-scale"><span>{priceSlider.start}</span><span>{priceSlider.middle}</span><span>{priceSlider.end}</span></div><div className="price-inputs"><label><span>Mínimo</span><input inputMode="numeric" value={priceMin ?? ""} placeholder={String(priceSlider.min)} onChange={(event) => setPriceMin(parsePriceInput(event.target.value))} /></label><label><span>Máximo</span><input inputMode="numeric" value={priceMax ?? ""} placeholder={String(priceSlider.max)} onChange={(event) => setPriceMax(parsePriceInput(event.target.value))} /></label></div></div></details>
                            {isFdmPrinterSearch ? <details open><summary>Tipo</summary><div className="filter-actions"><button type="button" onClick={selectAllPrinterFrames}>Todas</button><button type="button" onClick={clearPrinterFrames}>Ninguna</button></div><div className="filter-options">{printerFrameOptions.map((frame) => <label key={frame}><input type="checkbox" checked={selectedPrinterFrames.includes(frame)} onChange={() => togglePrinterFrame(frame)} /><span>{frame}</span></label>)}</div><div className="filter-actions"><button type="button" onClick={() => { setShowPreorder(true); setShowImmediate(true); resetVisibleCount(); }}>Toda disponibilidad</button></div><div className="filter-options"><label><input type="checkbox" checked={showImmediate} onChange={(event) => { setShowImmediate(event.target.checked); resetVisibleCount(); }} /><span>Entrega inmediata</span></label><label><input type="checkbox" checked={showPreorder} onChange={(event) => { setShowPreorder(event.target.checked); resetVisibleCount(); }} /><span>Preventa</span></label></div><p className="filament-color-note">Al filtrar por tipo se muestran solo modelos detectados en esa característica. Las preventas quedan identificadas para no compararlas como compra inmediata.</p></details> : null}
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
                        {isCatalogLoading ? (
                          <p className="search-results-empty">Cargando el catálogo actualizado...</p>
                        ) : hasCatalogLoadError ? (
                          <p className="search-results-empty">No pudimos cargar el catálogo. Recargá la página y volvé a intentar.</p>
                        ) : visibleProducts.length ? visibleProducts.map((product) => (
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
                              <div className="product-search-image" style={{ backgroundColor: product.image ? product.color : undefined }}>
                                {product.image ? (
                                  <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 44vw, (max-width: 1100px) 28vw, 20vw" />
                                ) : (
                                  <span className="product-image-fallback">
                                    <CategoryIcon type={productFallbackIconType(product)} />
                                    <b>Sin foto</b>
                                    <small>{productFallbackLabel(product)}</small>
                                  </span>
                                )}
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
            <p>Locales conectados sobre el mapa de Argentina y tiendas online separadas para elegir dónde conviene comprar o retirar.</p>
          </div>
          <button type="button" onClick={() => { setStore("Todas"); resetVisibleCount(); document.getElementById("comparador")?.scrollIntoView({ behavior: "smooth" }); }}>
            Ver todas las tiendas
          </button>
        </div>

        <div className="store-map-layout">
          <StoreMap physicalStores={storeMapGuide.physicalStores} onSelectStore={selectStore} />

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

      <section id="canje-impresoras" className="trade-in-section" aria-labelledby="trade-in-title">
        <div className="trade-in-copy">
          <span>Renová equipo</span>
          <h2 id="trade-in-title">Canje de impresoras 3D</h2>
          <p>Algunas tiendas reciben tu impresora usada como parte de pago y descuentan ese valor de otra impresora. La tasación, el estado aceptado y las condiciones finales se confirman directamente con cada comercio.</p>
        </div>
        <div className="trade-in-stores" aria-label="Tiendas con canje de impresoras 3D">
          {printerTradeInStores.map((tradeInStore) => (
            <article className="trade-in-card" key={tradeInStore.name}>
              <div>
                <span>{tradeInStore.area}</span>
                <h3>{tradeInStore.name}</h3>
                <p>{tradeInStore.note}</p>
              </div>
              <div className="trade-in-actions">
                <button type="button" onClick={() => { setStore(tradeInStore.name); setCategory("Impresoras FDM"); resetVisibleCount(); document.getElementById("comparador")?.scrollIntoView({ behavior: "smooth" }); }}>
                  Ver impresoras
                </button>
                <a href={outboundStoreUrl({ store: tradeInStore.name, url: storeLinkByName.get(tradeInStore.name) ?? "", source: "trade-in" })} target="_blank" rel="noreferrer">
                  Consultar canje
                </a>
              </div>
            </article>
          ))}
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
