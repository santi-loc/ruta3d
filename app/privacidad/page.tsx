import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad | Ruta 3D",
  description: "Información sobre privacidad en Ruta 3D.",
  alternates: {
    canonical: "/privacidad",
  },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-page-inner">
        <Link href="/" className="legal-back">← Volver a Ruta 3D</Link>
        <h1>Privacidad</h1>
        <p className="legal-lead">Ruta 3D es un comparador de ofertas de impresión 3D. Esta página explica, de forma simple, qué información usa el sitio.</p>
        <section>
          <h2>Datos de las ofertas</h2>
          <p>Mostramos información pública de catálogos de tiendas conectadas, como nombre de producto, precio, disponibilidad, imagen y enlace de la oferta.</p>
        </section>
        <section>
          <h2>Datos de navegación</h2>
          <p>La preferencia de tema claro u oscuro se guarda solamente en tu navegador para recordar tu elección. El sitio no ofrece registro de usuarios ni procesa pagos.</p>
        </section>
        <section>
          <h2>Enlaces a tiendas</h2>
          <p>Al abrir una oferta, visitás el sitio de la tienda correspondiente. Sus políticas de privacidad y condiciones aplican a cualquier dato que compartas o compra que realices allí.</p>
        </section>
        <section>
          <h2>Contacto</h2>
          <p>Para consultar sobre esta política o pedir una corrección, escribinos a <a href="mailto:lok3d.co@gmail.com">lok3d.co@gmail.com</a>.</p>
        </section>
      </div>
    </main>
  );
}
