"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { penFilamentMaterial, type FilamentWeightGroup, type PrinterFrameType, type Product, type SortDirection, type StoreArea } from "@/lib/catalog";
import {
  normalizeQuery,
  productMatchesCategory,
  queryTermMatches,
  queryContainsMaterial,
  searchedMaterials,
  unknownBrand,
  unknownMaterial,
} from "@/lib/filter-utils";
import { filamentColorOptions, type FilamentColor } from "@/lib/filament-colors";
import { sanitizeLiveSearchQuery, sanitizeSearchQuery } from "@/lib/security";

export const pageSize = 48;
export const filamentWeightOptions: FilamentWeightGroup[] = ["0.25", "0.5", "1", "over1"];
export const printerFrameOptions: PrinterFrameType[] = ["Abierta", "Cerrada", "Multicolor"];
export { filamentColorOptions } from "@/lib/filament-colors";

export const resinTypeOptions = ["Standard", "Dura", "ABS Like", "Lavable al agua", "Alta velocidad", "Vegetal"];
type NearbyStoreArea = Exclude<StoreArea, "Online">;

function postalCodeNumber(value: string) {
  const match = value.trim().toUpperCase().match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function postalCodeArea(value: string): NearbyStoreArea | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, "");
  const numericCode = postalCodeNumber(normalized);

  if ((normalized.startsWith("X") && numericCode !== null && numericCode >= 5000 && numericCode <= 5999) || (numericCode !== null && numericCode >= 5000 && numericCode <= 5999)) {
    return "Córdoba";
  }

  if ((normalized.startsWith("C") && numericCode !== null && numericCode >= 1000 && numericCode <= 1499) || (numericCode !== null && numericCode >= 1000 && numericCode <= 1499)) {
    return "CABA";
  }

  if ((normalized.startsWith("B") && numericCode !== null && numericCode >= 1900 && numericCode <= 1904) || (numericCode !== null && numericCode >= 1900 && numericCode <= 1904)) {
    return "La Plata";
  }

  return null;
}

function printerMinimumPrice(product: Product) {
  if (product.brand === "Bambu Lab") return 300_000;
  if (product.brand === "Creality") return 350_000;
  return 200_000;
}

function defaultFilamentMaterials(materials: string[]) {
  return materials.filter((material) => material !== penFilamentMaterial);
}

function resinTypeAliases(type: string) {
  if (type === "Standard") return ["standard", "estandar"];
  if (type === "Dura") return ["dura", "durable", "tough"];
  if (type === "ABS Like") return ["abs like", "abs-like", "abs"];
  if (type === "Lavable al agua") return ["lavable al agua", "water washable", "water-washable"];
  if (type === "Alta velocidad") return ["alta velocidad", "high speed", "fast", "rapid"];
  if (type === "Vegetal") return ["vegetal", "plant based", "plant-based", "bio"];

  return [type.toLowerCase()];
}

function productMatchesResinType(product: Product, type: string) {
  const text = product.searchText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  return resinTypeAliases(type).some((alias) => text.includes(alias));
}

function productMatchesPriceBounds(product: Product, min: number | null, max: number | null) {
  return (min === null || product.bestPrice >= min) && (max === null || product.bestPrice <= max);
}

export function useProductFilters(
  products: Product[],
  filamentBrands: string[],
  filamentMaterials: string[],
  resinPrinterBrands: string[] = [],
  resinMaterialBrands: string[] = [],
  initialQuery = "",
) {
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState(sanitizeSearchQuery(initialQuery));
  const [category, setCategory] = useState("Todas");
  const [store, setStore] = useState("Todas");
  const [nearbyPostalCode, setNearbyPostalCodeState] = useState("");
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [sort, setSort] = useState<SortDirection | null>("asc");
  const [stockOnly, setStockOnly] = useState(false);
  const [selectedFilamentBrands, setSelectedFilamentBrands] = useState(filamentBrands);
  const [selectedFilamentMaterials, setSelectedFilamentMaterials] = useState(defaultFilamentMaterials(filamentMaterials));
  const [selectedFilamentColors, setSelectedFilamentColors] = useState<FilamentColor[]>([...filamentColorOptions]);
  const [selectedFilamentWeights, setSelectedFilamentWeights] = useState<FilamentWeightGroup[]>([...filamentWeightOptions]);
  const [priceMin, setPriceMinState] = useState<number | null>(null);
  const [priceMax, setPriceMaxState] = useState<number | null>(null);
  const [selectedPrinterBrands, setSelectedPrinterBrands] = useState<string[]>([]);
  const [selectedPrinterFrames, setSelectedPrinterFrames] = useState<PrinterFrameType[]>([...printerFrameOptions]);
  const [selectedResinPrinterBrands, setSelectedResinPrinterBrands] = useState(resinPrinterBrands);
  const [selectedResinMaterialBrands, setSelectedResinMaterialBrands] = useState(resinMaterialBrands);
  const [selectedResinTypes, setSelectedResinTypes] = useState([...resinTypeOptions]);
  const [openFacet, setOpenFacet] = useState<"brands" | "materials" | null>(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [isLoadingResults, setIsLoadingResults] = useState(true);

  useEffect(() => {
    loadingTimer.current = setTimeout(() => setIsLoadingResults(false), 260);

    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  function pulseResultsLoading() {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
    setIsLoadingResults(true);
    loadingTimer.current = setTimeout(() => setIsLoadingResults(false), 220);
  }

  const selectedFilamentBrandSet = useMemo(
    () => new Set(selectedFilamentBrands),
    [selectedFilamentBrands],
  );
  const queryMaterials = useMemo(() => searchedMaterials(query), [query]);
  const effectiveSelectedFilamentMaterials = queryMaterials.length
    ? queryMaterials
    : selectedFilamentMaterials;
  const nearbyStoreArea = useMemo(() => postalCodeArea(nearbyPostalCode), [nearbyPostalCode]);
  const hasUsablePostalCode = /\d{4}/.test(nearbyPostalCode);
  const hasNoNearbyStores = nearbyOnly && hasUsablePostalCode && nearbyStoreArea === null;
  const selectedFilamentMaterialSet = useMemo(
    () => new Set(effectiveSelectedFilamentMaterials),
    [effectiveSelectedFilamentMaterials],
  );

  function resetVisibleCount() {
    setVisibleCount(pageSize);
    pulseResultsLoading();
  }

  function handleQueryChange(value: string, resetSearchFilters = true) {
    const nextQuery = sanitizeLiveSearchQuery(value);
    setQuery(nextQuery);
    if (resetSearchFilters) {
      setCategory("Todas");
      setStore("Todas");
      setNearbyOnly(false);
      setSort("asc");
      setStockOnly(false);
      setSelectedFilamentBrands(filamentBrands);
      setSelectedFilamentMaterials(defaultFilamentMaterials(filamentMaterials));
      setSelectedFilamentColors([...filamentColorOptions]);
      setSelectedFilamentWeights([...filamentWeightOptions]);
      setPriceMinState(null);
      setPriceMaxState(null);
      setSelectedPrinterBrands([]);
      setSelectedPrinterFrames([...printerFrameOptions]);
      setSelectedResinPrinterBrands(resinPrinterBrands);
      setSelectedResinMaterialBrands(resinMaterialBrands);
      setSelectedResinTypes([...resinTypeOptions]);
      setOpenFacet(null);
    }
    resetVisibleCount();

    if (queryContainsMaterial(nextQuery)) setOpenFacet("materials");
  }

  function toggleFilamentBrand(brand: string) {
    resetVisibleCount();
    setSelectedFilamentBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function toggleFilamentMaterial(material: string) {
    resetVisibleCount();
    setSelectedFilamentMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  function selectFilamentBrand(brand: string) {
    resetVisibleCount();
    setSelectedFilamentBrands([brand]);
  }

  function selectFilamentMaterial(material: string) {
    resetVisibleCount();
    setSelectedFilamentMaterials([material]);
  }

  function selectFilamentColor(color: FilamentColor) {
    resetVisibleCount();
    setSelectedFilamentColors([color]);
  }

  function toggleFilamentColor(color: FilamentColor) {
    resetVisibleCount();
    setSelectedFilamentColors((current) =>
      current.includes(color) ? current.filter((item) => item !== color) : [...current, color],
    );
  }

  function selectAllFilamentColors() { resetVisibleCount(); setSelectedFilamentColors([...filamentColorOptions]); }
  function clearFilamentColors() { resetVisibleCount(); setSelectedFilamentColors([]); }

  function toggleFilamentWeight(weight: FilamentWeightGroup) {
    resetVisibleCount();
    setSelectedFilamentWeights((current) =>
      current.includes(weight) ? current.filter((item) => item !== weight) : [...current, weight],
    );
  }

  function selectFilamentWeight(weight: FilamentWeightGroup) {
    resetVisibleCount();
    setSelectedFilamentWeights([weight]);
  }

  function selectAllFilamentWeights() { resetVisibleCount(); setSelectedFilamentWeights([...filamentWeightOptions]); }
  function clearFilamentWeights() { resetVisibleCount(); setSelectedFilamentWeights([]); }

  function setPriceBounds(min: number | null, max: number | null) {
    resetVisibleCount();
    if (min !== null && max !== null && min > max) {
      setPriceMinState(max);
      setPriceMaxState(min);
      return;
    }

    setPriceMinState(min);
    setPriceMaxState(max);
  }

  function setPriceMin(value: number | null) { setPriceBounds(value, priceMax); }
  function setPriceMax(value: number | null) { setPriceBounds(priceMin, value); }
  function clearPriceBounds() { setPriceBounds(null, null); }

  function setNearbyPostalCode(value: string) {
    resetVisibleCount();
    setNearbyPostalCodeState(value.toUpperCase().replace(/[^A-Z0-9\s-]/g, "").slice(0, 12));
  }

  function togglePrinterBrand(brand: string) {
    resetVisibleCount();
    setSelectedPrinterBrands((current) =>
      current.includes(brand)
        ? current.filter((item) => item !== brand)
        : [...current.filter((item) => item !== "__none__"), brand],
    );
  }

  function selectAllPrinterBrands(brands: string[]) { resetVisibleCount(); setSelectedPrinterBrands(brands); }
  function clearPrinterBrands() { resetVisibleCount(); setSelectedPrinterBrands([]); }

  function togglePrinterFrame(frame: PrinterFrameType) {
    resetVisibleCount();
    setSelectedPrinterFrames((current) =>
      current.includes(frame) ? current.filter((item) => item !== frame) : [...current, frame],
    );
  }

  function selectAllPrinterFrames() { resetVisibleCount(); setSelectedPrinterFrames([...printerFrameOptions]); }
  function clearPrinterFrames() { resetVisibleCount(); setSelectedPrinterFrames([]); }

  function toggleResinPrinterBrand(brand: string) {
    resetVisibleCount();
    setSelectedResinPrinterBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function selectResinPrinterBrand(brand: string) {
    resetVisibleCount();
    setSelectedResinPrinterBrands([brand]);
  }

  function selectAllResinPrinterBrands() { resetVisibleCount(); setSelectedResinPrinterBrands(resinPrinterBrands); }
  function clearResinPrinterBrands() { resetVisibleCount(); setSelectedResinPrinterBrands([]); }

  function toggleResinMaterialBrand(brand: string) {
    resetVisibleCount();
    setSelectedResinMaterialBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function selectResinMaterialBrand(brand: string) {
    resetVisibleCount();
    setSelectedResinMaterialBrands([brand]);
  }

  function selectAllResinMaterialBrands() { resetVisibleCount(); setSelectedResinMaterialBrands(resinMaterialBrands); }
  function clearResinMaterialBrands() { resetVisibleCount(); setSelectedResinMaterialBrands([]); }

  function toggleResinType(type: string) {
    resetVisibleCount();
    setSelectedResinTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function selectResinType(type: string) {
    resetVisibleCount();
    setSelectedResinTypes([type]);
  }

  function selectAllResinTypes() { resetVisibleCount(); setSelectedResinTypes([...resinTypeOptions]); }
  function clearResinTypes() { resetVisibleCount(); setSelectedResinTypes([]); }

  function selectAllFilamentBrands() {
    resetVisibleCount();
    setSelectedFilamentBrands(filamentBrands);
  }

  function clearFilamentBrands() {
    resetVisibleCount();
    setSelectedFilamentBrands([]);
  }

  function selectAllFilamentMaterials() {
    resetVisibleCount();
    setSelectedFilamentMaterials(defaultFilamentMaterials(filamentMaterials));
  }

  function clearFilamentMaterials() {
    resetVisibleCount();
    setSelectedFilamentMaterials([]);
  }

  const filtered = useMemo(() => {
    const queryTerms = normalizeQuery(query);
    const isStandaloneFilamentSearch = ["filam", "filame", "filamen", "filament", "filamento"].includes(
      query.trim().toLowerCase(),
    );
    const wantsFilaments = isStandaloneFilamentSearch;
    const wantsPrinters = queryTerms.some((term) => term.startsWith("impresor") || term === "printer");
    const needsPrinterPriceFloor =
      wantsPrinters || category === "Impresoras FDM" || category === "Impresoras de Resina";
    const isFdmPrinterFilterActive = category === "Impresoras FDM" || (wantsPrinters && category !== "Impresoras de Resina");
    const isResinPrinterFilterActive = category === "Impresoras de Resina";
    const isResinMaterialFilterActive = category === "Resina";
    const colorFilterIsActive = selectedFilamentColors.length !== filamentColorOptions.length;
    const weightFilterIsActive = selectedFilamentWeights.length !== filamentWeightOptions.length;
    const printerBrandFilterIsActive = selectedPrinterBrands.length > 0;
    const printerFrameFilterIsActive = selectedPrinterFrames.length !== printerFrameOptions.length;
    const resinPrinterBrandFilterIsActive = selectedResinPrinterBrands.length !== resinPrinterBrands.length;
    const resinMaterialBrandFilterIsActive = selectedResinMaterialBrands.length !== resinMaterialBrands.length;
    const resinTypeFilterIsActive = selectedResinTypes.length !== resinTypeOptions.length;

    return products
      .filter((product) => {
        return (
          (!queryTerms.length || queryTerms.every((term) => queryTermMatches(term, product))) &&
          (!wantsFilaments || product.isFilament) &&
          (!needsPrinterPriceFloor ||
            ((product.isFdmPrinter || product.isResinPrinter) && product.bestPrice >= printerMinimumPrice(product))) &&
          (!product.isFilament || selectedFilamentBrandSet.has(product.brand ?? unknownBrand)) &&
          (!product.isFilament ||
            selectedFilamentMaterialSet.has(product.material ?? unknownMaterial)) &&
          (!product.isFilament ||
            !colorFilterIsActive ||
            product.filamentColors.length === 0 ||
            product.filamentColors.some((color) => selectedFilamentColors.includes(color))) &&
          (!product.isFilament ||
            !weightFilterIsActive ||
            !product.filamentWeightGroup ||
            selectedFilamentWeights.includes(product.filamentWeightGroup)) &&
          productMatchesPriceBounds(product, priceMin, priceMax) &&
          (!isFdmPrinterFilterActive ||
            !printerBrandFilterIsActive ||
            selectedPrinterBrands.includes(product.brand ?? unknownBrand)) &&
          (!isFdmPrinterFilterActive ||
            !printerFrameFilterIsActive ||
            !product.isFdmPrinter ||
            selectedPrinterFrames.some((feature) => product.printerFeatures.includes(feature))) &&
          (!isResinPrinterFilterActive ||
            !resinPrinterBrandFilterIsActive ||
            selectedResinPrinterBrands.includes(product.brand ?? unknownBrand)) &&
          (!isResinMaterialFilterActive ||
            !resinMaterialBrandFilterIsActive ||
            selectedResinMaterialBrands.includes(product.brand ?? unknownBrand)) &&
          (!isResinMaterialFilterActive ||
            !resinTypeFilterIsActive ||
            selectedResinTypes.some((type) => productMatchesResinType(product, type))) &&
          productMatchesCategory(product, category) &&
          (store === "Todas" || product.store === store) &&
          (!nearbyOnly || nearbyStoreArea === null || product.storeLocations.some((location) => location.area === nearbyStoreArea)) &&
          (!stockOnly || product.stock !== "Consultar")
        );
      })
      .sort((a, b) => {
        if (colorFilterIsActive) {
          const aIsUndeclared = a.isFilament && a.filamentColors.length === 0;
          const bIsUndeclared = b.isFilament && b.filamentColors.length === 0;
          if (aIsUndeclared !== bIsUndeclared) return aIsUndeclared ? 1 : -1;
        }
        if (weightFilterIsActive) {
          const aIsUndeclared = a.isFilament && !a.filamentWeightGroup;
          const bIsUndeclared = b.isFilament && !b.filamentWeightGroup;
          if (aIsUndeclared !== bIsUndeclared) return aIsUndeclared ? 1 : -1;
        }
        if (sort === "desc") return b.bestPrice - a.bestPrice;
        if (sort === "asc") return a.bestPrice - b.bestPrice;
        return 0;
      });
  }, [
    category,
    products,
    query,
    selectedFilamentBrandSet,
    selectedFilamentMaterialSet,
    selectedFilamentColors,
    selectedFilamentWeights,
    priceMin,
    priceMax,
    selectedPrinterBrands,
    selectedPrinterFrames,
    resinPrinterBrands.length,
    selectedResinPrinterBrands,
    resinMaterialBrands.length,
    selectedResinMaterialBrands,
    selectedResinTypes,
    sort,
    stockOnly,
    store,
    nearbyOnly,
    nearbyStoreArea,
  ]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const hiddenProducts = Math.max(filtered.length - visibleProducts.length, 0);
  const bestPrice = filtered.length
    ? filtered.reduce((min, product) => Math.min(min, product.bestPrice), filtered[0].bestPrice)
    : 0;
  const hasActiveFilters =
    query !== "" ||
    category !== "Todas" ||
    store !== "Todas" ||
    nearbyOnly ||
    nearbyPostalCode !== "" ||
    sort !== "asc" ||
    stockOnly ||
    selectedFilamentBrands.length !== filamentBrands.length ||
    selectedFilamentMaterials.length !== defaultFilamentMaterials(filamentMaterials).length ||
    selectedFilamentColors.length !== filamentColorOptions.length ||
    selectedFilamentWeights.length !== filamentWeightOptions.length ||
    priceMin !== null ||
    priceMax !== null ||
    selectedPrinterBrands.length > 0 ||
    selectedPrinterFrames.length !== printerFrameOptions.length ||
    selectedResinPrinterBrands.length !== resinPrinterBrands.length ||
    selectedResinMaterialBrands.length !== resinMaterialBrands.length ||
    selectedResinTypes.length !== resinTypeOptions.length;

  function resetFilters() {
    setQuery("");
    setCategory("Todas");
    setStore("Todas");
    setNearbyPostalCodeState("");
    setNearbyOnly(false);
    setSort("asc");
    setStockOnly(false);
    setSelectedFilamentBrands(filamentBrands);
    setSelectedFilamentMaterials(defaultFilamentMaterials(filamentMaterials));
    setSelectedFilamentColors([...filamentColorOptions]);
    setSelectedFilamentWeights([...filamentWeightOptions]);
    setPriceMinState(null);
    setPriceMaxState(null);
    setSelectedPrinterBrands([]);
    setSelectedPrinterFrames([...printerFrameOptions]);
    setSelectedResinPrinterBrands(resinPrinterBrands);
    setSelectedResinMaterialBrands(resinMaterialBrands);
    setSelectedResinTypes([...resinTypeOptions]);
    setOpenFacet(null);
    resetVisibleCount();
  }

  return {
    bestPrice,
    category,
    effectiveSelectedFilamentMaterials,
    filtered,
    handleQueryChange,
    hasActiveFilters,
    hasNoNearbyStores,
    hiddenProducts,
    isLoadingResults,
    openFacet,
    nearbyOnly,
    nearbyPostalCode,
    nearbyStoreArea,
    query,
    resetFilters,
    resetVisibleCount,
    clearFilamentBrands,
    clearFilamentColors,
    clearFilamentWeights,
    clearFilamentMaterials,
    clearPriceBounds,
    clearPrinterBrands,
    clearPrinterFrames,
    clearResinMaterialBrands,
    clearResinPrinterBrands,
    clearResinTypes,
    selectedFilamentBrandSet,
    selectedFilamentBrands,
    selectedFilamentMaterialSet,
    selectedFilamentMaterials,
    selectedFilamentColors,
    selectedFilamentWeights,
    priceMin,
    priceMax,
    selectedPrinterBrands,
    selectedPrinterFrames,
    selectedResinMaterialBrands,
    selectedResinPrinterBrands,
    selectedResinTypes,
    setCategory,
    setOpenFacet,
    setPriceMin,
    setPriceMax,
    setSort,
    setStockOnly,
    setStore,
    setNearbyOnly,
    setNearbyPostalCode,
    setVisibleCount,
    selectAllFilamentBrands,
    selectAllFilamentColors,
    selectAllFilamentWeights,
    selectAllFilamentMaterials,
    selectAllPrinterBrands,
    selectAllPrinterFrames,
    selectAllResinMaterialBrands,
    selectAllResinPrinterBrands,
    selectAllResinTypes,
    selectFilamentBrand,
    selectFilamentColor,
    selectFilamentWeight,
    selectFilamentMaterial,
    selectResinMaterialBrand,
    selectResinPrinterBrand,
    selectResinType,
    sort,
    stockOnly,
    store,
    toggleFilamentBrand,
    toggleFilamentColor,
    toggleFilamentWeight,
    toggleFilamentMaterial,
    togglePrinterBrand,
    togglePrinterFrame,
    toggleResinMaterialBrand,
    toggleResinPrinterBrand,
    toggleResinType,
    visibleCount,
    visibleProducts,
  };
}
