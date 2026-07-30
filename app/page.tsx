"use client";

import { useMemo, useState } from "react";
import erexitData from "@/data/erexit3d-products.json";
import kimeraData from "@/data/kimera3d-products.json";
import laboratorioData from "@/data/laboratorio3d-products.json";
import proyectoColorData from "@/data/proyectocolor-products.json";
import tp3dData from "@/data/tp3d-products.json";

type Product = {
  id: string | number;
  name: string;
  category: string;
  store: string;
  price: number;
  previousPrice?: number;
  transferPrice?: number | null;
  stock: "En stock" | "Pocas unidades" | "Consultar";
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
};

type StoreSource = {
  name: string;
  domain: string;
  url: string;
  status: "Pendiente" | "Mapeada" | "Conectada";
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

const categoryOptions = [
  "Todas",
  "Impresoras FDM",
  "Impresoras de Resina",
  "Filamento",
  "Resina",
  "Accesorios",
  "Repuestos",
];

const storeSources: StoreSource[] = [
  {
    name: "TP3D",
    domain: "tp3d.com.ar",
    url: "https://tp3d.com.ar",
    status: "Conectada",
  },
  {
    name: "Laboratorio 3D",
    domain: "laboratorio3d.com.ar",
    url: "https://laboratorio3d.com.ar",
    status: "Conectada",
  },
  {
    name: "Erexit 3D",
    domain: "erexit3d.com",
    url: "https://erexit3d.com",
    status: "Conectada",
  },
  {
    name: "Proyecto Color",
    domain: "proyectocolor.com.ar",
    url: "https://proyectocolor.com.ar",
    status: "Conectada",
  },
  {
    name: "Kimera 3D",
    domain: "kimera3d.com.ar",
    url: "https://kimera3d.com.ar",
    status: "Conectada",
  },
];

const connectedStoreSources = storeSources.filter((source) => source.status === "Conectada");
const stores = ["Todas", ...connectedStoreSources.map((source) => source.name)];

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
const unknownBrand = "Sin marca";
const unknownMaterial = "Sin material";
const materialLabels = ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX", "NYLON", "PC", "PVA"];
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
]);
const searchTermAliases = new Map([
  ["boquilla", ["boquilla", "nozzle"]],
  ["boquillas", ["boquilla", "boquillas", "nozzle", "nozzles"]],
  ["nozzle", ["nozzle", "boquilla"]],
  ["nozzles", ["nozzle", "nozzles", "boquilla", "boquillas"]],
]);

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

function toProduct(product: ScrapedProduct): Product {
  const tags = product.tags.length ? product.tags : [product.brand ?? product.store];

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    store: product.store,
    price: product.price,
    previousPrice: product.previousPrice ?? undefined,
    transferPrice: product.transferPrice,
    stock:
      product.stockLabel === "Pocas unidades" || product.stockLabel === "Consultar"
        ? product.stockLabel
        : "En stock",
    city: "Argentina",
    shipping: `Dato real de ${product.store}`,
    updated: "scrape real",
    tags,
    brand: inferBrand(product.name, tags, product.brand),
    color:
      product.store === "Laboratorio 3D"
        ? "#315f95"
        : product.store === "TP3D"
          ? "#4f8f82"
          : product.store === "Proyecto Color"
            ? "#bf6b42"
            : "#8f5aa6",
    url: product.url,
    image: product.image,
    material: inferMaterial(product.name, tags),
    source: "scraper",
  };
}

const realErexitProducts = (erexitData.products as ScrapedProduct[]).map(toProduct);
const realLaboratorioProducts = (laboratorioData.products as ScrapedProduct[]).map(toProduct);
const realTp3dProducts = (tp3dData.products as ScrapedProduct[]).map(toProduct);
const realProyectoColorProducts = (proyectoColorData.products as ScrapedProduct[]).map(toProduct);
const realKimeraProducts = (kimeraData.products as ScrapedProduct[]).map(toProduct);

const realProducts = [
  ...realErexitProducts,
  ...realLaboratorioProducts,
  ...realTp3dProducts,
  ...realProyectoColorProducts,
  ...realKimeraProducts,
];
const products = realProducts;
const connectedStores = connectedStoreSources.length;

const price = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function bestAvailablePrice(product: Product) {
  return product.transferPrice ?? product.price;
}

const filamentQueryTerms = new Set(["filamento", "filamentos"]);
const filamentMaterialTerms = new Set(["pla", "petg", "abs", "asa", "tpu", "flex", "nylon", "pc", "pva"]);
const filamentProductPhrases = [
  "filamento",
  "filamentos",
  "ecofila",
  "rollo",
  "bobina",
  "recarga",
];
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

function searchableText(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function searchableTokens(text: string): string[] {
  return text.match(/[a-z0-9.]+/g) ?? [];
}

function isFilamentProduct(product: Product) {
  const text = searchableText([product.name, product.brand, product.material, ...product.tags]);
  const tokens = searchableTokens(text);
  const hasMaterialSignal = tokens.some((token) => filamentMaterialTerms.has(token));
  const hasFilamentSignal =
    hasMaterialSignal || filamentProductPhrases.some((word) => text.includes(word));
  const hasAccessorySignal = nonFilamentProductWords.some((word) => text.includes(word));

  return hasFilamentSignal && !hasAccessorySignal;
}

function queryTermMatches(term: string, haystack: string, product: Product) {
  if (filamentQueryTerms.has(term)) return isFilamentProduct(product);
  if (filamentMaterialTerms.has(term)) return product.material?.toLowerCase() === term;

  return (searchTermAliases.get(term) ?? [term]).some((alias) => haystack.includes(alias));
}

function productText(product: Product) {
  return searchableText([
    product.name,
    product.category,
    product.brand,
    product.material,
    ...product.tags,
  ]);
}

function isResinPrinter(product: Product) {
  const text = productText(product);
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

function isFdmPrinter(product: Product) {
  const text = productText(product);
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

  return hasPrinterSignal && !isResinPrinter(product) && !accessorySignal;
}

function isResinMaterial(product: Product) {
  const text = productText(product);
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
    !isResinPrinter(product) &&
    product.category === "Resina" &&
    !isWashOrCure &&
    !hasFilamentMaterial
  );
}

function isStrictFilament(product: Product) {
  return isFilamentProduct(product) && !isFdmPrinter(product) && !isResinPrinter(product);
}

function productMatchesCategory(product: Product, category: string) {
  if (category === "Todas") return true;
  if (category === "Impresoras FDM") return isFdmPrinter(product);
  if (category === "Impresoras de Resina") return isResinPrinter(product);
  if (category === "Filamento") return isStrictFilament(product);
  if (category === "Resina") return isResinMaterial(product);

  return product.category === category;
}

const filamentBrands = [
  ...new Set(products.map((product) => product.brand ?? unknownBrand)),
].sort((a, b) => {
  if (a === unknownBrand) return 1;
  if (b === unknownBrand) return -1;

  return a.localeCompare(b, "es");
});

const filamentBrandCounts = new Map(
  filamentBrands.map((brand) => [
    brand,
    products.filter((product) => (product.brand ?? unknownBrand) === brand).length,
  ]),
);

const filamentMaterials = [
  ...new Set(products.filter(isFilamentProduct).map((product) => product.material ?? unknownMaterial)),
].sort((a, b) => {
  if (a === unknownMaterial) return 1;
  if (b === unknownMaterial) return -1;

  return materialLabels.indexOf(a) - materialLabels.indexOf(b);
});

const filamentMaterialCounts = new Map(
  filamentMaterials.map((material) => [
    material,
    products.filter((product) => isFilamentProduct(product) && product.material === material).length,
  ]),
);

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [store, setStore] = useState("Todas");
  const [sort, setSort] = useState<"desc" | "asc">("asc");
  const [stockOnly, setStockOnly] = useState(true);
  const [selectedFilamentBrands, setSelectedFilamentBrands] = useState(filamentBrands);
  const [selectedFilamentMaterials, setSelectedFilamentMaterials] = useState(filamentMaterials);
  const [openFacet, setOpenFacet] = useState<"brands" | "materials" | null>(null);
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

  function handleQueryChange(value: string) {
    setQuery(value);

    const nextMaterials = searchableTokens(value.toLowerCase()).filter((term) =>
      materialSearchAliases.has(term),
    );
    if (nextMaterials.length) setOpenFacet("materials");
  }

  function toggleFilamentBrand(brand: string) {
    setSelectedFilamentBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function toggleFilamentMaterial(material: string) {
    setSelectedFilamentMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  function selectAllFilamentBrands() {
    setSelectedFilamentBrands(filamentBrands);
  }

  function clearFilamentBrands() {
    setSelectedFilamentBrands([]);
  }

  function selectAllFilamentMaterials() {
    setSelectedFilamentMaterials(filamentMaterials);
  }

  function clearFilamentMaterials() {
    setSelectedFilamentMaterials([]);
  }

  const filtered = useMemo(() => {
    const queryTerms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const wantsFilaments = queryTerms.some(
      (term) => filamentQueryTerms.has(term) || filamentMaterialTerms.has(term),
    );

    return products
      .filter((product) => {
        const haystack = searchableText([
          product.name,
          product.store,
          product.city,
          product.material,
          ...product.tags,
        ]);

        return (
          (!queryTerms.length ||
            queryTerms.every((term) => queryTermMatches(term, haystack, product))) &&
          (!wantsFilaments || isFilamentProduct(product)) &&
          selectedFilamentBrandSet.has(product.brand ?? unknownBrand) &&
          (!isFilamentProduct(product) ||
            selectedFilamentMaterialSet.has(product.material ?? unknownMaterial)) &&
          productMatchesCategory(product, category) &&
          (store === "Todas" || product.store === store) &&
          (!stockOnly || product.stock !== "Consultar")
        );
      })
      .sort((a, b) =>
        sort === "desc"
          ? bestAvailablePrice(b) - bestAvailablePrice(a)
          : bestAvailablePrice(a) - bestAvailablePrice(b),
      );
  }, [
    category,
    query,
    selectedFilamentBrandSet,
    selectedFilamentMaterialSet,
    sort,
    stockOnly,
    store,
  ]);

  const bestPrice = filtered.length
    ? filtered.reduce(
        (min, product) => Math.min(min, bestAvailablePrice(product)),
        bestAvailablePrice(filtered[0]),
      )
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
  }

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
              <span aria-hidden="true">⌕</span>
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
                <span>Categorias</span>
                <small>{category}</small>
              </summary>
              <div className="menu-panel">
                {categoryOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
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
                    onClick={() => setStore(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </details>

            <details
              className="top-dropdown wide"
              open={openFacet === "brands"}
              onToggle={(event) => setOpenFacet(event.currentTarget.open ? "brands" : null)}
            >
              <summary>
                <span>Marcas</span>
                <small>
                  {selectedFilamentBrands.length}/{filamentBrands.length}
                </small>
              </summary>
              <div className="menu-panel check-panel">
                <div className="facet-actions" aria-label="Acciones de marcas">
                  <button type="button" onClick={selectAllFilamentBrands}>
                    Seleccionar todas
                  </button>
                  <button type="button" onClick={clearFilamentBrands}>
                    Deseleccionar todas
                  </button>
                </div>
                {filamentBrands.map((brand) => (
                  <label className="facet-option compact" key={brand}>
                    <input
                      type="checkbox"
                      checked={selectedFilamentBrandSet.has(brand)}
                      onChange={() => toggleFilamentBrand(brand)}
                    />
                    <span className="facet-check" aria-hidden="true" />
                    <span className="facet-name">{brand}</span>
                    <small>{filamentBrandCounts.get(brand) ?? 0}</small>
                  </label>
                ))}
              </div>
            </details>

            <details
              className="top-dropdown wide"
              open={openFacet === "materials"}
              onToggle={(event) => setOpenFacet(event.currentTarget.open ? "materials" : null)}
            >
              <summary>
                <span>Materiales</span>
                <small>
                  {effectiveSelectedFilamentMaterials.length}/{filamentMaterials.length}
                </small>
              </summary>
              <div className="menu-panel check-panel">
                <div className="facet-actions" aria-label="Acciones de materiales">
                  <button type="button" onClick={selectAllFilamentMaterials}>
                    Seleccionar todos
                  </button>
                  <button type="button" onClick={clearFilamentMaterials}>
                    Deseleccionar todos
                  </button>
                </div>
                {filamentMaterials.map((material) => (
                  <label className="facet-option compact" key={material}>
                    <input
                      type="checkbox"
                      checked={selectedFilamentMaterialSet.has(material)}
                      onChange={() => toggleFilamentMaterial(material)}
                    />
                    <span className="facet-check" aria-hidden="true" />
                    <span className="facet-name">{material}</span>
                    <small>{filamentMaterialCounts.get(material) ?? 0}</small>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Comparador argentino de impresion 3D</p>
            <h1>Busca una pieza, repuesto o maquina y compara tiendas en segundos.</h1>
            <p>
              Erexit 3D, Laboratorio 3D, TP3D y Proyecto Color ya estan
              conectadas con scraper propio junto a Kimera 3D: traen productos,
              precios, stock, imagenes y links reales.
            </p>
          </div>

          <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
            <div className="toolbar" aria-label="Orden y disponibilidad">
              <div className="segmented">
                <button
                  type="button"
                  className={sort === "desc" ? "active" : ""}
                  onClick={() => setSort("desc")}
                >
                  Mayor precio
                </button>
                <button
                  type="button"
                  className={sort === "asc" ? "active" : ""}
                  onClick={() => setSort("asc")}
                >
                  Menor precio
                </button>
              </div>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={stockOnly}
                  onChange={(event) => setStockOnly(event.target.checked)}
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
          <strong>{realProducts.length}</strong>
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
            {filtered.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-visual" style={{ backgroundColor: product.color }}>
                  {product.image ? (
                    <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{product.category.slice(0, 3).toUpperCase()}</span>
                  )}
                </div>
                <div className="product-info">
                  <div className="product-head">
                    <div>
                      <p>
                        {product.store} · {product.city} ·{" "}
                        {product.source === "scraper" ? "dato real" : "demo"}
                      </p>
                      <h3>{product.name}</h3>
                    </div>
                    <span className={`stock ${product.stock === "En stock" ? "ok" : ""}`}>
                      {product.stock}
                    </span>
                  </div>
                  <div className="tag-row">
                    {product.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="product-foot">
                    <div>
                      <strong>{price.format(bestAvailablePrice(product))}</strong>
                      <span className="price-label">
                        {product.transferPrice ? "Mejor precio por transferencia" : "Precio lista"}
                      </span>
                      {product.previousPrice ? (
                        <small>{price.format(product.previousPrice)}</small>
                      ) : null}
                      {product.transferPrice ? (
                        <small className="list-price">{price.format(product.price)} precio lista</small>
                      ) : null}
                    </div>
                    <div className="meta">
                      <span>{product.shipping}</span>
                      <span>{product.updated}</span>
                    </div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ver ${product.name} en ${product.store}`}
                    >
                      Ver oferta
                    </a>
                  </div>
                </div>
              </article>
            ))}

            {!filtered.length ? (
              <div className="empty-state">
                <h3>No encontre ofertas con esos filtros</h3>
                <p>Proba buscar por material, marca o medida: PLA, PETG, 0.4mm, Ender, Bambu.</p>
              </div>
            ) : null}
          </div>
        </section>

      </section>
    </main>
  );
}
