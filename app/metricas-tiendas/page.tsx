import type { Metadata } from "next";
import Link from "next/link";
import {
  getClickMetricsOverview,
  getProductClickSummaries,
  getSearchMetricsOverview,
  getSearchQuerySummaries,
  getSourceClickSummaries,
  getStoreClickSummaries,
  type ClickMetricsOverview,
  type ProductClickSummary,
  type SearchMetricsOverview,
  type SearchQuerySummary,
  type SourceClickSummary,
  type StoreClickSummary,
} from "@/lib/outbound-clicks";
import { siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Métricas de tiendas",
  description: "Clics enviados desde Ruta 3D hacia tiendas y ofertas.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("es-AR");

function dateLabel(value: string | null, emptyLabel = "Sin clics") {
  if (!value) return emptyLabel;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default async function StoreMetricsPage() {
  let overview: ClickMetricsOverview = {
    totalClicks: 0,
    recentClicks: 0,
    storeCount: 0,
    productCount: 0,
    lastClickAt: null,
  };
  let storeSummaries: StoreClickSummary[] = [];
  let productSummaries: ProductClickSummary[] = [];
  let sourceSummaries: SourceClickSummary[] = [];
  let searchOverview: SearchMetricsOverview = {
    totalSearches: 0,
    recentSearches: 0,
    queryCount: 0,
    zeroResultSearches: 0,
    lastSearchedAt: null,
  };
  let searchSummaries: SearchQuerySummary[] = [];
  let errorMessage = "";

  try {
    [overview, storeSummaries, productSummaries, sourceSummaries, searchOverview, searchSummaries] = await Promise.all([
      getClickMetricsOverview(),
      getStoreClickSummaries(),
      getProductClickSummaries(),
      getSourceClickSummaries(),
      getSearchMetricsOverview(),
      getSearchQuerySummaries(),
    ]);
  } catch {
    errorMessage = "Las métricas ya están preparadas, pero esta pantalla necesita una base conectada para leer y guardar eventos reales. En Vercel se usa DATABASE_URL; en Cloudflare se usa D1.";
  }

  return (
    <main className="metrics-page">
      <header className="metrics-header">
        <Link href="/" className="metrics-back">Volver al comparador</Link>
        <div>
          <span>{siteName}</span>
          <h1>Métricas de tiendas</h1>
          <p>Cantidad de veces que una persona salió desde la página hacia una tienda u oferta.</p>
        </div>
        <strong>{numberFormatter.format(overview.totalClicks)} clics totales</strong>
      </header>

      {errorMessage ? (
        <div className="metrics-notice">
          <strong>Base de métricas no disponible en este entorno</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="metrics-overview" aria-label="Resumen de métricas">
        <article>
          <span>Total</span>
          <strong>{numberFormatter.format(overview.totalClicks)}</strong>
        </article>
        <article>
          <span>Últimos 7 días</span>
          <strong>{numberFormatter.format(overview.recentClicks ?? 0)}</strong>
        </article>
        <article>
          <span>Tiendas con clicks</span>
          <strong>{numberFormatter.format(overview.storeCount)}</strong>
        </article>
        <article>
          <span>Último click</span>
          <strong>{dateLabel(overview.lastClickAt)}</strong>
        </article>
      </section>

      <section className="metrics-overview" aria-label="Resumen de búsquedas">
        <article>
          <span>Búsquedas totales</span>
          <strong>{numberFormatter.format(searchOverview.totalSearches)}</strong>
        </article>
        <article>
          <span>Últimos 7 días</span>
          <strong>{numberFormatter.format(searchOverview.recentSearches ?? 0)}</strong>
        </article>
        <article>
          <span>Consultas únicas</span>
          <strong>{numberFormatter.format(searchOverview.queryCount)}</strong>
        </article>
        <article>
          <span>Sin resultados</span>
          <strong>{numberFormatter.format(searchOverview.zeroResultSearches ?? 0)}</strong>
        </article>
      </section>

      <section className="metrics-section" aria-labelledby="searches-title">
        <div className="metrics-section-heading">
          <h2 id="searches-title">Búsquedas internas</h2>
          <span>{numberFormatter.format(searchSummaries.length)} consultas</span>
        </div>
        {searchSummaries.length ? (
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Búsqueda</th>
                  <th>Últimos 7 días</th>
                  <th>Total</th>
                  <th>Sin resultados</th>
                  <th>Resultado prom.</th>
                  <th>Última búsqueda</th>
                </tr>
              </thead>
              <tbody>
                {searchSummaries.map((search) => (
                  <tr key={search.query}>
                    <td>{search.query}</td>
                    <td>{numberFormatter.format(search.recentSearches ?? 0)}</td>
                    <td>{numberFormatter.format(search.searches)}</td>
                    <td>{numberFormatter.format(search.zeroResultSearches ?? 0)}</td>
                    <td>{numberFormatter.format(search.averageResultCount ?? 0)}</td>
                    <td>{dateLabel(search.lastSearchedAt, "Sin búsquedas")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="metrics-empty">Cuando alguien use el buscador, sus consultas van a aparecer acá.</p>
        )}
      </section>

      <section className="metrics-section" aria-labelledby="store-clicks-title">
        <div className="metrics-section-heading">
          <h2 id="store-clicks-title">Clics por tienda</h2>
          <span>{numberFormatter.format(storeSummaries.length)} tiendas</span>
        </div>
        {storeSummaries.length ? (
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Últimos 7 días</th>
                  <th>Clics</th>
                  <th>Último clic</th>
                </tr>
              </thead>
              <tbody>
                {storeSummaries.map((store) => (
                  <tr key={store.store}>
                    <td>{store.store}</td>
                    <td>{numberFormatter.format(store.recentClicks ?? 0)}</td>
                    <td>{numberFormatter.format(store.clicks)}</td>
                    <td>{dateLabel(store.lastClickAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="metrics-empty">Todavía no se registraron clics hacia tiendas.</p>
        )}
      </section>

      <section className="metrics-section" aria-labelledby="source-clicks-title">
        <div className="metrics-section-heading">
          <h2 id="source-clicks-title">Clics por origen</h2>
          <span>{numberFormatter.format(sourceSummaries.length)} orígenes</span>
        </div>
        {sourceSummaries.length ? (
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Últimos 7 días</th>
                  <th>Clics</th>
                  <th>Último clic</th>
                </tr>
              </thead>
              <tbody>
                {sourceSummaries.map((source) => (
                  <tr key={source.source}>
                    <td>{source.source}</td>
                    <td>{numberFormatter.format(source.recentClicks ?? 0)}</td>
                    <td>{numberFormatter.format(source.clicks)}</td>
                    <td>{dateLabel(source.lastClickAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="metrics-empty">Todavía no hay suficientes clics para separar por origen.</p>
        )}
      </section>

      <section className="metrics-section" aria-labelledby="product-clicks-title">
        <div className="metrics-section-heading">
          <h2 id="product-clicks-title">Ofertas más visitadas</h2>
          <span>Top 100</span>
        </div>
        {productSummaries.length ? (
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Oferta</th>
                  <th>Tienda</th>
                  <th>Clics</th>
                  <th>Último clic</th>
                </tr>
              </thead>
              <tbody>
                {productSummaries.map((product) => (
                  <tr key={`${product.store}-${product.productId ?? product.targetUrl}`}>
                    <td><a href={product.targetUrl} target="_blank" rel="noreferrer">{product.productName}</a></td>
                    <td>{product.store}</td>
                    <td>{numberFormatter.format(product.clicks)}</td>
                    <td>{dateLabel(product.lastClickAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="metrics-empty">Cuando alguien toque “Ver oferta”, esa oferta va a aparecer acá.</p>
        )}
      </section>
    </main>
  );
}
