"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Ruta3DMark } from "./ruta-3d-mark";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es-AR">
      <body>
        <main className="app-error-page">
          <section className="app-error-card" aria-labelledby="global-error-title">
            <Ruta3DMark className="mini-route-mark" />
            <h1 id="global-error-title">Ruta 3D no pudo iniciar</h1>
            <p>Hubo un error cargando la página completa. Probá recargar; si estás en local, revisá que el servidor siga activo y que el catálogo haya compilado bien.</p>
            <div className="app-error-actions">
              <button type="button" onClick={reset}>Reintentar</button>
              <Link href="/">Volver al inicio</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
