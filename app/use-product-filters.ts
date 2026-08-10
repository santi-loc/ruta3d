"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { penFilamentMaterial, type FilamentWeightGroup, type PrinterFrameType, type Product, type SortDirection } from "@/lib/catalog";
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

export const pageSize = 48;
export const filamentWeightOptions: FilamentWeightGroup[] = ["0.25", "0.5", "1", "over1"];
export const printerFrameOptions: PrinterFrameType[] = ["Abierta", "Cerrada"];
export { filamentColorOptions } from "@/lib/filament-colors";

function printerMinimumPrice(product: Product) {
  if (product.brand === "Bambu Lab") return 300_000;
  if (product.brand === "Creality") return 350_000;
  return 200_000;
}

function defaultFilamentMaterials(materials: string[]) {
  return materials.filter((material) => material !== penFilamentMaterial);
}

function productMatchesPriceBounds(product: Product, min: number | null, max: number | null) {
  return (min === null || product.bestPrice >= min) && (max === null || product.bestPrice <= max);
}

export function useProductFilters(
  products: Product[],
  filamentBrands: string[],
  filamentMaterials: string[],
  initialQuery = "",
) {
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("Todas");
  const [store, setStore] = useState("Todas");
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
  const selectedFilamentMaterialSet = useMemo(
    () => new Set(effectiveSelectedFilamentMaterials),
    [effectiveSelectedFilamentMaterials],
  );

  function resetVisibleCount() {
    setVisibleCount(pageSize);
    pulseResultsLoading();
  }

  function handleQueryChange(value: string, resetSearchFilters = true) {
    setQuery(value);
    if (resetSearchFilters) {
      setCategory("Todas");
      setStore("Todas");
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
      setOpenFacet(null);
    }
    resetVisibleCount();

    if (queryContainsMaterial(value)) setOpenFacet("materials");
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

  function togglePrinterBrand(brand: string) {
    resetVisibleCount();
    setSelectedPrinterBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
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
    const isPrinterFilterActive = category === "Impresoras FDM" || category === "Impresoras de Resina" || wantsPrinters;
    const colorFilterIsActive = selectedFilamentColors.length !== filamentColorOptions.length;
    const weightFilterIsActive = selectedFilamentWeights.length !== filamentWeightOptions.length;
    const printerBrandFilterIsActive = selectedPrinterBrands.length > 0;
    const printerFrameFilterIsActive = selectedPrinterFrames.length !== printerFrameOptions.length;

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
          (!isPrinterFilterActive ||
            !printerBrandFilterIsActive ||
            selectedPrinterBrands.includes(product.brand ?? unknownBrand)) &&
          (!isPrinterFilterActive ||
            !printerFrameFilterIsActive ||
            !product.isFdmPrinter ||
            !product.printerFrameType ||
            selectedPrinterFrames.includes(product.printerFrameType)) &&
          productMatchesCategory(product, category) &&
          (store === "Todas" || product.store === store) &&
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
    sort,
    stockOnly,
    store,
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
    sort !== "asc" ||
    stockOnly ||
    selectedFilamentBrands.length !== filamentBrands.length ||
    selectedFilamentMaterials.length !== defaultFilamentMaterials(filamentMaterials).length ||
    selectedFilamentColors.length !== filamentColorOptions.length ||
    selectedFilamentWeights.length !== filamentWeightOptions.length ||
    priceMin !== null ||
    priceMax !== null ||
    selectedPrinterBrands.length > 0 ||
    selectedPrinterFrames.length !== printerFrameOptions.length;

  function resetFilters() {
    setQuery("");
    setCategory("Todas");
    setStore("Todas");
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
    hiddenProducts,
    isLoadingResults,
    openFacet,
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
    setCategory,
    setOpenFacet,
    setPriceMin,
    setPriceMax,
    setSort,
    setStockOnly,
    setStore,
    setVisibleCount,
    selectAllFilamentBrands,
    selectAllFilamentColors,
    selectAllFilamentWeights,
    selectAllFilamentMaterials,
    selectAllPrinterBrands,
    selectAllPrinterFrames,
    selectFilamentBrand,
    selectFilamentColor,
    selectFilamentWeight,
    selectFilamentMaterial,
    sort,
    stockOnly,
    store,
    toggleFilamentBrand,
    toggleFilamentColor,
    toggleFilamentWeight,
    toggleFilamentMaterial,
    togglePrinterBrand,
    togglePrinterFrame,
    visibleCount,
    visibleProducts,
  };
}
