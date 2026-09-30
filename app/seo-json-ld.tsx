import type { Product } from "@/lib/catalog";
import { absoluteSiteUrl, siteDescription, siteName } from "@/lib/site";

const price = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function HomeJsonLd({ products, productCount, storeCount }: { products: Product[]; productCount: number; storeCount: number }) {
  const featuredProducts = products
    .filter((product) => product.stock !== "Consultar")
    .sort((a, b) => a.bestPrice - b.bestPrice)
    .slice(0, 12);
  const productCategoryCount = new Map<string, number>();

  for (const product of products) {
    productCategoryCount.set(product.category, (productCategoryCount.get(product.category) ?? 0) + 1);
  }

  const graph = [
    {
      "@type": "Organization",
      "@id": absoluteSiteUrl("/#organization"),
      name: siteName,
      alternateName: ["Ruta3D", "Ruta 3D Argentina"],
      url: absoluteSiteUrl("/"),
      logo: absoluteSiteUrl("/ruta-3d-logo.png"),
      contactPoint: {
        "@type": "ContactPoint",
        email: "lok3d.co@gmail.com",
        contactType: "customer support",
        areaServed: "AR",
        availableLanguage: "es",
      },
    },
    {
      "@type": "WebSite",
      "@id": absoluteSiteUrl("/#website"),
      name: siteName,
      alternateName: ["Ruta3D", "Ruta 3D Argentina"],
      url: absoluteSiteUrl("/"),
      inLanguage: "es-AR",
      description: siteDescription,
      publisher: { "@id": absoluteSiteUrl("/#organization") },
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteSiteUrl("/")}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": absoluteSiteUrl("/#app"),
      name: siteName,
      url: absoluteSiteUrl("/"),
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      inLanguage: "es-AR",
      description: siteDescription,
    },
    {
      "@type": "ItemList",
      "@id": absoluteSiteUrl("/#catalog"),
      name: `Catálogo de impresión 3D en Argentina: ${productCount} productos en ${storeCount} tiendas`,
      description: "Ofertas de impresoras 3D, filamentos, resinas, repuestos y accesorios relevadas de tiendas argentinas conectadas.",
      numberOfItems: productCount,
      itemListElement: [...productCategoryCount.entries()].map(([category, count], index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${category}: ${count} productos`,
        url: absoluteSiteUrl(`/?q=${encodeURIComponent(category)}`),
      })),
    },
    {
      "@type": "ItemList",
      "@id": absoluteSiteUrl("/#featured-offers"),
      name: "Resultados destacados de tiendas argentinas de impresión 3D",
      description: "Productos relevados para comparar precio y disponibilidad. Ruta 3D no vende estos artículos ni procesa la compra.",
      itemListElement: featuredProducts.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Thing",
          name: product.name,
          category: product.category,
          brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
          image: product.image ?? undefined,
          sameAs: product.url,
          description: `${product.category} relevado en ${product.store}. Precio de referencia: ${price.format(product.bestPrice)}.`,
        },
      })),
    },
    {
      "@type": "FAQPage",
      "@id": absoluteSiteUrl("/#faq"),
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Ruta 3D vende impresoras 3D o filamentos?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Ruta 3D compara precios, stock y enlaces de tiendas argentinas; la compra se realiza en la tienda de destino.",
          },
        },
        {
          "@type": "Question",
          name: "¿Los precios de Ruta 3D son finales?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Los precios son de referencia y pueden cambiar. Antes de comprar conviene verificar el importe final en la tienda. La oferta más barata relevada se muestra como ${featuredProducts[0] ? price.format(featuredProducts[0].bestPrice) : "precio disponible"}.`,
          },
        },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
