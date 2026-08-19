"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Ruta3DMark } from "./ruta-3d-mark";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-error-page">
      <section className="app-error-card" aria-labelledby="app-error-title">
        <Ruta3DMark className="mini-route-mark" />
        <h1 id="app-error-title">No pudimos cargar esta parte de Ruta 3D</h1>
        <p>Algo falló mientras preparábamos el comparador. Podés intentar de nuevo; si sigue pasando, el catálogo o el servidor local pueden estar momentáneamente fuera de servicio.</p>
        <div className="app-error-actions">
          <button type="button" onClick={reset}>Reintentar</button>
          <Link href="/">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
