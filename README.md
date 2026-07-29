# Filtrar 3D

Comparador argentino de precios para productos de impresion 3D.

El MVP muestra tiendas candidatas, filtros por categoria/tienda, orden por precio,
stock y links de oferta. Erexit 3D y Laboratorio 3D ya tienen scrapers reales
conectados.

## Comandos

```bash
pnpm run dev
pnpm run build
pnpm run scrape:erexit3d
pnpm run scrape:laboratorio3d
```

## Scrapers conectados

Los scrapers estan en:

- `scripts/scrape-erexit3d.mjs`
- `scripts/scrape-laboratorio3d.mjs`

Extraen desde sus catalogos `/productos/` y paginas sucesivas:

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
```

Para probar solo la primera pagina:

```bash
pnpm run scrape:erexit3d:sample
pnpm run scrape:laboratorio3d:sample
```

## Proximos conectores

Las fuentes iniciales estan en `store-sources.json`.

Pendientes:

- TP3D
- Proyecto Color
- Kimera 3D
