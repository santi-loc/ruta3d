import type { Metadata } from "next";
import "./globals.css";

const title = "Ruta 3D";
const description =
  "Comparador argentino para buscar impresoras 3D, filamentos, resinas, repuestos, accesorios y herramientas por tienda, precio y stock.";
const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://ruta3d.vercel.app");

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title,
    description,
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Ruta 3D",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
