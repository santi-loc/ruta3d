# Ruta 3D

Comparador argentino de precios para productos de impresion 3D.

El MVP muestra filtros por categoria, tienda, marca, material, stock, orden por
mejor precio disponible y links de oferta. Erexit 3D, Laboratorio 3D, TP3D,
Proyecto Color y Kimera 3D ya tienen datos reales conectados.

## Comandos

```bash
pnpm run dev
pnpm run build
pnpm run scrape:erexit3d
pnpm run scrape:laboratorio3d
pnpm run scrape:tp3d
pnpm run scrape:proyectocolor
pnpm run scrape:kimera3d
```

## Scrapers conectados

Los scrapers estan en:

- `scripts/scrape-erexit3d.mjs`
- `scripts/scrape-laboratorio3d.mjs`
- `scripts/scrape-tp3d.mjs`
- `scripts/scrape-proyectocolor.mjs`
- `scripts/scrape-kimera3d.mjs`

Extraen desde sus catalogos y paginas sucesivas:

- nombre
- categoria inferida
- precio
- precio con transferencia
- stock acumulado por variantes
- marca
- tags
- imagen
- link canonico
- variantes

Salida principal:

```bash
data/erexit3d-products.json
data/laboratorio3d-products.json
data/tp3d-products.json
data/proyectocolor-products.json
data/kimera3d-products.json
```

Para probar solo la primera pagina:

```bash
pnpm run scrape:erexit3d:sample
pnpm run scrape:laboratorio3d:sample
pnpm run scrape:tp3d:sample
pnpm run scrape:proyectocolor:sample
```

## Estructura de la pantalla

- `lib/catalog.ts` normaliza los productos, precomputa texto de busqueda,
  categorias derivadas, marca, material y mejor precio.
- `app/page.tsx` es un server component liviano que entrega los datos ya
  normalizados.
- `app/product-explorer.tsx` contiene la interfaz interactiva de busqueda,
  filtros, orden y paginacion progresiva.
