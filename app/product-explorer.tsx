"use client";

import type { Product } from "@/lib/catalog";
import {
  categoryOptions,
  connectedStores,
  filamentBrands,
  filamentMaterials,
  stores,
} from "@/lib/catalog";
import { FacetDropdown } from "./facet-dropdown";
import { ProductCard } from "./product-card";
import { pageSize, useProductFilters } from "./use-product-filters";

type ProductExplorerProps = {
  products: Product[];
  filamentBrandCounts: Record<string, number>;
  filamentMaterialCounts: Record<string, number>;
};

const price = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function ProductExplorer({
  products,
  filamentBrandCounts,
  filamentMaterialCounts,
}: ProductExplorerProps) {
  const {
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
    selectedFilamentMaterialSet,
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
    visibleProducts,
  } = useProductFilters(products);

  return (
    <main className="app-shell">
      <section className="search-band">
        <nav className="topbar" aria-label="Principal">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true">
              F3D
            </span>
            <span>Filtrar 3D</span>
          </a>
          <div className="top-menu" aria-label="Filtros principales">
            <label className="top-search" htmlFor="search">
              <strong>Buscar</strong>
              <input
                id="search"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="PLA negro, boquilla, Bambu A1"
              />
            </label>

            <details className="top-dropdown">
              <summary>
                <span>Categorías</span>
                <small>{category}</small>
              </summary>
              <div className="menu-panel">
                {categoryOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={category === item ? "active" : ""}
                    aria-pressed={category === item}
                    onClick={() => {
                      setCategory(item);
                      resetVisibleCount();
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </details>

            <details className="top-dropdown">
              <summary>
                <span>Tiendas</span>
                <small>{store}</small>
              </summary>
              <div className="menu-panel">
                {stores.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={store === item ? "active" : ""}
                    aria-pressed={store === item}
                    onClick={() => {
                      setStore(item);
                      resetVisibleCount();
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </details>

            <FacetDropdown
              count={selectedFilamentBrandSet.size}
              isOpen={openFacet === "brands"}
              items={filamentBrands}
              label="Marcas"
              onClear={() => {
                clearFilamentBrands();
                setOpenFacet("brands");
              }}
              onOpenChange={(open) => setOpenFacet(open ? "brands" : null)}
              onSelectAll={() => {
                selectAllFilamentBrands();
                setOpenFacet("brands");
              }}
              onToggleItem={toggleFilamentBrand}
              selected={selectedFilamentBrandSet}
              total={filamentBrands.length}
              valueCounts={filamentBrandCounts}
            />

            <FacetDropdown
              count={effectiveSelectedFilamentMaterials.length}
              isOpen={openFacet === "materials"}
              items={filamentMaterials}
              label="Materiales"
              onClear={() => {
                clearFilamentMaterials();
                setOpenFacet("materials");
              }}
              onOpenChange={(open) => setOpenFacet(open ? "materials" : null)}
              onSelectAll={() => {
                selectAllFilamentMaterials();
                setOpenFacet("materials");
              }}
              onToggleItem={toggleFilamentMaterial}
              selected={selectedFilamentMaterialSet}
              total={filamentMaterials.length}
              valueCounts={filamentMaterialCounts}
            />
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Comparador argentino de impresión 3D</p>
            <h1>Buscá una pieza, repuesto o máquina y compará tiendas en segundos.</h1>
            <p>
              Erexit 3D, Laboratorio 3D, TP3D y Proyecto Color ya están conectadas con
              scraper propio junto a Kimera 3D: traen productos, precios, stock, imágenes
              y links reales.
            </p>
          </div>

          <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
            <div className="toolbar" aria-label="Orden y disponibilidad">
              <div className="segmented">
                <button
                  type="button"
                  className={sort === "desc" ? "active" : ""}
                  aria-pressed={sort === "desc"}
                  onClick={() => {
                    setSort("desc");
                    resetVisibleCount();
                  }}
                >
                  Mayor precio
                </button>
                <button
                  type="button"
                  className={sort === "asc" ? "active" : ""}
                  aria-pressed={sort === "asc"}
                  onClick={() => {
                    setSort("asc");
                    resetVisibleCount();
                  }}
                >
                  Menor precio
                </button>
              </div>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={stockOnly}
                  onChange={(event) => {
                    setStockOnly(event.target.checked);
                    resetVisibleCount();
                  }}
                />
                Solo disponibles
              </label>
              <button
                type="button"
                className="reset-button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
              >
                Limpiar filtros
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="stats-band" aria-label="Resumen">
        <div>
          <strong>{products.length}</strong>
          <span>ofertas reales</span>
        </div>
        <div>
          <strong>{stores.length - 1}</strong>
          <span>tiendas iniciales</span>
        </div>
        <div>
          <strong>{bestPrice ? price.format(bestPrice) : "-"}</strong>
          <span>mejor precio filtrado</span>
        </div>
        <div>
          <strong>{connectedStores}</strong>
          <span>tiendas conectadas</span>
        </div>
      </section>

      <section className="content-grid" id="resultados">
        <section className="results-panel">
          <div className="section-heading">
            <div>
              <p>Resultados</p>
              <h2>
                Ordenados por mejor precio {sort === "desc" ? "mayor a menor" : "menor a mayor"}
              </h2>
            </div>
            <span>{filtered.length} coincidencias</span>
          </div>

          <div className="result-list">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} priceFormatter={price} />
            ))}

            {hiddenProducts ? (
              <div className="load-more">
                <span>
                  Mostrando {visibleProducts.length} de {filtered.length} ofertas.
                </span>
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + pageSize)}
                >
                  Mostrar más
                </button>
              </div>
            ) : null}

            {!filtered.length ? (
              <div className="empty-state">
                <h3>No encontré ofertas con esos filtros</h3>
                <p>Probá buscar por material, marca o medida: PLA, PETG, 0.4mm, Ender, Bambu.</p>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
