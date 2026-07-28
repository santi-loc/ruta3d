"use client";

import { useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  store: string;
  price: number;
  previousPrice?: number;
  stock: "En stock" | "Pocas unidades" | "Consultar";
  city: string;
  rating: number;
  shipping: string;
  updated: string;
  tags: string[];
  color: string;
  material?: string;
  url: string;
};

const categories = [
  "Todo",
  "Impresoras",
  "Filamentos",
  "Resina",
  "Repuestos",
  "Herramientas",
  "Accesorios",
];

const stores = [
  "Todas",
  "3D Lab",
  "PrintParts",
  "Filamentos BA",
  "Maker Shop",
  "Tecno3D",
  "Resina Norte",
];

const products: Product[] = [
  {
    id: 1,
    name: "Bambu Lab A1 Combo",
    category: "Impresoras",
    store: "3D Lab",
    price: 1329000,
    previousPrice: 1395000,
    stock: "En stock",
    city: "CABA",
    rating: 4.8,
    shipping: "Envio gratis",
    updated: "hace 8 min",
    tags: ["FDM", "multicolor", "220x220x250"],
    color: "#4f8f82",
    url: "#",
  },
  {
    id: 2,
    name: "Creality K1C",
    category: "Impresoras",
    store: "Tecno3D",
    price: 1048000,
    stock: "Pocas unidades",
    city: "Cordoba",
    rating: 4.6,
    shipping: "Retiro o envio",
    updated: "hace 21 min",
    tags: ["CoreXY", "carbono", "300 C"],
    color: "#2f6fbc",
    url: "#",
  },
  {
    id: 3,
    name: "Anycubic Photon Mono M5s Pro",
    category: "Impresoras",
    store: "Resina Norte",
    price: 938500,
    previousPrice: 1012000,
    stock: "Consultar",
    city: "Salta",
    rating: 4.5,
    shipping: "A coordinar",
    updated: "hace 1 h",
    tags: ["SLA", "14K", "resina"],
    color: "#8f5aa6",
    url: "#",
  },
  {
    id: 4,
    name: "Filamento PLA+ Negro 1kg 1.75mm",
    category: "Filamentos",
    store: "Filamentos BA",
    price: 22900,
    previousPrice: 24500,
    stock: "En stock",
    city: "CABA",
    rating: 4.9,
    shipping: "Llega hoy",
    updated: "hace 5 min",
    tags: ["PLA+", "1kg", "1.75mm"],
    material: "PLA+",
    color: "#21252b",
    url: "#",
  },
  {
    id: 5,
    name: "PETG Cristal 1kg 1.75mm",
    category: "Filamentos",
    store: "Maker Shop",
    price: 26800,
    stock: "En stock",
    city: "Rosario",
    rating: 4.7,
    shipping: "Envio 24/48 h",
    updated: "hace 13 min",
    tags: ["PETG", "translucido", "1kg"],
    material: "PETG",
    color: "#9bd5d0",
    url: "#",
  },
  {
    id: 6,
    name: "Resina ABS-Like Gris 1kg",
    category: "Resina",
    store: "Resina Norte",
    price: 34500,
    previousPrice: 36900,
    stock: "En stock",
    city: "Salta",
    rating: 4.4,
    shipping: "Correo Argentino",
    updated: "hace 39 min",
    tags: ["ABS-like", "gris", "LCD"],
    material: "ABS-like",
    color: "#8d9198",
    url: "#",
  },
  {
    id: 7,
    name: "Hotend all metal Spider V3",
    category: "Repuestos",
    store: "PrintParts",
    price: 73200,
    stock: "Pocas unidades",
    city: "CABA",
    rating: 4.3,
    shipping: "Retiro inmediato",
    updated: "hace 46 min",
    tags: ["hotend", "all metal", "Creality"],
    color: "#bf6b42",
    url: "#",
  },
  {
    id: 8,
    name: "Boquillas MK8 pack x10 0.4mm",
    category: "Repuestos",
    store: "Maker Shop",
    price: 7800,
    stock: "En stock",
    city: "Rosario",
    rating: 4.6,
    shipping: "Envio economico",
    updated: "hace 12 min",
    tags: ["nozzle", "0.4mm", "bronce"],
    color: "#c99a42",
    url: "#",
  },
  {
    id: 9,
    name: "Kit espatula + pinza + cutter",
    category: "Herramientas",
    store: "3D Lab",
    price: 18400,
    stock: "En stock",
    city: "CABA",
    rating: 4.2,
    shipping: "Mercado Envios",
    updated: "hace 2 h",
    tags: ["postproceso", "starter", "kit"],
    color: "#5e747f",
    url: "#",
  },
  {
    id: 10,
    name: "Cama magnetica PEI 235x235",
    category: "Accesorios",
    store: "Tecno3D",
    price: 31800,
    previousPrice: 34900,
    stock: "En stock",
    city: "Cordoba",
    rating: 4.5,
    shipping: "Envio 24/48 h",
    updated: "hace 18 min",
    tags: ["PEI", "Ender 3", "texturada"],
    color: "#d1a842",
    url: "#",
  },
];

const price = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function Home() {
  const [query, setQuery] = useState("filamento pla");
  const [category, setCategory] = useState("Todo");
  const [store, setStore] = useState("Todas");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [stockOnly, setStockOnly] = useState(true);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => {
        const haystack = [
          product.name,
          product.category,
          product.store,
          product.city,
          product.material,
          ...product.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!normalizedQuery || haystack.includes(normalizedQuery)) &&
          (category === "Todo" || product.category === category) &&
          (store === "Todas" || product.store === store) &&
          (!stockOnly || product.stock !== "Consultar")
        );
      })
      .sort((a, b) => (sort === "desc" ? b.price - a.price : a.price - b.price));
  }, [category, query, sort, stockOnly, store]);

  const bestPrice = filtered.length
    ? filtered.reduce((min, product) => Math.min(min, product.price), filtered[0].price)
    : 0;

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
          <div className="topbar-links">
            <a href="#resultados">Resultados</a>
            <a href="#tiendas">Tiendas</a>
            <a href="#fuentes">Fuentes</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Comparador argentino de impresion 3D</p>
            <h1>Busca una pieza, repuesto o maquina y compara tiendas en segundos.</h1>
            <p>
              MVP navegable con catalogo inicial, filtros por rubro y tienda,
              orden de precios, estado de stock y datos listos para conectar a
              scrapers o feeds reales.
            </p>
          </div>

          <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="search">Producto</label>
            <div className="search-input">
              <span aria-hidden="true">⌕</span>
              <input
                id="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej: PLA negro, boquilla 0.4, Bambu A1"
              />
            </div>

            <div className="control-grid">
              <label>
                Categoria
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                Tienda
                <select value={store} onChange={(event) => setStore(event.target.value)}>
                  {stores.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

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
            </div>
          </form>
        </div>
      </section>

      <section className="stats-band" aria-label="Resumen">
        <div>
          <strong>{filtered.length}</strong>
          <span>ofertas visibles</span>
        </div>
        <div>
          <strong>{stores.length - 1}</strong>
          <span>tiendas demo</span>
        </div>
        <div>
          <strong>{bestPrice ? price.format(bestPrice) : "-"}</strong>
          <span>precio mas bajo</span>
        </div>
        <div>
          <strong>5 min</strong>
          <span>frecuencia objetivo</span>
        </div>
      </section>

      <section className="content-grid" id="resultados">
        <aside className="filters-panel" aria-label="Categorias rapidas">
          <h2>Categorias</h2>
          <div className="category-list">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <span>{item}</span>
                <small>
                  {item === "Todo"
                    ? products.length
                    : products.filter((product) => product.category === item).length}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section className="results-panel">
          <div className="section-heading">
            <div>
              <p>Resultados</p>
              <h2>Ordenados de precio {sort === "desc" ? "mayor a menor" : "menor a mayor"}</h2>
            </div>
            <span>{filtered.length} coincidencias</span>
          </div>

          <div className="result-list">
            {filtered.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-visual" style={{ backgroundColor: product.color }}>
                  <span>{product.category.slice(0, 3).toUpperCase()}</span>
                </div>
                <div className="product-info">
                  <div className="product-head">
                    <div>
                      <p>{product.store} · {product.city}</p>
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
                      <strong>{price.format(product.price)}</strong>
                      {product.previousPrice ? (
                        <small>{price.format(product.previousPrice)}</small>
                      ) : null}
                    </div>
                    <div className="meta">
                      <span>{product.shipping}</span>
                      <span>{product.rating.toFixed(1)} valoracion</span>
                      <span>{product.updated}</span>
                    </div>
                    <a href={product.url} aria-label={`Ver ${product.name} en ${product.store}`}>
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

        <aside className="pipeline-panel" id="fuentes">
          <h2>Proximo modulo</h2>
          <ol>
            <li>Scrapers por tienda con precio, stock y link canonico.</li>
            <li>Normalizacion de nombres para agrupar productos equivalentes.</li>
            <li>Historial de precios y alertas por WhatsApp o email.</li>
          </ol>
          <div className="sync-box" id="tiendas">
            <span>Fuentes listas</span>
            <strong>CSV · API · Scraping</strong>
            <p>La interfaz ya separa producto, tienda y disponibilidad para conectar datos reales.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
