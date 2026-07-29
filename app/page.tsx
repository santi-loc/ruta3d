"use client";

import { useMemo, useState } from "react";
import erexitData from "@/data/erexit3d-products.json";
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
  rating: number;
  shipping: string;
  updated: string;
  tags: string[];
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

const categories = [
  "Todo",
  "Impresoras",
  "Filamentos",
  "Resina",
  "Repuestos",
  "Herramientas",
  "Accesorios",
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
    status: "Mapeada",
  },
];

const stores = ["Todas", ...storeSources.map((source) => source.name)];

function toProduct(product: ScrapedProduct): Product {
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
    rating: 4.7,
    shipping: `Dato real de ${product.store}`,
    updated: "scrape real",
    tags: product.tags.length ? product.tags : [product.brand ?? product.store],
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
    material: product.tags.find((tag) => ["PLA", "PETG", "ABS", "ASA", "TPU", "FLEX"].includes(tag)),
    source: "scraper",
  };
}

const realErexitProducts = (erexitData.products as ScrapedProduct[]).map(toProduct);
const realLaboratorioProducts = (laboratorioData.products as ScrapedProduct[]).map(toProduct);
const realTp3dProducts = (tp3dData.products as ScrapedProduct[]).map(toProduct);
const realProyectoColorProducts = (proyectoColorData.products as ScrapedProduct[]).map(toProduct);

const demoProducts: Product[] = [
  {
    id: 5,
    name: "PETG Cristal 1kg 1.75mm",
    category: "Filamentos",
    store: "Kimera 3D",
    price: 26800,
    stock: "En stock",
    city: "Argentina",
    rating: 4.7,
    shipping: "Envio 24/48 h",
    updated: "hace 13 min",
    tags: ["PETG", "translucido", "1kg"],
    material: "PETG",
    color: "#9bd5d0",
    url: "https://kimera3d.com.ar",
    source: "demo",
  },
  {
    id: 9,
    name: "Kit espatula + pinza + cutter",
    category: "Herramientas",
    store: "Kimera 3D",
    price: 18400,
    stock: "En stock",
    city: "Argentina",
    rating: 4.2,
    shipping: "Mercado Envios",
    updated: "hace 2 h",
    tags: ["postproceso", "starter", "kit"],
    color: "#5e747f",
    url: "https://kimera3d.com.ar",
    source: "demo",
  },
];

const realProducts = [
  ...realErexitProducts,
  ...realLaboratorioProducts,
  ...realTp3dProducts,
  ...realProyectoColorProducts,
];
const products = [...realProducts, ...demoProducts];
const connectedStores = storeSources.filter((source) => source.status === "Conectada").length;

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
    const queryTerms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

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
          (!queryTerms.length || queryTerms.every((term) => haystack.includes(term))) &&
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
              Erexit 3D, Laboratorio 3D, TP3D y Proyecto Color ya estan
              conectadas con scraper propio: traen productos, precios, stock,
              imagenes y links reales. Kimera queda como demo hasta sumar su
              conector.
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
          <strong>{realProducts.length}</strong>
          <span>ofertas reales</span>
        </div>
        <div>
          <strong>{stores.length - 1}</strong>
          <span>tiendas iniciales</span>
        </div>
        <div>
          <strong>{bestPrice ? price.format(bestPrice) : "-"}</strong>
          <span>precio mas bajo</span>
        </div>
        <div>
          <strong>{connectedStores}</strong>
          <span>tiendas conectadas</span>
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
                  {product.image ? (
                    <img src={product.image} alt="" loading="lazy" />
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
                      <strong>{price.format(product.price)}</strong>
                      {product.previousPrice ? (
                        <small>{price.format(product.previousPrice)}</small>
                      ) : null}
                      {product.transferPrice ? (
                        <small className="transfer-price">
                          {price.format(product.transferPrice)} transferencia
                        </small>
                      ) : null}
                    </div>
                    <div className="meta">
                      <span>{product.shipping}</span>
                      <span>{product.rating.toFixed(1)} valoracion</span>
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

        <aside className="pipeline-panel" id="fuentes">
          <h2>Proximo modulo</h2>
          <ol>
            <li>Erexit 3D conectado con scraper paginado.</li>
            <li>Laboratorio 3D conectado con scraper paginado.</li>
            <li>TP3D conectado por categorias PrestaShop.</li>
            <li>Proyecto Color conectado por categoria WooCommerce.</li>
            <li>Normalizacion de nombres para agrupar productos equivalentes.</li>
          </ol>
          <div className="sync-box" id="tiendas">
            <span>Fuentes listas</span>
            <strong>{realProducts.length} ofertas reales</strong>
            <p>Cuatro tiendas ya entregan precio, stock, imagen, variantes cuando existen y link canonico.</p>
          </div>
          <div className="source-list" aria-label="Tiendas iniciales">
            {storeSources.map((source) => (
              <a href={source.url} key={source.domain} target="_blank" rel="noreferrer">
                <span>
                  <strong>{source.name}</strong>
                  <small>{source.domain}</small>
                </span>
                <em>{source.status}</em>
              </a>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
