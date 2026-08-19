import type { Metadata } from "next";
import Link from "next/link";
import {
  getProductClickSummaries,
  getStoreClickSummaries,
  type ProductClickSummary,
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

const numberFormatter = new Intl.NumberFormat("es-AR");

function dateLabel(value: string | null) {
  if (!value) return "Sin clics";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default async function StoreMetricsPage() {
  let storeSummaries: StoreClickSummary[] = [];
  let productSummaries: ProductClickSummary[] = [];
  let errorMessage = "";

  try {
    [storeSummaries, productSummaries] = await Promise.all([
      getStoreClickSummaries(),
      getProductClickSummaries(),
    ]);
  } catch {
    errorMessage = "Todavía no hay una base de métricas disponible. Cuando el sitio esté publicado con D1, esta pantalla va a mostrar los clics reales.";
  }

  const totalClicks = storeSummaries.reduce((total, store) => total + store.clicks, 0);

  return (
    <main className="metrics-page">
      <header className="metrics-header">
        <Link href="/" className="metrics-back">Volver al comparador</Link>
        <div>
          <span>{siteName}</span>
          <h1>Métricas de tiendas</h1>
          <p>Cantidad de veces que una persona salió desde la página hacia una tienda u oferta.</p>
        </div>
        <strong>{numberFormatter.format(totalClicks)} clics totales</strong>
      </header>

      {errorMessage ? <p className="metrics-notice">{errorMessage}</p> : null}

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
                  <th>Clics</th>
                  <th>Último clic</th>
                </tr>
              </thead>
              <tbody>
                {storeSummaries.map((store) => (
                  <tr key={store.store}>
                    <td>{store.store}</td>
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
