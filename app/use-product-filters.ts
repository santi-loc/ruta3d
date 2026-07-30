"use client";

import { useMemo, useState } from "react";
import type { Product, SortDirection } from "@/lib/catalog";
import {
  filamentBrands,
  filamentMaterials,
  materialSearchAliases,
  normalizeQuery,
  productMatchesCategory,
  queryTermMatches,
  searchableTokens,
  unknownBrand,
  unknownMaterial,
} from "@/lib/catalog";

export const pageSize = 48;

const filamentSearchTerms = new Set([
  "filamento",
  "filamentos",
  ...filamentMaterials.map((material) => material.toLowerCase()),
]);

export function useProductFilters(products: Product[]) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [store, setStore] = useState("Todas");
  const [sort, setSort] = useState<SortDirection>("asc");
  const [stockOnly, setStockOnly] = useState(true);
  const [selectedFilamentBrands, setSelectedFilamentBrands] = useState(filamentBrands);
  const [selectedFilamentMaterials, setSelectedFilamentMaterials] = useState(filamentMaterials);
  const [openFacet, setOpenFacet] = useState<"brands" | "materials" | null>(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const selectedFilamentBrandSet = useMemo(
    () => new Set(selectedFilamentBrands),
    [selectedFilamentBrands],
  );
  const searchedMaterials = useMemo(
    () => [
      ...new Set(
        searchableTokens(query.toLowerCase())
          .map((term) => materialSearchAliases.get(term))
          .filter((material): material is string => Boolean(material)),
      ),
    ],
    [query],
  );
  const effectiveSelectedFilamentMaterials = searchedMaterials.length
    ? searchedMaterials
    : selectedFilamentMaterials;
  const selectedFilamentMaterialSet = useMemo(
    () => new Set(effectiveSelectedFilamentMaterials),
    [effectiveSelectedFilamentMaterials],
  );

  function resetVisibleCount() {
    setVisibleCount(pageSize);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    resetVisibleCount();

    const nextMaterials = searchableTokens(value.toLowerCase()).filter((term) =>
      materialSearchAliases.has(term),
    );
    if (nextMaterials.length) setOpenFacet("materials");
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
    setSelectedFilamentMaterials(filamentMaterials);
  }

  function clearFilamentMaterials() {
    resetVisibleCount();
    setSelectedFilamentMaterials([]);
  }

  const filtered = useMemo(() => {
    const queryTerms = normalizeQuery(query);
    const wantsFilaments = queryTerms.some((term) => filamentSearchTerms.has(term));

    return products
      .filter((product) => {
        return (
          (!queryTerms.length || queryTerms.every((term) => queryTermMatches(term, product))) &&
          (!wantsFilaments || product.isFilament) &&
          selectedFilamentBrandSet.has(product.brand ?? unknownBrand) &&
          (!product.isFilament ||
            selectedFilamentMaterialSet.has(product.material ?? unknownMaterial)) &&
          productMatchesCategory(product, category) &&
          (store === "Todas" || product.store === store) &&
          (!stockOnly || product.stock !== "Consultar")
        );
      })
      .sort((a, b) => (sort === "desc" ? b.bestPrice - a.bestPrice : a.bestPrice - b.bestPrice));
  }, [
    category,
    products,
    query,
    selectedFilamentBrandSet,
    selectedFilamentMaterialSet,
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
    !stockOnly ||
    selectedFilamentBrands.length !== filamentBrands.length ||
    selectedFilamentMaterials.length !== filamentMaterials.length;

  function resetFilters() {
    setQuery("");
    setCategory("Todas");
    setStore("Todas");
    setSort("asc");
    setStockOnly(true);
    setSelectedFilamentBrands(filamentBrands);
    setSelectedFilamentMaterials(filamentMaterials);
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
    openFacet,
    query,
    resetFilters,
    resetVisibleCount,
    clearFilamentBrands,
    clearFilamentMaterials,
    selectedFilamentBrandSet,
    selectedFilamentBrands,
    selectedFilamentMaterialSet,
    selectedFilamentMaterials,
    setCategory,
    setOpenFacet,
    setSort,
    setStockOnly,
    setStore,
    setVisibleCount,
    selectAllFilamentBrands,
    selectAllFilamentMaterials,
    sort,
    stockOnly,
    store,
    toggleFilamentBrand,
    toggleFilamentMaterial,
    visibleCount,
    visibleProducts,
  };
}
