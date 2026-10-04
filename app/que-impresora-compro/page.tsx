import type { Metadata } from "next";
import { getCatalogData, storeSources, stores } from "@/lib/catalog";
import { PrinterGuide } from "../printer-guide";

export const metadata: Metadata = {
  title: "Qué impresora 3D compro",
  description: "Guía interactiva para elegir impresoras 3D FDM disponibles en tiendas argentinas según uso, presupuesto, materiales y multicolor.",
  alternates: {
    canonical: "/que-impresora-compro",
  },
  openGraph: {
    title: "Qué impresora 3D compro | Ruta 3D",
    description: "Compará modelos FDM disponibles en Argentina y encontrá opciones según tu presupuesto y tipo de uso.",
    url: "/que-impresora-compro",
  },
};

export default async function PrinterGuidePage() {
  const { catalogProducts } = await getCatalogData();

  return (
    <PrinterGuide
      products={catalogProducts}
      storeLinks={storeSources.map((source) => ({ name: source.name, url: source.url }))}
      stores={stores}
    />
  );
}
