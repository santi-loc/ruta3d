export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ruta3d.vercel.app";
export const siteName = "Ruta 3D";
export const siteDescription =
  "Comparador argentino para buscar impresoras 3D, filamentos, resinas, repuestos, accesorios y herramientas por tienda, precio y stock.";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
