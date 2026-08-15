"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FilamentWeightGroup, Product } from "@/lib/catalog";
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
  stores: string[];
  catalogFreshness: {
    productCount: number;
    storeCount: number;
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

const fdmBrands = ["Bambu Lab", "Creality", "Elegoo", "Flashforge", "Snapmaker", "Anycubic", "Artillery", "Hellbot"];
const printerAccessoryBrands = ["Bambu Lab", "Creality", "Elegoo", "Flashforge", "Anycubic", "Prusa", "Artillery", "Ender", "Snapmaker"];
const sparePartGroups = [
  {
    label: "Hotend y extrusión",
    parts: [["Boquillas", "boquilla"], ["Nozzles", "nozzle"], ["Hotends", "hotend"], ["Extrusores", "extrusor"]],
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
const resinPrinterBrands = ["Anycubic", "Elegoo", "Creality", "Uniformation"];
const plaVariants = ["PLA", "PLA Flex", "PLA Silk", "PLA Art", "PLA Wood"];
const technicalFilamentMaterials = ["ABS", "ASA", "NYLON", "PC", "PVC", "PVA", "PEBA", "PA6-GF", "PPA-CF"];
const technicalFilamentMaterialSet = new Set(technicalFilamentMaterials);
const filamentColors = [
  ["Negro", "#202020"], ["Blanco", "#f6f3eb"], ["Gris", "#8b9196"], ["Rojo", "#d94343"],
  ["Naranja", "#e98432"], ["Amarillo", "#e9c52b"], ["Verde", "#39a95d"], ["Azul", "#427fd2"], ["Natural", "#dfc89f"],
] as const;
const filamentWeightLabels: Record<FilamentWeightGroup, string> = {
  "0.25": "0.250 kg",
  "0.5": "0.5 kg",
  "1": "1 kg",
  over1: "Más de 1 kg",
};
const themeChangeEvent = "filtrar-3d-theme-change";
const savedProductsStorageKey = "filtrar-3d-saved-products";

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
  const numericValue = Number(value.replace(/\D/g, ""));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function availableBrands(products: Product[], predicate: (product: Product) => boolean, preferredOrder: string[] = []) {
  const brands = [...new Set(products.filter(predicate).map((product) => product.brand).filter((brand): brand is string => Boolean(brand) && brand !== unknownBrandLabel))];
  const preferred = preferredOrder.filter((brand) => brands.includes(brand));
  const remaining = brands.filter((brand) => !preferredOrder.includes(brand)).sort((a, b) => a.localeCompare(b, "es"));

  return [...preferred, ...remaining];
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
    query,
    resetFilters,
    resetVisibleCount,
    setCategory,
    setStore,
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
    setStockOnly,
    sort,
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
  const showsResults = hasSearchQuery || category !== "Todas";
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
  const appliedFilters = [
    category !== "Todas" ? category : null,
    sort === "asc" ? "Menor precio" : sort === "desc" ? "Mayor precio" : null,
    stockOnly ? "Solo disponibles" : null,
    selectedFilamentBrands.length !== filamentBrands.length ? `${selectedFilamentBrands.length} marcas` : null,
    selectedFilamentMaterials.length !== defaultFilamentMaterialCount || selectedFilamentMaterials.includes("Lápiz 3D") ? `${selectedFilamentMaterials.length} materiales` : null,
    selectedFilamentColors.length !== filamentColors.length ? `${selectedFilamentColors.length} colores` : null,
    selectedFilamentWeights.length !== filamentWeightOptions.length ? `${selectedFilamentWeights.length} pesos` : null,
    priceMin !== null || priceMax !== null ? priceRangeLabel(priceMin, priceMax) : null,
    isFdmPrinterSearch && selectedPrinterBrands.length ? `${selectedPrinterBrands.length} marcas FDM` : null,
    isFdmPrinterSearch && selectedPrinterFrames.length !== printerFrameOptions.length ? selectedPrinterFrames.join(", ") : null,
    isResinPrinterSearch && selectedResinPrinterBrands.length !== availableResinPrinterBrands.length ? `${selectedResinPrinterBrands.length} marcas de resina` : null,
    isResinMaterialSearch && selectedResinMaterialBrands.length !== availableResinMaterialBrands.length ? `${selectedResinMaterialBrands.length} marcas de resina` : null,
    isResinMaterialSearch && selectedResinTypes.length !== resinTypeOptions.length ? `${selectedResinTypes.length} tipos` : null,
  ].filter((filter): filter is string => Boolean(filter));

  const updateSparePartSearch = (part: string | null, brand: string | null, family: "fdm" | "resin" | null, nextCategory = "Repuestos") => {
    setCategory(nextCategory);
    handleQueryChange([part, brand, family === "resin" ? "resina" : null].filter((value): value is string => Boolean(value)).join(" "), false);
  };

  const selectSparePart = (part: string, nextCategory = "Repuestos") => {
    const nextPart = selectedSparePart === part ? null : part;
    setSelectedSparePart(nextPart);
    updateSparePartSearch(nextPart, selectedSpareBrand, selectedSpareFamily, nextCategory);
  };

  const selectSpareBrand = (brand: string, family: "fdm" | "resin") => {
    const nextBrand = selectedSpareBrand === brand && selectedSpareFamily === family ? null : brand;
    const nextFamily = nextBrand ? family : null;
    setSelectedSpareBrand(nextBrand);
    setSelectedSpareFamily(nextFamily);
    updateSparePartSearch(selectedSparePart, nextBrand, nextFamily);
  };

  const resetAllFilters = () => {
    setSelectedSparePart(null);
    setSelectedSpareBrand(null);
    setSelectedSpareFamily(null);
    resetFilters();
  };
  const savedProductIdSet = useMemo(() => new Set(savedProductIds), [savedProductIds]);
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const savedProducts = savedProductIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product));
  const newestScrapeLabel = dateLabel(catalogFreshness.newestScrapedAt);
  const oldestScrapeLabel = dateLabel(catalogFreshness.oldestScrapedAt);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(savedProductsStorageKey) ?? "[]");
        if (Array.isArray(saved)) setSavedProductIds(saved.filter((id) => typeof id === "string"));
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

  const toggleSavedProduct = (product: Product) => {
    const id = String(product.id);
    setSavedProductIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [id, ...current]);
  };

  return (
    <main id="inicio" className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      <header className="site-header">
        <div className="site-header-main">
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
            <a className="header-contact" href="mailto:lok3d.co@gmail.com">Contacto</a>
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
                <button key={store} type="button" onClick={() => { setStore(store); setIsStoreMenuOpen(false); document.getElementById("comparador")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {store}
                </button>
              ))}
            </div>
          </div>
          <a href="#como-funciona">Cómo funciona</a>
          <a className="printer-guide-trigger" href="/que-impresora-compro">¿Qué impresora compro?</a>
          <a href="#transparencia">Precios y stock</a>
          <a href="#sumar-tienda">Sumá tu tienda</a>
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
                    <a href={product.url} target="_blank" rel="noreferrer">
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
            <p className="hero-trust-line">
              {count.format(catalogFreshness.productCount)} ofertas reales de {catalogFreshness.storeCount} tiendas conectadas. Datos actualizados entre {oldestScrapeLabel} y {newestScrapeLabel}.
            </p>
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
                      <button type="button" className={sort === "asc" ? "active" : ""} aria-pressed={sort === "asc"} onClick={() => { setSort((current) => current === "asc" ? null : "asc"); resetVisibleCount(); }}>Menor precio</button>
                    </div>
                    <label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => { setStockOnly(event.target.checked); resetVisibleCount(); }} />Solo disponibles</label>
                    <button type="button" className="search-reset-button" onClick={resetAllFilters} disabled={!hasActiveFilters}>Limpiar filtros</button>
                  </div>
                  {appliedFilters.length ? <div className="active-search-filters" aria-label="Filtros aplicados">{appliedFilters.map((filter) => <span key={filter}>{filter}</span>)}</div> : null}
                </div>
                <span className="flag-dot" aria-hidden="true" />
              </header>

              <div className="category-tabs" aria-label="Categorías">
                <div className="category-menu filament-menu">
                  <button type="button" className={category === "Filamento" ? "active" : ""} onClick={() => { setCategory("Filamento"); resetVisibleCount(); }}>
                    <CategoryIcon type="filament" />Filamento
                  </button>
                  <div className="mega-menu filament-mega-menu" aria-label="Filtros de filamentos">
                    <section>
                      <p>Materiales</p>
                      {materialMenuOptions.map((material) => {
                        const isPlaVariant = material.startsWith("PLA") && material !== "PLA";

                        return <button key={material} type="button" className={isPlaVariant ? query.toLowerCase() === material.toLowerCase() ? "selected" : "" : selectedFilamentMaterials.length === 1 && selectedFilamentMaterials[0] === material ? "selected" : ""} onClick={() => { setCategory("Filamento"); if (isPlaVariant) handleQueryChange(material, false); else { handleQueryChange("", false); selectFilamentMaterial(material); } }}>{material}</button>;
                      })}
                    </section>
                    <section className="technical-material-section">
                      <p>Técnicos</p>
                      {technicalFilamentMaterials.map((material) => <button key={material} type="button" className={selectedFilamentMaterials.length === 1 && selectedFilamentMaterials[0] === material ? "selected" : ""} onClick={() => { setCategory("Filamento"); handleQueryChange("", false); selectFilamentMaterial(material); }}>{material}</button>)}
                    </section>
                    <section>
                      <p>Marcas</p>
                      {filamentBrands.map((brand) => <button key={brand} type="button" className={selectedFilamentBrands.length === 1 && selectedFilamentBrands[0] === brand ? "selected" : ""} onClick={() => { setCategory("Filamento"); selectFilamentBrand(brand); }}>{brand}</button>)}
                    </section>
                    <section>
                      <p>Colores</p>
                      {filamentColors.map(([color, hex]) => <button key={color} type="button" className={selectedFilamentColors.includes(color) ? "selected" : ""} onClick={() => { setCategory("Filamento"); selectFilamentColor(color); }}><i className="color-dot" style={{ backgroundColor: hex }} />{color}</button>)}
                    </section>
                    <section>
                      <p>Kilos</p>
                      {filamentWeightOptions.map((weight) => <button key={weight} type="button" className={selectedFilamentWeights.length === 1 && selectedFilamentWeights[0] === weight ? "selected" : ""} onClick={() => { setCategory("Filamento"); selectFilamentWeight(weight); }}>{filamentWeightLabels[weight]}</button>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu resin-menu">
                  <button type="button" className={isResinSearch ? "active" : ""} onClick={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); }}>
                    <CategoryIcon type="resin" />Resina
                  </button>
                  <div className="mega-menu resin-mega-menu" aria-label="Filtros de resina">
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={() => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectAllResinPrinterBrands(); }}>Impresoras de resina</button>
                      {availableResinPrinterBrands.map((brand) => <button key={brand} type="button" className={selectedResinPrinterBrands.length === 1 && selectedResinPrinterBrands[0] === brand ? "selected" : ""} onClick={() => { setCategory("Impresoras de Resina"); handleQueryChange("", false); selectResinPrinterBrand(brand); }}>{brand}</button>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={() => { setCategory("Curadoras"); handleQueryChange("", false); }}>Curadoras</button>
                      {availableCuringBrands.map((brand) => <button key={brand} type="button" onClick={() => { setCategory("Curadoras"); handleQueryChange(`${brand} curado`, false); }}>{brand}</button>)}
                    </section>
                    <section>
                      <button className="menu-section-trigger" type="button" onClick={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinMaterialBrands(); selectAllResinTypes(); }}>Resina</button>
                      {resinTypeOptions.map((type) => <button key={type} type="button" className={selectedResinTypes.length === 1 && selectedResinTypes[0] === type ? "selected" : ""} onClick={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinTypes(); selectResinType(type); }}>{type}</button>)}
                      {availableResinMaterialBrands.map((brand) => <button key={brand} type="button" className={selectedResinMaterialBrands.length === 1 && selectedResinMaterialBrands[0] === brand ? "selected" : ""} onClick={() => { setCategory("Resina"); handleQueryChange("", false); selectAllResinTypes(); selectResinMaterialBrand(brand); }}>{brand}</button>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu parts-menu">
                  <button type="button" className={category === "Repuestos" || category === "Accesorios" ? "active" : ""} onClick={() => { setCategory("Repuestos"); resetVisibleCount(); }}>
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
                      {printerAccessoryBrands.map((brand) => <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "fdm" ? "selected" : ""} onClick={() => selectSpareBrand(brand, "fdm")}>{brand}</button>)}
                    </section>
                    <section className="parts-brand-section">
                      <p>Marcas resina</p>
                      {availableResinPrinterBrands.map((brand) => <button key={brand} type="button" className={selectedSpareBrand === brand && selectedSpareFamily === "resin" ? "selected" : ""} onClick={() => selectSpareBrand(brand, "resin")}>{brand}</button>)}
                    </section>
                  </div>
                </div>
                <div className="category-menu">
                  <button type="button" className={category === "Impresoras FDM" ? "active" : ""} onClick={() => { setCategory("Impresoras FDM"); resetVisibleCount(); }}>
                    <CategoryIcon type="printer" />Impresoras FDM
                  </button>
                  <div className="mega-menu" aria-label="Marcas de impresoras FDM">
                    <p>Marcas</p>
                    {fdmBrands.map((brand) => (
                      <button key={brand} type="button" onClick={() => { setCategory("Impresoras FDM"); handleQueryChange(brand, false); }}>
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`comparison-table ${showsResults ? "" : "is-empty"}`} aria-label="Ofertas destacadas" aria-live="polite">
                {showsResults ? (
                  <>
                    <div className="search-results-heading comparator-results-heading">
                      <div>
                        <h2>{hasSearchQuery ? `Resultados para “${query.trim()}”` : `Resultados de ${category}`}</h2>
                        <p>{filtered.length} {filtered.length === 1 ? "producto encontrado" : "productos encontrados"}{selectedColorContext ? <><span aria-hidden="true"> · </span><strong className="results-color-context">{selectedColorContext}</strong></> : null}</p>
                      </div>
                    </div>
                    {visibleProducts.length || showsFilterSidebar ? (
                      <div className={showsFilterSidebar ? "filament-search-layout" : undefined}>
                        {showsFilterSidebar ? (
                          <aside className="filament-filter-sidebar" aria-label={isPrinterSearch ? "Filtrar impresoras" : isResinMaterialSearch ? "Filtrar resinas" : "Filtrar filamentos"}>
                            <div className="filament-filter-title"><h3>Filtrar</h3><button type="button" onClick={resetFilters}>Limpiar</button></div>
                            <details open><summary>Precio</summary><div className="filter-price-range"><div className="price-filter-heading"><strong>{priceRangeLabel(priceMin, priceMax)}</strong><button type="button" onClick={clearPriceBounds}>Limpiar</button></div><div className="dual-range"><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMinSliderValue} onChange={(event) => setPriceMin(Number(event.target.value))} aria-label="Precio mínimo" /><input type="range" min={priceSlider.min} max={priceSlider.max} step={priceSlider.step} value={priceMaxSliderValue} onChange={(event) => setPriceMax(Number(event.target.value))} aria-label="Precio máximo" /></div><div className="price-range-scale"><span>{priceSlider.start}</span><span>{priceSlider.middle}</span><span>{priceSlider.end}</span></div><div className="price-inputs"><label><span>Mínimo</span><input inputMode="numeric" value={priceMin ?? ""} placeholder={String(priceSlider.min)} onChange={(event) => setPriceMin(parsePriceInput(event.target.value))} /></label><label><span>Máximo</span><input inputMode="numeric" value={priceMax ?? ""} placeholder={String(priceSlider.max)} onChange={(event) => setPriceMax(parsePriceInput(event.target.value))} /></label></div></div></details>
                            {isFdmPrinterSearch ? <details open><summary>Tipo</summary><div className="filter-actions"><button type="button" onClick={selectAllPrinterFrames}>Todas</button><button type="button" onClick={clearPrinterFrames}>Ninguna</button></div><div className="filter-options">{printerFrameOptions.map((frame) => <label key={frame}><input type="checkbox" checked={selectedPrinterFrames.includes(frame)} onChange={() => togglePrinterFrame(frame)} /><span>{frame}</span></label>)}</div><p className="filament-color-note">Si no se detecta abierta/cerrada, queda al final para que no se pierda.</p></details> : null}
                            {isFdmPrinterSearch ? <details open><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={clearPrinterBrands}>Todas</button><button type="button" onClick={() => selectAllPrinterBrands(["__none__"])}>Ninguna</button></div><div className="filter-options">{fdmBrands.map((brand) => <label key={brand}><input type="checkbox" checked={!selectedPrinterBrands.length || selectedPrinterBrands.includes(brand)} onChange={() => togglePrinterBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isResinPrinterSearch ? <details open><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllResinPrinterBrands}>Todas</button><button type="button" onClick={clearResinPrinterBrands}>Ninguna</button></div><div className="filter-options">{availableResinPrinterBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedResinPrinterBrands.includes(brand)} onChange={() => toggleResinPrinterBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isResinMaterialSearch ? <details open><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllResinMaterialBrands}>Todas</button><button type="button" onClick={clearResinMaterialBrands}>Ninguna</button></div><div className="filter-options">{availableResinMaterialBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedResinMaterialBrands.includes(brand)} onChange={() => toggleResinMaterialBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isResinMaterialSearch ? <details open><summary>Tipo</summary><div className="filter-actions"><button type="button" onClick={selectAllResinTypes}>Todos</button><button type="button" onClick={clearResinTypes}>Ninguno</button></div><div className="filter-options">{resinTypeOptions.map((type) => <label key={type}><input type="checkbox" checked={selectedResinTypes.includes(type)} onChange={() => toggleResinType(type)} /><span>{type}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details open><summary>Marca</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentBrands}>Todas</button><button type="button" onClick={clearFilamentBrands}>Ninguna</button></div><div className="filter-options">{filamentBrands.map((brand) => <label key={brand}><input type="checkbox" checked={selectedFilamentBrands.includes(brand)} onChange={() => toggleFilamentBrand(brand)} /><span>{brand}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details><summary>Material</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentMaterials}>Todas</button><button type="button" onClick={clearFilamentMaterials}>Ninguna</button></div><div className="filter-options">{filamentMaterials.map((material) => <label key={material}><input type="checkbox" checked={selectedFilamentMaterials.includes(material)} onChange={() => toggleFilamentMaterial(material)} /><span>{material}</span></label>)}</div></details> : null}
                            {isFilamentSearch ? <details><summary>Color</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentColors}>Todas</button><button type="button" onClick={clearFilamentColors}>Ninguna</button></div><div className="filter-options">{filamentColors.map(([color, hex]) => <label key={color}><input type="checkbox" checked={selectedFilamentColors.includes(color)} onChange={() => toggleFilamentColor(color)} /><i className="sidebar-color-dot" style={{ backgroundColor: hex }} /><span>{color}</span></label>)}</div><p className="filament-color-note">Si una tienda no informa el color, su oferta queda al final para que no se pierda.</p></details> : null}
                            {isFilamentSearch ? <details><summary>Kilos</summary><div className="filter-actions"><button type="button" onClick={selectAllFilamentWeights}>Todos</button><button type="button" onClick={clearFilamentWeights}>Ninguno</button></div><div className="filter-options">{filamentWeightOptions.map((weight) => <label key={weight}><input type="checkbox" checked={selectedFilamentWeights.includes(weight)} onChange={() => toggleFilamentWeight(weight)} /><span>{filamentWeightLabels[weight]}</span></label>)}</div><p className="filament-color-note">Si una tienda no informa el peso, su oferta queda al final para que no se pierda.</p></details> : null}
                          </aside>
                        ) : null}
                      <div className="product-search-grid">
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
                            <a className="product-search-link" href={product.url} target="_blank" rel="noreferrer" aria-label={`Ver ${product.name} en ${product.store}`}>
                              <div className="product-search-image" style={{ backgroundColor: product.color }}>
                                {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 44vw, (max-width: 1100px) 28vw, 20vw" /> : <span>{product.category.slice(0, 3).toUpperCase()}</span>}
                              </div>
                              <div className="product-search-copy">
                                <p>{product.store}</p>
                                <h3>{product.name}</h3>
                                {isFilamentSearch && product.isFilament ? <span className={`filament-color-status ${product.filamentColors.length ? "has-color" : "missing-color"}`}>{colorAvailabilityLabel(product)}</span> : null}
                                <strong>{price.format(product.bestPrice)}</strong>
                                <span>{product.transferPrice ? "Transferencia" : "Precio de lista"}</span>
                                {product.stock === "Consultar" ? <b className="product-stock-warning">No disponible</b> : null}
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

      <section className="site-info" aria-label="Información sobre Ruta 3D">
        <div className="site-info-inner">
          <section id="como-funciona" className="info-section">
            <h2>Compará antes de comprar</h2>
            <p>Buscá por producto, marca o material; filtrá por tienda y disponibilidad; después abrí la oferta para completar la compra directamente con el comercio.</p>
          </section>
          <section id="transparencia" className="info-section">
            <h2>Precios y stock de referencia</h2>
            <p>Los valores y la disponibilidad se obtienen de catálogos conectados. Hoy mostramos {count.format(catalogFreshness.productCount)} ofertas de {catalogFreshness.storeCount} tiendas, con datos actualizados entre {oldestScrapeLabel} y {newestScrapeLabel}. El precio final y el stock se confirman en la tienda de destino.</p>
          </section>
          <section className="info-section coffee-section">
            <h2>Invitame un cafecito</h2>
            <p><span className="coffee-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-1M7 4v2M11 3v3M15 4v2" /></svg>Si te sirve Ruta 3D, podés apoyar el proyecto con un cafecito.</span></p>
          </section>
        </div>
        <aside id="sumar-tienda" className="store-cta">
          <div>
            <h2>¿Tenés una tienda de impresión 3D?</h2>
            <p>Queremos sumar comercios argentinos al comparador para que más compradores encuentren sus productos.</p>
          </div>
          <a href="mailto:lok3d.co@gmail.com?subject=Quiero%20sumar%20mi%20tienda%20a%20Ruta%203D">Quiero sumar mi tienda</a>
        </aside>
      </section>
      <footer className="site-footer">
        <p>Ruta 3D compara ofertas; no procesa pagos ni reemplaza la información publicada por cada tienda.</p>
        <div className="site-footer-links">
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
          <a href="#inicio">Volver arriba</a>
        </div>
      </footer>

    </main>
  );
}
