import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const metadataBase = new URL(siteUrl);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: `${siteName} | Comparador argentino de impresión 3D`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "impresoras 3D Argentina",
    "filamentos 3D Argentina",
    "comparador impresión 3D",
    "precio filamento PLA",
    "resina 3D Argentina",
    "repuestos impresora 3D",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: `${siteName} | Comparador argentino de impresión 3D`,
    description: siteDescription,
    url: "/",
    siteName,
    locale: "es_AR",
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
    title: `${siteName} | Comparador argentino de impresión 3D`,
    description: siteDescription,
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
