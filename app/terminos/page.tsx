import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso | Filtrar 3D",
  description: "Términos de uso de Filtrar 3D.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-page-inner">
        <Link href="/" className="legal-back">← Volver a Filtrar 3D</Link>
        <h1>Términos de uso</h1>
        <p className="legal-lead">Al usar Filtrar 3D entendés que el sitio es una herramienta de comparación y no una tienda online.</p>
        <section>
          <h2>Información de referencia</h2>
          <p>Los precios, el stock y las condiciones se obtienen de catálogos conectados y pueden cambiar. Antes de comprar, verificá la información final en la tienda de destino.</p>
        </section>
        <section>
          <h2>Compras y pagos</h2>
          <p>Filtrar 3D no vende productos, no procesa pagos y no participa en la entrega. La compra se realiza directamente con la tienda elegida.</p>
        </section>
        <section>
          <h2>Uso del sitio</h2>
          <p>Podés usar el comparador para buscar y evaluar ofertas. No garantizamos disponibilidad permanente de una oferta, precio o comercio listado.</p>
        </section>
        <section>
          <h2>Tiendas y correcciones</h2>
          <p>Si representás una tienda o detectás información incorrecta, escribinos a <a href="mailto:lok3d.co@gmail.com">lok3d.co@gmail.com</a>.</p>
        </section>
      </div>
    </main>
  );
}
